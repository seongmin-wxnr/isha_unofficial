"""
APScheduler 기반 자동 동기화 스케줄러.
apps.py의 ready()에서 한 번만 시작됩니다.
"""
from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from django.conf import settings
_scheduler: BackgroundScheduler | None = None

def _job_sync_youtube() -> None:
    try:
        from .models import YouTubeChannelCache
        from .api_youtube import sync_uploads, resolve_channel_by_handle

        channel = YouTubeChannelCache.objects.first()
        if not channel:
            # 채널 정보 없으면 bootstrap 먼저 실행
            print("[Scheduler] youtube channel -> None")
            channel = resolve_channel_by_handle()

        count = sync_uploads(channel, max_results=10, incremental=True)
        print(f"[Scheduler] youtube sync -> {count}")
    except Exception as e:
        print(f"[Scheduler] youtube sync error: {e}")


def _job_sync_chzzk() -> None:
    try:
        from decouple import config
        from .api_chzzk import sync_chzzk_videos, sync_chzzk_clips

        raw_ids = config("CHZZK_CHANNEL_IDS", default="").strip()
        channel_ids = [i.strip() for i in raw_ids.split(",") if i.strip()]
        if not channel_ids:
            print("[Scheduler] CHZZK_CHANNEL_IDS -> None")
            return

        channel_id = channel_ids[0]
        replay = sync_chzzk_videos(channel_id, incremental=True)
        clips  = sync_chzzk_clips(channel_id, incremental=True)
        print(f"[Scheduler] chzzk sync -> rep : {replay['total']}, clip {clips}")
    except Exception as e:
        print(f"[Scheduler] chzzk sync error: {e}")


def _job_sync_cafe() -> None:
    try:
        from .api_naverCafe import sync_cafe_posts, MENU_NOTICE, MENU_COMMUNITY

        n = sync_cafe_posts(menu_id=MENU_NOTICE,    board_type="notice",    pages=1, per_page=10, incremental=True)
        c = sync_cafe_posts(menu_id=MENU_COMMUNITY, board_type="community", pages=2, per_page=15, incremental=True)
        print(f"[Scheduler] naver cafe sync -> ans {n}, post {c}")
    except Exception as e:
        print(f"[Scheduler] naver cafe sync error: {e}")


def _job_sync_all() -> None:
    print("[Scheduler] all sync")
    _job_sync_youtube()
    _job_sync_chzzk()
    _job_sync_cafe()
    print("[Scheduler] success")


def start() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    interval_minutes: int = getattr(settings, "SYNC_INTERVAL_MINUTES", 15)

    _scheduler = BackgroundScheduler(timezone="Asia/Seoul")

    _scheduler.add_job(
        _job_sync_all,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="sync_all",
        replace_existing=True,
        misfire_grace_time=120,
        max_instances=1, 
    )

    _scheduler.start()
    print(f"[Scheduler] start -> {interval_minutes} auto sync")
    
    _job_sync_all()


def stop() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        print("[Scheduler] exit()")