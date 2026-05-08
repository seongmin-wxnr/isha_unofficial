from __future__ import annotations

from typing import Any, Dict, List

import requests
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import NaverCafePostCache
from . import api_protection

## 네이버 공식 API 아닙니다
## 치지직에서 카페 연동 시 로드되는 api 엔드포인트 데이터를 사용 하게 됩니다.
## 변경 시 로드가 안될 수 있습니다.


## 하드 코딩
CAFE_ID        = 31577948 
MENU_NOTICE    = 21       
MENU_COMMUNITY = 20         

BASE_URL = "https://apis.naver.com/cafe-web/cafe2/ArticleListV2dot1.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://cafe.naver.com/",
    "Accept": "application/json, text/plain, */*",
}


def _fetch_articles(club_id: int, menu_id: int, page: int = 1, per_page: int = 15) -> List[Dict]:
    params = {
        "search.clubid": club_id,
        "search.menuid": menu_id,
        "search.page": page,
        "search.perPage": per_page,
        "ad": "false",
        "from": "webkit",
    }
    try:
        resp = requests.get(BASE_URL, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        raise RuntimeError(f"카페 API 호출 실패: {exc}") from exc

    message = data.get("message") or {}
    result  = message.get("result") or {}
    return result.get("articleList") or []


def sync_cafe_posts(
    club_id: int = CAFE_ID,
    menu_id: int = MENU_COMMUNITY,
    board_type: str = "community",
    pages: int = 2,
    per_page: int = 15,
    incremental: bool = False,
) -> int:
    synced = 0

    latest_ts = None
    if incremental:
        latest = NaverCafePostCache.objects.filter(
            board_type=board_type
        ).order_by("-write_date_timestamp").first()
        if latest:
            latest_ts = latest.write_date_timestamp

    for page in range(1, pages + 1):
        articles = _fetch_articles(club_id, menu_id, page=page, per_page=per_page)
        if not articles:
            break

        stop_flag = False
        for item in articles:
            article_id = item.get("articleId")
            if not article_id:
                continue

            if incremental and latest_ts:
                item_ts = int(item.get("writeDateTimestamp") or 0)
                if item_ts <= latest_ts:
                    stop_flag = True
                    break

            thumbnail = item.get("representImage") or item.get("thumbnailUrl") or ""
            cafe_url  = f"https://cafe.naver.com/ArticleRead.nhn?clubid={club_id}&articleid={article_id}"
            NaverCafePostCache.objects.update_or_create(
                article_id=article_id,
                defaults={
                    "club_id":              club_id,
                    "menu_id":              menu_id,
                    "board_type":           board_type,
                    "subject":              item.get("subject") or "",
                    "writer_nickname":      item.get("writerNickname") or item.get("nickname") or "",
                    "read_count":           int(item.get("readCount")    or 0),
                    "comment_count":        int(item.get("commentCount") or 0),
                    "like_it_count":        int(item.get("likeItCount")  or 0),
                    "write_date_timestamp": int(item.get("writeDateTimestamp") or 0),
                    "thumbnail_url":        thumbnail,
                    "cafe_url":             cafe_url,
                    "raw_json":             item,
                },
            )
            synced += 1

        if stop_flag:
            break

    return synced


@require_GET
def api_isha_cafe_sync(request):
    staff_error = api_protection.BlockEndPoint._require_staff(request)
    if staff_error:
        return staff_error
    else:
        pass
    incremental = request.GET.get("incremental", "false").lower() == "true"
    try:
        n = sync_cafe_posts(menu_id=MENU_NOTICE,    board_type="notice",    pages=1, per_page=10, incremental=incremental)
        c = sync_cafe_posts(menu_id=MENU_COMMUNITY, board_type="community", pages=3, per_page=15, incremental=incremental)
        return JsonResponse({
            "success": True,
            "incremental": incremental,
            "synced": {"notice": n, "community": c, "total": n + c},
            "message": f"{'증분' if incremental else '전체'} 동기화 완료 (공지 {n}개, 커뮤니티 {c}개)",
        })
    except Exception as exc:
        return JsonResponse({"success": False, "message": str(exc)}, status=500)


@require_GET
def api_isha_cafe_posts(request):
    # staff_error = api_protection.BlockEndPoint._require_staff(request)
    # if staff_error:
    #     return staff_error
    # else:
    #     pass
    board_type = (request.GET.get("type") or "").strip().lower()
    limit = min(int(request.GET.get("limit", 20)), 100)

    qs = NaverCafePostCache.objects.all()
    if board_type in ("notice", "community"):
        qs = qs.filter(board_type=board_type)
    qs = qs.order_by("-write_date_timestamp")[:limit]

    return JsonResponse({
        "success": True,
        "items": [
            {
                "article_id":           p.article_id,
                "board_type":           p.board_type,
                "subject":              p.subject,
                "writer_nickname":      p.writer_nickname,
                "read_count":           p.read_count,
                "comment_count":        p.comment_count,
                "like_it_count":        p.like_it_count,
                "write_date_timestamp": p.write_date_timestamp,
                "thumbnail_url":        p.thumbnail_url,
                "cafe_url":             p.cafe_url,
            }
            for p in qs
        ],
    })
