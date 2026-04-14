import os
import re
from datetime import timedelta
from typing import Any

import requests
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from .models import YouTubeChannelCache, YouTubeLiveCache, YouTubeVideoCache
from . import api_protection

from django.conf import settings

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
DEFAULT_YOUTUBE_HANDLE = "@ishawaddo"


class YouTubeServiceError(Exception):
    pass
 
def _get_api_key() -> str:
    api_key = getattr(settings, "YOUTUBE_API_KEY", "").strip()
    if not api_key:
        raise YouTubeServiceError("YOUTUBE_API_KEY가 .env에 설정되어 있지 않습니다.")
    return api_key


def _api_get(path: str, params: dict[str, Any]) -> dict[str, Any]:
    merged = {**params, "key": _get_api_key()}
    resp = requests.get(f"{YOUTUBE_API_BASE}/{path}", params=merged, timeout=15)

    if not resp.ok:
        raise YouTubeServiceError(f"YouTube API 호출 실패: {resp.status_code} / {resp.text}")

    return resp.json()


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_iso8601_duration_to_seconds(duration: str) -> int:
    if not duration:
        return 0

    pattern = re.compile(
        r"^P"
        r"(?:(?P<days>\d+)D)?"
        r"(?:T"
        r"(?:(?P<hours>\d+)H)?"
        r"(?:(?P<minutes>\d+)M)?"
        r"(?:(?P<seconds>\d+)S)?"
        r")?$"
    )
    match = pattern.match(duration)
    if not match:
        return 0

    days = _safe_int(match.group("days"))
    hours = _safe_int(match.group("hours"))
    minutes = _safe_int(match.group("minutes"))
    seconds = _safe_int(match.group("seconds"))

    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def _pick_thumbnail(thumbnails: dict) -> str:
    return (
        thumbnails.get("maxres", {}).get("url", "")
        or thumbnails.get("standard", {}).get("url", "")
        or thumbnails.get("high", {}).get("url", "")
        or thumbnails.get("medium", {}).get("url", "")
        or thumbnails.get("default", {}).get("url", "")
    )


def resolve_channel_by_handle(handle: str = DEFAULT_YOUTUBE_HANDLE) -> YouTubeChannelCache:
    normalized_handle = handle.lstrip("@")

    payload = _api_get(
        "channels",
        {
            "part": "snippet,contentDetails,statistics",
            "forHandle": normalized_handle,
            "maxResults": 1,
        },
    )

    items = payload.get("items", [])
    if not items:
        raise YouTubeServiceError("유튜브 채널을 찾을 수 없습니다.")

    item = items[0]
    snippet = item.get("snippet", {})
    content_details = item.get("contentDetails", {})
    statistics = item.get("statistics", {})
    uploads_playlist_id = content_details.get("relatedPlaylists", {}).get("uploads", "")

    obj, _ = YouTubeChannelCache.objects.update_or_create(
        channel_id=item["id"],
        defaults={
            "handle": f"@{normalized_handle}",
            "title": snippet.get("title", ""),
            "uploads_playlist_id": uploads_playlist_id,
            "thumbnail_url": _pick_thumbnail(snippet.get("thumbnails", {})),
            "subscriber_count": _safe_int(statistics.get("subscriberCount", 0)),
            "raw_json": item,
        },
    )
    return obj


def get_live_status(channel_id: str, ttl_seconds: int = 30) -> YouTubeLiveCache:
    now = timezone.now()
    cache_obj, _ = YouTubeLiveCache.objects.get_or_create(channel_id=channel_id)

    if cache_obj.expires_at and cache_obj.expires_at > now:
        return cache_obj

    payload = _api_get(
        "search",
        {
            "part": "snippet",
            "channelId": channel_id,
            "type": "video",
            "eventType": "live",
            "maxResults": 1,
        },
    )

    items = payload.get("items", [])
    if items:
        item = items[0]
        snippet = item.get("snippet", {})
        video_id = item.get("id", {}).get("videoId", "")

        published_at = snippet.get("publishedAt")
        published_dt = timezone.datetime.fromisoformat(
            published_at.replace("Z", "+00:00")
        ) if published_at else None

        cache_obj.is_live = True
        cache_obj.video_id = video_id
        cache_obj.title = snippet.get("title", "")
        cache_obj.thumbnail_url = _pick_thumbnail(snippet.get("thumbnails", {}))
        cache_obj.published_at = published_dt
        cache_obj.viewer_count = 0
        cache_obj.raw_json = item
    else:
        cache_obj.is_live = False
        cache_obj.video_id = ""
        cache_obj.title = ""
        cache_obj.thumbnail_url = ""
        cache_obj.published_at = None
        cache_obj.viewer_count = 0
        cache_obj.raw_json = {}

    cache_obj.expires_at = now + timedelta(seconds=ttl_seconds)
    cache_obj.save()
    return cache_obj


def sync_uploads(channel: YouTubeChannelCache, max_results: int = 50, incremental: bool = False) -> int:
    if not channel.uploads_playlist_id:
        raise YouTubeServiceError("uploads playlist id가 없습니다.")

    # 증분 sync: DB에서 가장 최근 published_at 확인
    latest_dt = None
    if incremental:
        latest = YouTubeVideoCache.objects.filter(
            channel_id=channel.channel_id
        ).order_by("-published_at").first()
        if latest and latest.published_at:
            latest_dt = latest.published_at

    payload = _api_get(
        "playlistItems",
        {
            "part": "snippet,contentDetails",
            "playlistId": channel.uploads_playlist_id,
            "maxResults": max_results,
        },
    )

    items = payload.get("items", [])
    video_ids = []

    for item in items:
        video_id = item.get("contentDetails", {}).get("videoId")
        if video_id:
            video_ids.append(video_id)

    if not video_ids:
        return 0

    videos_payload = _api_get(
        "videos",
        {
            "part": "snippet,contentDetails,liveStreamingDetails,statistics,status",
            "id": ",".join(video_ids),
            "maxResults": len(video_ids),
        },
    )

    video_map = {item["id"]: item for item in videos_payload.get("items", [])}
    synced = 0

    for playlist_item in items:
        video_id = playlist_item.get("contentDetails", {}).get("videoId")
        video = video_map.get(video_id)
        if not video:
            continue

        snippet = video.get("snippet", {})

        # 증분 sync: 이미 있는 영상이면 중단
        if incremental and latest_dt:
            published_at_str = snippet.get("publishedAt")
            if published_at_str:
                pub_dt = timezone.datetime.fromisoformat(published_at_str.replace("Z", "+00:00"))
                if pub_dt <= latest_dt:
                    break
        stats = video.get("statistics", {})
        details = video.get("contentDetails", {})
        live_details = video.get("liveStreamingDetails", {})

        duration_seconds = _parse_iso8601_duration_to_seconds(details.get("duration", "PT0S"))
        title = snippet.get("title", "")
        description = snippet.get("description", "")
        lowered_title = title.lower()
        lowered_desc = description.lower()
        MUSIC_KEYWORDS = [
            # 커버
            "cover", "커버", "커버곡",
            # 오리지널
            "original", "original song",
            "오리지널", "오리지날",
            "오리지널 곡", "오리지날 곡",
            # 그 외 음악 관련
            "mv", "m/v", "music video",
            "뮤직비디오", "뮤비",
            "노래", "음악",
            "feat.", "feat ", "ft.", "ft ",
        ]

        is_music = any(kw in lowered_title or kw in lowered_desc for kw in MUSIC_KEYWORDS)

        # ── 분류 우선순위: music > short > video ─────────────────
        if is_music:
            video_type = "music"
        elif duration_seconds <= 60:
            video_type = "short"
        else:
            video_type = "video"

        published_at = snippet.get("publishedAt")
        published_dt = timezone.datetime.fromisoformat(
            published_at.replace("Z", "+00:00")
        ) if published_at else None

        YouTubeVideoCache.objects.update_or_create(
            video_id=video_id,
            defaults={
                "channel_id": channel.channel_id,
                "title": title,
                "description": description,
                "thumbnail_url": _pick_thumbnail(snippet.get("thumbnails", {})),
                "published_at": published_dt,
                "duration_seconds": duration_seconds,
                "view_count": _safe_int(stats.get("viewCount")),
                "like_count": _safe_int(stats.get("likeCount")),
                "comment_count": _safe_int(stats.get("commentCount")),
                "video_type": video_type,
                "is_live_content": bool(live_details),
                "is_upcoming": (snippet.get("liveBroadcastContent", "") == "upcoming"),
                "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
                "raw_json": video,
            },
        )
        synced += 1

    return synced


@require_GET
def api_isha_youtube_channel_stats(request):
    channel = YouTubeChannelCache.objects.first()
    if not channel:
        return JsonResponse(
            {"result": "fail", "message": "YouTube 채널이 아직 초기화되지 않았습니다."},
            status=404,
        )
    return JsonResponse(
        {
            "result": "success",
            "channel": {
                "channel_id": channel.channel_id,
                "handle": channel.handle,
                "title": channel.title,
                "thumbnail_url": channel.thumbnail_url,
                "subscriber_count": channel.subscriber_count,
                "updated_at": channel.updated_at.isoformat(),
            },
        },
        status=200,
    )


@require_GET
def api_isha_youtube_bootstrap(request):
    try:
        channel = resolve_channel_by_handle(DEFAULT_YOUTUBE_HANDLE)
        synced_count = sync_uploads(channel, max_results=50)
        live_cache = get_live_status(channel.channel_id, ttl_seconds=30)

        return JsonResponse(
            {
                "result": "success",
                "channel": {
                    "channel_id": channel.channel_id,
                    "handle": channel.handle,
                    "title": channel.title,
                    "uploads_playlist_id": channel.uploads_playlist_id,
                    "thumbnail_url": channel.thumbnail_url,
                },
                "synced_count": synced_count,
                "live": {
                    "is_live": live_cache.is_live,
                    "video_id": live_cache.video_id,
                    "title": live_cache.title,
                    "thumbnail_url": live_cache.thumbnail_url,
                },
            },
            status=200,
        )
    except YouTubeServiceError as e:
        return JsonResponse({"result": "fail", "message": str(e)}, status=400)


@require_GET
def api_isha_youtube_live_status(request):
    channel = YouTubeChannelCache.objects.first()
    if not channel:
        return JsonResponse(
            {"result": "fail", "message": "YouTube 채널이 아직 초기화되지 않았습니다."},
            status=404,
        )

    try:
        live_cache = get_live_status(channel.channel_id, ttl_seconds=30)
        return JsonResponse(
            {
                "result": "success",
                "item": {
                    "is_live": live_cache.is_live,
                    "video_id": live_cache.video_id,
                    "title": live_cache.title,
                    "thumbnail_url": live_cache.thumbnail_url,
                    "viewer_count": live_cache.viewer_count,
                    "published_at": live_cache.published_at.isoformat() if live_cache.published_at else None,
                },
            },
            status=200,
        )
    except YouTubeServiceError as e:
        return JsonResponse({"result": "fail", "message": str(e)}, status=400)


@require_GET
def api_isha_youtube_sync(request):
    channel = YouTubeChannelCache.objects.first()
    if not channel:
        return JsonResponse(
            {"result": "fail", "message": "YouTube 채널이 아직 초기화되지 않았습니다."},
            status=404,
        )

    try:
        max_results = _safe_int(request.GET.get("limit", 50), 50)
        max_results = max(1, min(max_results, 50))
        incremental = request.GET.get("incremental", "false").lower() == "true"
        synced_count = sync_uploads(channel, max_results=max_results, incremental=incremental)

        return JsonResponse(
            {
                "result": "success",
                "synced_count": synced_count,
                "incremental": incremental,
                "message": f"유튜브 업로드 캐시 {'증분' if incremental else '전체'} 동기화 완료",
            },
            status=200,
        )
    except YouTubeServiceError as e:
        return JsonResponse({"result": "fail", "message": str(e)}, status=400)


@require_GET
def api_isha_youtube_videos(request):
    video_type = (request.GET.get("type") or "").strip()

    limit_param = request.GET.get("limit")
    limit = None
    if limit_param is not None:
        limit = _safe_int(limit_param, 0)
        limit = max(1, min(limit, 200)) if limit > 0 else None

    qs = YouTubeVideoCache.objects.all()
    if video_type:
        qs = qs.filter(video_type=video_type)

    qs = qs.order_by("-published_at")
    if limit is not None:
        qs = qs[:limit]

    items = [
        {
            "video_id": item.video_id,
            "title": item.title,
            "description": item.description,
            "thumbnail_url": item.thumbnail_url,
            "published_at": item.published_at.isoformat() if item.published_at else None,
            "duration_seconds": item.duration_seconds,
            "view_count": item.view_count,
            "like_count": item.like_count,
            "comment_count": item.comment_count,
            "video_type": item.video_type,
            "youtube_url": item.youtube_url,
        }
        for item in qs
    ]

    return JsonResponse({"result": "success", "items": items}, status=200)