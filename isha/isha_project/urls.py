from django.urls import path
from django.urls import re_path
from . import views
from . import isha_backend
from . import api_chzzk
from . import api_youtube
from . import api_naverCafe

urlpatterns = [
    ## page render path
    path("", views.isha_main_rendering, name="isha"),

    path("register/", isha_backend.isha_userpageRender.isha_register_rendering, name="isha_register"),
    path("login/", isha_backend.isha_userpageRender.isha_login_rendering, name="isha_login"),
    path("logout/", isha_backend.isha_logout, name="isha_logout"),
    path("schedule/", views.isha_schedule_rendering, name="schedule"),

    path("news/", isha_backend.isha_userpageRender.isha_news_rendering, name="isha_news"),
    path("isha/", views.isha_intro_rendering, name="isha"),
    path("legal/", views.isha_legal_rendering, name="legal"),
    path("live/", views.isha_status_main, name="live"),

    ## auth / site api
    path("api/isha/register/", isha_backend.api_isha_register, name="api_isha_register"),
    path("api/isha/login/", isha_backend.api_isha_login, name="api_isha_login"),
    path("api/isha/change-password/", isha_backend.api_isha_change_password, name="api_isha_change_password"),

    ## news api
    path("api/isha/news/list/", isha_backend.api_isha_news_list, name="api_isha_news_list"),
    path("api/isha/news/create/", isha_backend.api_isha_news_create, name="api_isha_news_create"),
    path("api/isha/news/<int:post_id>/view/", isha_backend.api_isha_news_increase_view, name="api_isha_news_increase_view"),
    path("api/isha/news/<int:post_id>/update/", isha_backend.api_isha_news_update, name="api_isha_news_update"),
    path("api/isha/news/<int:post_id>/delete/", isha_backend.api_isha_news_delete, name="api_isha_news_delete"),

    ## schedule api
    path("api/isha/schedule/list/", isha_backend.api_isha_schedule_list, name="api_isha_schedule_list"),
    path("api/isha/schedule/create/", isha_backend.api_isha_schedule_create, name="api_isha_schedule_create"),
    path("api/isha/schedule/<int:schedule_id>/update/", isha_backend.api_isha_schedule_update, name="api_isha_schedule_update"),
    path("api/isha/schedule/<int:schedule_id>/delete/", isha_backend.api_isha_schedule_delete, name="api_isha_schedule_delete"),

    ## main preview api
    path("api/isha/main/latest-news/", isha_backend.api_isha_main_latest_news, name="api_isha_main_latest_news"),
    path("api/isha/main/upcoming-schedules/", isha_backend.api_isha_main_upcoming_schedules, name="api_isha_main_upcoming_schedules"),

    ## chzzk api
    path("api/isha/chzzk/bootstrap/", api_chzzk.api_isha_chzzk_bootstrap, name="api_isha_chzzk_bootstrap"),
    path("api/isha/chzzk/channels/", api_chzzk.api_isha_chzzk_channels, name="api_isha_chzzk_channels"),
    path("api/isha/chzzk/live-status/", api_chzzk.api_isha_chzzk_live_status, name="api_isha_chzzk_live_status"),
    path("api/isha/chzzk/videos/sync/", api_chzzk.api_isha_chzzk_videos_sync, name="api_isha_chzzk_videos_sync"),
    path("api/isha/chzzk/videos/", api_chzzk.api_isha_chzzk_videos, name="api_isha_chzzk_videos"),

    ## youtube api
    path("api/isha/youtube/bootstrap/", api_youtube.api_isha_youtube_bootstrap, name="api_isha_youtube_bootstrap"),
    path("api/isha/youtube/live-status/", api_youtube.api_isha_youtube_live_status, name="api_isha_youtube_live_status"),
    path("api/isha/youtube/sync/", api_youtube.api_isha_youtube_sync, name="api_isha_youtube_sync"),
    path("api/isha/youtube/videos/", api_youtube.api_isha_youtube_videos, name="api_isha_youtube_videos"),
    path("api/isha/youtube/channel-stats/", api_youtube.api_isha_youtube_channel_stats, name="api_isha_youtube_channel_stats"),

    ## naver cafe api
    path("api/isha/cafe/sync/", api_naverCafe.api_isha_cafe_sync, name="api_isha_cafe_sync"),
    path("api/isha/cafe/posts/", api_naverCafe.api_isha_cafe_posts, name="api_isha_cafe_posts"),

    ## contact api
    path("contact/", views.isha_contact_rendering, name="isha_contact"),
    path("api/isha/contact/list/", isha_backend.api_isha_contact_list, name="api_isha_contact_list"),
    path("api/isha/contact/create/", isha_backend.api_isha_contact_create, name="api_isha_contact_create"),
    path("api/isha/contact/<int:post_id>/", isha_backend.api_isha_contact_detail, name="api_isha_contact_detail"),
    path("api/isha/contact/<int:post_id>/reply/", isha_backend.api_isha_contact_reply, name="api_isha_contact_reply"),
    path("api/isha/contact/<int:post_id>/delete/", isha_backend.api_isha_contact_delete, name="api_isha_contact_delete"),

    ## other url path
    re_path(r'^(?!api/).*$', views.isha_main_rendering),
]