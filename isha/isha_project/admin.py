from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    AdminPanel,
    NewsPost,
    NewsBlock,
    UserModel,
    IshaSchedule,
    YouTubeChannelCache,
    YouTubeLiveCache,
    YouTubeVideoCache,
    ChzzkVideoCache,
    NaverCafePostCache,
    ContactPost,
)


@admin.register(UserModel)
class UserModelAdmin(UserAdmin):
    model = UserModel
    ordering = ("-created_at",)
    list_display = (
        "username",
        "email",
        "nickname",
        "isStaff",
        "is_staff",
        "is_active",
        "created_at",
        "last_login",
    )
    list_filter = ("isStaff", "is_staff", "is_active", "is_superuser")
    search_fields = ("username", "email", "nickname")

    fieldsets = (
        (None, {"fields": ("username", "email", "password")}),
        ("추가 정보", {"fields": ("nickname",)}),
        ("권한", {"fields": ("isStaff", "is_staff", "is_active", "is_superuser", "groups", "user_permissions")}),
        ("기록", {"fields": ("last_login", "created_at")}),
    )
    readonly_fields = ("created_at", "last_login")

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "nickname",
                    "password1",
                    "password2",
                    "isStaff",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )


@admin.register(AdminPanel)
class AdminPanelAdmin(admin.ModelAdmin):
    list_display = ("admin_user", "created_at", "last_login")
    search_fields = ("admin_user",)


class NewsBlockInline(admin.TabularInline):
    model = NewsBlock
    extra = 1
    fields = ("block_type", "content", "image", "caption", "sort_order")
    ordering = ("sort_order",)


@admin.register(NewsPost)
class NewsPostAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "category",
        "author",
        "is_pinned",
        "views",
        "created_at",
        "updated_at",
    )
    list_filter = ("category", "is_pinned", "created_at", "updated_at")
    search_fields = ("title", "summary", "blocks__content", "author__username")
    inlines = [NewsBlockInline]


@admin.register(IshaSchedule)
class IshaScheduleAdmin(admin.ModelAdmin):
    list_display = (
        "schedule_date",
        "title",
        "start_time",
        "end_time",
        "color",
        "sort_order",
        "created_by",
    )
    list_filter = ("schedule_date", "color")
    search_fields = ("title", "subtitle", "created_by__username")
    ordering = ("schedule_date", "sort_order", "start_time")


@admin.register(YouTubeChannelCache)
class YouTubeChannelCacheAdmin(admin.ModelAdmin):
    list_display = ("title", "handle", "channel_id", "uploads_playlist_id", "updated_at")
    search_fields = ("title", "handle", "channel_id")
    readonly_fields = ("raw_json", "updated_at")


@admin.register(YouTubeLiveCache)
class YouTubeLiveCacheAdmin(admin.ModelAdmin):
    list_display = ("channel_id", "is_live", "title", "video_id", "fetched_at", "expires_at")
    search_fields = ("channel_id", "title", "video_id")
    list_filter = ("is_live",)
    readonly_fields = ("raw_json", "fetched_at")


@admin.register(YouTubeVideoCache)
class YouTubeVideoCacheAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "video_type",
        "channel_id",
        "video_id",
        "published_at",
        "view_count",
        "last_synced_at",
    )
    search_fields = ("title", "video_id", "channel_id")
    list_filter = ("video_type", "is_live_content", "is_upcoming")
    readonly_fields = ("raw_json", "last_synced_at")

@admin.register(ChzzkVideoCache)
class ChzzkVideoCacheAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "video_type",
        "channel_id",
        "video_no",
        "read_count",
        "publish_date",
        "last_synced_at",
    )
    search_fields = ("title", "video_id", "channel_id")
    list_filter = ("video_type", "category_type")
    readonly_fields = ("raw_json", "last_synced_at")
    ordering = ("-publish_date",)

@admin.register(NaverCafePostCache)
class NaverCafePostCacheAdmin(admin.ModelAdmin):
    list_display = (
        "subject", "board_type", "writer_nickname",
        "read_count", "comment_count", "like_it_count",
        "article_id", "last_synced_at",
    )
    search_fields = ("subject", "writer_nickname")
    list_filter = ("board_type",)
    readonly_fields = ("raw_json", "last_synced_at")
    ordering = ("-write_date_timestamp",)

@admin.register(ContactPost)
class ContactPostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "status", "is_private", "views", "created_at")
    search_fields = ("title", "content", "author__username")
    list_filter = ("status", "is_private")
    readonly_fields = ("created_at", "updated_at", "views")
    ordering = ("-created_at",)