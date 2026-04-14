from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from decouple import config
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from .models import ChzzkVideoCache
from . import api_protection

class ChzzkAPIError(Exception):
    """Raised when CHZZK Open API returns an error or invalid response."""


class ChzzkClient:
    BASE_URL = "https://openapi.chzzk.naver.com"
    TIMEOUT = 10

    def __init__(self) -> None:
        self.client_id = config("CHZZK_CLIENT_ID", default="").strip()
        self.client_secret = config("CHZZK_CLIENT_SECRET", default="").strip()
        self.default_channel_ids = self._parse_channel_ids(
            config("CHZZK_CHANNEL_IDS", default="")
        )

    @staticmethod
    def _parse_channel_ids(raw_value: str) -> List[str]:
        if not raw_value:
            return []
        return [item.strip() for item in raw_value.split(",") if item.strip()]

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def _headers(self) -> Dict[str, str]:
        if not self.is_configured():
            raise ChzzkAPIError(
                "CHZZK_CLIENT_ID 또는 CHZZK_CLIENT_SECRET 이 설정되지 않았습니다."
            )

        return {
            "Client-Id": self.client_id,
            "Client-Secret": self.client_secret,
            "Content-Type": "application/json",
        }

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.BASE_URL}{path}"

        try:
            response = requests.get(
                url,
                headers=self._headers(),
                params=params or {},
                timeout=self.TIMEOUT,
            )
            response.raise_for_status()
        except requests.exceptions.HTTPError as exc:
            detail = ""
            try:
                payload = response.json()
                detail = payload.get("message") or str(payload)
            except Exception:
                detail = response.text or str(exc)
            raise ChzzkAPIError(f"치지직 API 호출 실패: {detail}") from exc
        except requests.exceptions.RequestException as exc:
            raise ChzzkAPIError(f"치지직 API 연결 실패: {exc}") from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise ChzzkAPIError("치지직 API 응답을 JSON 으로 해석할 수 없습니다.") from exc

        if isinstance(payload, dict) and payload.get("code") not in (None, 200):
            raise ChzzkAPIError(payload.get("message") or "치지직 API 에러")

        return payload

    def get_channels(self, channel_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        target_ids = channel_ids or self.default_channel_ids
        if not target_ids:
            raise ChzzkAPIError("조회할 CHZZK 채널 ID가 없습니다.")

        payload = self._get("/open/v1/channels", params={"channelIds": target_ids})
        content = payload.get("content") or {}
        return content.get("data") or []

    def get_lives(self, size: int = 20, next_value: Optional[str] = None) -> Dict[str, Any]:
        params: Dict[str, Any] = {"size": max(1, min(size, 20))}
        if next_value:
            params["next"] = next_value

        payload = self._get("/open/v1/lives", params=params)
        content = payload.get("content") or {}
        return {
            "data": content.get("data") or [],
            "page": content.get("page") or {},
        }

    def get_live_by_channel_id(self, channel_id: str) -> Optional[Dict[str, Any]]:
        next_value: Optional[str] = None

        for _ in range(10):
            result = self.get_lives(size=20, next_value=next_value)
            for live in result.get("data", []):
                if live.get("channelId") == channel_id:
                    return live

            next_value = (result.get("page") or {}).get("next")
            if not next_value:
                break

        return None

    def get_bootstrap(self, channel_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        channels = self.get_channels(channel_ids=channel_ids)
        merged: List[Dict[str, Any]] = []

        for channel in channels:
            channel_id = channel.get("channelId", "")
            live = self.get_live_by_channel_id(channel_id) if channel_id else None

            merged.append(
                {
                    "channelId": channel.get("channelId"),
                    "channelName": channel.get("channelName"),
                    "channelImageUrl": channel.get("channelImageUrl"),
                    "followerCount": channel.get("followerCount", 0),
                    "verifiedMark": channel.get("verifiedMark", False),
                    "isLive": bool(live),
                    "live": live,
                    "channelUrl": f"https://chzzk.naver.com/{channel_id}" if channel_id else None,
                }
            )

        return merged

    def get_videos(
        self,
        channel_id: str,
        page: int = 0,
        size: int = 24,
    ) -> Dict[str, Any]:
        """비공식 API로 채널 VOD 전체 목록 조회 (타입 필터 없이 전체)"""
        url = f"https://api.chzzk.naver.com/service/v1/channels/{channel_id}/videos"
        params: Dict[str, Any] = {
            "sortType": "LATEST",
            "pagingType": "PAGE",
            "page": page,
            "size": size,
        }

        try:
            resp = requests.get(
                url,
                params=params,
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=self.TIMEOUT,
            )
            resp.raise_for_status()
            payload = resp.json()
        except requests.exceptions.RequestException as exc:
            raise ChzzkAPIError(f"치지직 VOD API 연결 실패: {exc}") from exc

        content = payload.get("content") or {}
        return {
            "data": content.get("data") or [],
            "totalCount": content.get("totalCount", 0),
            "totalPages": content.get("totalPages", 0),
            "currentPage": content.get("page", page),
        }


    def get_clips(
        self,
        channel_id: str,
        clip_uid: str = "",
        read_count: str = "",
        size: int = 15,
        order_type: str = "POPULAR",
    ) -> Dict[str, Any]:
        """비공식 API로 채널 클립 목록 조회 (clipUID 커서 기반)"""
        url = f"https://api.chzzk.naver.com/service/v1/channels/{channel_id}/clips"
        params: Dict[str, Any] = {
            "filterType": "ALL",
            "orderType": order_type,
            "size": size,
        }
        # 빈 값은 파라미터에서 제외
        if clip_uid:
            params["clipUID"] = clip_uid
        if read_count:
            params["readCount"] = read_count

        try:
            resp = requests.get(
                url,
                params=params,
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=self.TIMEOUT,
            )
            resp.raise_for_status()
            payload = resp.json()
        except requests.exceptions.RequestException as exc:
            raise ChzzkAPIError(f"치지직 클립 API 연결 실패: {exc}") from exc

        content = payload.get("content") or {}
        data = content.get("data") or []
        page = content.get("page") or {}
        next_page = page.get("next") or {}

        return {
            "data": data,
            "next_clip_uid": next_page.get("clipUID") or "",
            "next_read_count": str(next_page.get("readCount") or ""),
            "has_more": bool(next_page.get("clipUID")),
        }


def get_client() -> ChzzkClient:
    return ChzzkClient()


def _request_channel_ids(request, client: ChzzkClient) -> List[str]:
    raw_values = (
        request.GET.getlist("channelId")
        or request.GET.getlist("channelIds")
        or [request.GET.get("channelId", "")]
        or [request.GET.get("channelIds", "")]
    )

    parsed: List[str] = []
    for raw in raw_values:
        if not raw:
            continue
        parsed.extend(client._parse_channel_ids(raw))

    return parsed or client.default_channel_ids


@require_GET
def api_isha_chzzk_channels(request):
    
    client = get_client()
    channel_ids = _request_channel_ids(request, client)

    try:
        data = client.get_channels(channel_ids=channel_ids or None)
        return JsonResponse(
            {
                "success": True,
                "configured": client.is_configured(),
                "channels": data,
            },
            status=200,
        )
    except ChzzkAPIError as exc:
        return JsonResponse(
            {
                "success": False,
                "configured": client.is_configured(),
                "message": str(exc),
                "channels": [],
            },
            status=400,
        )


@require_GET
def api_isha_chzzk_live_status(request):
    client = get_client()
    channel_ids = _request_channel_ids(request, client)
    channel_id = channel_ids[0] if channel_ids else ""

    if not channel_id:
        return JsonResponse(
            {
                "success": False,
                "configured": client.is_configured(),
                "message": "channelId 파라미터 또는 CHZZK_CHANNEL_IDS 설정이 필요합니다.",
                "isLive": False,
                "live": None,
            },
            status=400,
        )

    try:
        live = client.get_live_by_channel_id(channel_id)
        return JsonResponse(
            {
                "success": True,
                "configured": client.is_configured(),
                "channelId": channel_id,
                "isLive": bool(live),
                "live": live,
            },
            status=200,
        )
    except ChzzkAPIError as exc:
        return JsonResponse(
            {
                "success": False,
                "configured": client.is_configured(),
                "message": str(exc),
                "channelId": channel_id,
                "isLive": False,
                "live": None,
            },
            status=400,
        )

@require_GET
def api_isha_chzzk_bootstrap(request):
    client = get_client()
    channel_ids = _request_channel_ids(request, client)

    try:
        data = client.get_bootstrap(channel_ids=channel_ids or None)
        return JsonResponse(
            {
                "success": True,
                "configured": client.is_configured(),
                "items": data,
            },
            status=200,
        )
    except ChzzkAPIError as exc:
        return JsonResponse(
            {
                "success": False,
                "configured": client.is_configured(),
                "message": str(exc),
                "items": [],
            },
            status=400,
        )

def _parse_publish_date(raw: Any) -> Optional[datetime]:
    """publishDateAt(ms) 또는 publishDate(str) 파싱"""
    if isinstance(raw, (int, float)) and raw > 0:
        try:
            return datetime.fromtimestamp(raw / 1000, tz=timezone.UTC)
        except Exception:
            pass
    if isinstance(raw, str) and raw:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
            try:
                dt = datetime.strptime(raw, fmt)
                return timezone.make_aware(dt, timezone.UTC)
            except ValueError:
                continue
    return None


def sync_chzzk_videos(channel_id: str, incremental: bool = False) -> Dict[str, int]:
    """
    다시보기 동기화.
    incremental=True: DB 최신 video_no 이후 새 영상만 수집 (첫 페이지에서 이미 있는 항목 나오면 중단)
    """
    client = get_client()
    counts = {"replay": 0, "clip": 0, "total": 0}
    page = 0
    MAX_PAGES = 100

    # 증분 sync: DB에서 가장 큰 video_no 확인
    latest_video_no = None
    if incremental:
        latest = ChzzkVideoCache.objects.filter(
            channel_id=channel_id, video_type="replay"
        ).order_by("-video_no").first()
        if latest:
            latest_video_no = latest.video_no

    while page < MAX_PAGES:
        result = client.get_videos(channel_id, page=page, size=24)
        items = result.get("data", [])
        if not items:
            break

        stop_flag = False
        for item in items:
            video_no = item.get("videoNo")
            if not video_no:
                continue

            # 증분: 이미 있는 video_no 만나면 중단
            if incremental and latest_video_no and video_no <= latest_video_no:
                stop_flag = True
                break

            publish_dt = _parse_publish_date(
                item.get("publishDateAt") or item.get("publishDate")
            )

            raw_vtype = (item.get("videoType") or "").upper()
            vtype = "clip" if raw_vtype == "CLIP" else "replay"

            ChzzkVideoCache.objects.update_or_create(
                video_no=video_no,
                defaults={
                    "channel_id": channel_id,
                    "video_id": item.get("videoId") or "",
                    "title": item.get("videoTitle") or "",
                    "video_type": vtype,
                    "thumbnail_url": item.get("thumbnailImageUrl") or "",
                    "duration_seconds": int(item.get("duration") or 0),
                    "read_count": int(item.get("readCount") or 0),
                    "publish_date": publish_dt,
                    "category_type": item.get("categoryType") or "",
                    "video_category": item.get("videoCategory") or "",
                    "video_category_value": item.get("videoCategoryValue") or "",
                    "chzzk_url": f"https://chzzk.naver.com/video/{video_no}",
                    "raw_json": item,
                },
            )
            counts[vtype] += 1
            counts["total"] += 1

        if stop_flag:
            break

        total_pages = result.get("totalPages", 0)
        if total_pages > 0 and page >= total_pages - 1:
            break
        if len(items) < 24:
            break

        page += 1

    return counts


def sync_chzzk_clips(channel_id: str, incremental: bool = False) -> int:
    """
    클립 동기화 (인기순).
    incremental=True: DB 최신 클립 timestamp 이후 것만 수집
    """
    client = get_client()
    synced = 0
    clip_uid = ""
    read_count = ""
    MAX_ITER = 500

    # 증분 sync: DB에서 가장 최근 클립 timestamp 확인
    latest_ts = None
    if incremental:
        latest = ChzzkVideoCache.objects.filter(
            channel_id=channel_id, video_type="clip"
        ).order_by("-publish_date").first()
        if latest and latest.publish_date:
            latest_ts = latest.publish_date

    for _ in range(MAX_ITER):
        result = client.get_clips(
            channel_id,
            clip_uid=clip_uid,
            read_count=read_count,
            size=15,
            order_type="POPULAR",
        )
        items = result.get("data", [])

        if not items:
            break

        stop_flag = False
        for item in items:
            uid = item.get("clipUID")
            if not uid:
                continue

            publish_dt = _parse_publish_date(item.get("createdDate"))

            # 증분: 이미 있는 클립 만나면 중단
            if incremental and latest_ts and publish_dt and publish_dt <= latest_ts:
                stop_flag = True
                break

            pseudo_video_no = abs(hash(str(uid))) % (10 ** 15)

            ChzzkVideoCache.objects.update_or_create(
                video_no=pseudo_video_no,
                defaults={
                    "channel_id": channel_id,
                    "video_id": item.get("videoId") or str(uid),
                    "title": item.get("clipTitle") or "",
                    "video_type": "clip",
                    "thumbnail_url": item.get("thumbnailImageUrl") or "",
                    "duration_seconds": int(item.get("duration") or 0),
                    "read_count": int(item.get("readCount") or 0),
                    "publish_date": publish_dt,
                    "category_type": item.get("categoryType") or "",
                    "video_category": item.get("clipCategory") or "",
                    "video_category_value": item.get("clipCategory") or "",
                    "chzzk_url": f"https://chzzk.naver.com/clips/{uid}",
                    "raw_json": item,
                },
            )
            synced += 1

        if stop_flag:
            break

        if not result.get("has_more"):
            break

        clip_uid = result.get("next_clip_uid", "")
        read_count = result.get("next_read_count", "")
        if not clip_uid:
            break

    return synced


@require_GET
def api_isha_chzzk_videos_sync(request):
    staff_error = api_protection.BlockEndPoint._require_staff(request)
    if staff_error:
        return staff_error
    else:
        pass
    client = get_client()
    channel_ids = _request_channel_ids(request, client)
    channel_id = channel_ids[0] if channel_ids else ""

    if not channel_id:
        return JsonResponse(
            {"success": False, "message": "channelId 또는 CHZZK_CHANNEL_IDS 설정이 필요합니다."},
            status=400,
        )

    try:
        incremental = request.GET.get("incremental", "false").lower() == "true"
        replay_counts = sync_chzzk_videos(channel_id, incremental=incremental)
        clip_count    = sync_chzzk_clips(channel_id, incremental=incremental)
        total = replay_counts["total"] + clip_count
        return JsonResponse(
            {
                "success": True,
                "channel_id": channel_id,
                "incremental": incremental,
                "synced": {
                    "replay": replay_counts["replay"],
                    "clip": clip_count,
                    "total": total,
                },
                "message": f"{'증분' if incremental else '전체'} 동기화 완료 (다시보기 {replay_counts['replay']}개, 클립 {clip_count}개, 총 {total}개)",
            },
            status=200,
        )
    except ChzzkAPIError as exc:
        return JsonResponse({"success": False, "message": str(exc)}, status=400)


@require_GET
def api_isha_chzzk_videos(request):
    video_type = (request.GET.get("type") or "").strip().lower()
    limit_param = request.GET.get("limit")
    limit = None
    if limit_param is not None:
        try:
            limit = max(1, min(int(limit_param), 200))
        except ValueError:
            limit = None

    qs = ChzzkVideoCache.objects.all()
    if video_type in ("replay", "clip"):
        qs = qs.filter(video_type=video_type)

    qs = qs.order_by("-publish_date")
    if limit is not None:
        qs = qs[:limit]

    items = [
        {
            "video_no": v.video_no,
            "video_id": v.video_id,
            "title": v.title,
            "video_type": v.video_type,
            "thumbnail_url": v.thumbnail_url,
            "duration_seconds": v.duration_seconds,
            "read_count": v.read_count,
            "publish_date": v.publish_date.isoformat() if v.publish_date else None,
            "category_type": v.category_type,
            "video_category_value": v.video_category_value,
            "chzzk_url": v.chzzk_url,
        }
        for v in qs
    ]

    return JsonResponse({"success": True, "items": items}, status=200)