from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone


class UserModelManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        if not username:
            raise ValueError("아이디는 필수입니다.")
        if not email:
            raise ValueError("이메일은 필수입니다.")

        email = self.normalize_email(email)
        username = username.strip()

        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("isStaff", False)
        extra_fields.setdefault("is_staff", False)

        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault("isStaff", True)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("슈퍼유저는 is_staff=True 여야 합니다.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("슈퍼유저는 is_superuser=True 여야 합니다.")

        return self.create_user(username, email, password, **extra_fields)


class UserModel(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(max_length=20, verbose_name="유저아이디", unique=True)
    email = models.EmailField(max_length=350, verbose_name="유저이메일", unique=True)
    nickname = models.CharField(max_length=30, verbose_name="유저닉네임", blank=True, default="")
    password = models.CharField(max_length=128, db_column="passwd", verbose_name="유저비밀번호(Hash)")
    isStaff = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="가입일")
    last_login = models.DateTimeField(null=True, blank=True, verbose_name="마지막 로그인 시각")

    objects = UserModelManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        db_table = "user_panel"
        verbose_name = "일반 유저"
        verbose_name_plural = "일반 유저 목록"

    def __str__(self):
        return self.username


class AdminPanel(models.Model):
    admin_user = models.CharField(max_length=50, verbose_name="AdminUsername", unique=True)
    admin_passwd = models.CharField(max_length=128, verbose_name="AdminUserpasswd")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="가입일")
    last_login = models.DateTimeField(null=True, blank=True, verbose_name="마지막 로그인")

    class Meta:
        db_table = "admin_panel"
        verbose_name = "어드민 유저"
        verbose_name_plural = "어드민 유저 목록"

    def __str__(self):
        return self.admin_user


class NewsPost(models.Model):
    CATEGORY_CHOICES = [
        ("notice", "공지사항"),
        ("update", "업데이트"),
        ("schedule", "일정"),
        ("archive", "아카이브"),
        ("important", "중요"),
    ]

    author = models.ForeignKey(
        UserModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="news_posts",
        verbose_name="작성자",
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="notice", verbose_name="카테고리")
    title = models.CharField(max_length=200, verbose_name="제목")
    summary = models.CharField(max_length=300, blank=True, default="", verbose_name="추가 내용")
    is_pinned = models.BooleanField(default=False, verbose_name="고정 공지")
    views = models.PositiveIntegerField(default=0, verbose_name="조회수")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="작성일")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="수정일")

    class Meta:
        db_table = "news_post"
        verbose_name = "게시글"
        verbose_name_plural = "게시글 목록"
        ordering = ["-is_pinned", "-created_at"]

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title}"

    @property
    def is_new(self):
        return (timezone.now() - self.created_at).days < 7


class NewsBlock(models.Model):
    BLOCK_TYPE_CHOICES = [
        ("text", "텍스트"),
        ("image", "이미지"),
    ]

    post = models.ForeignKey(
        NewsPost,
        on_delete=models.CASCADE,
        related_name="blocks",
        verbose_name="게시글",
    )
    block_type = models.CharField(max_length=10, choices=BLOCK_TYPE_CHOICES, verbose_name="블록 타입")
    content = models.TextField(blank=True, default="", verbose_name="텍스트 내용")
    image = models.ImageField(upload_to="news/images/%Y/%m/", blank=True, null=True, verbose_name="이미지")
    caption = models.CharField(max_length=255, blank=True, default="", verbose_name="이미지 설명")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="정렬 순서")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "news_block"
        verbose_name = "게시글 블록"
        verbose_name_plural = "게시글 블록 목록"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.post.title} / {self.block_type} / {self.sort_order}"


class IshaSchedule(models.Model):
    COLOR_CHOICES = [
        ("white", "화이트"),
        ("blue", "블루"),
        ("sky", "스카이"),
        ("silver", "실버"),
        ("soft", "소프트"),
    ]

    title = models.CharField(max_length=200, verbose_name="일정 제목")
    subtitle = models.CharField(max_length=200, blank=True, default="", verbose_name="부제목")
    schedule_date = models.DateField(verbose_name="일정 날짜")
    start_time = models.TimeField(verbose_name="시작 시간")
    end_time = models.TimeField(null=True, blank=True, verbose_name="종료 시간")
    color = models.CharField(max_length=20, choices=COLOR_CHOICES, default="blue", verbose_name="카드 색상")
    image = models.ImageField(upload_to="schedule/isha/%Y/%m/", blank=True, null=True, verbose_name="이미지")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="정렬 순서")
    created_by = models.ForeignKey(
        UserModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_isha_schedules",
        verbose_name="작성자",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "isha_schedule"
        verbose_name = "이샤 일정"
        verbose_name_plural = "이샤 일정 목록"
        ordering = ["schedule_date", "sort_order", "start_time", "id"]

    def __str__(self):
        return f"{self.schedule_date} / {self.title}"


class YouTubeChannelCache(models.Model):
    platform = models.CharField(max_length=20, default="youtube")
    channel_id = models.CharField(max_length=128, unique=True)
    handle = models.CharField(max_length=128, blank=True)
    title = models.CharField(max_length=255, blank=True)
    uploads_playlist_id = models.CharField(max_length=128, blank=True)
    thumbnail_url = models.URLField(blank=True)
    subscriber_count = models.BigIntegerField(default=0, verbose_name="구독자 수")
    raw_json = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "youtube_channel_cache"
        verbose_name = "유튜브 채널 캐시"
        verbose_name_plural = "유튜브 채널 캐시 목록"

    def __str__(self):
        return self.title or self.channel_id


class YouTubeLiveCache(models.Model):
    channel_id = models.CharField(max_length=128, unique=True)
    is_live = models.BooleanField(default=False)
    video_id = models.CharField(max_length=128, blank=True)
    title = models.CharField(max_length=255, blank=True)
    thumbnail_url = models.URLField(blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    viewer_count = models.PositiveIntegerField(default=0)
    raw_json = models.JSONField(default=dict, blank=True)
    fetched_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "youtube_live_cache"
        verbose_name = "유튜브 라이브 캐시"
        verbose_name_plural = "유튜브 라이브 캐시 목록"

    def __str__(self):
        return f"{self.channel_id} / {'LIVE' if self.is_live else 'OFFLINE'}"


class YouTubeVideoCache(models.Model):
    VIDEO_TYPE_CHOICES = (
        ("video", "일반 영상"),
        ("short", "쇼츠"),
        ("music", "노래"),
    )

    channel_id = models.CharField(max_length=128, db_index=True)
    video_id = models.CharField(max_length=128, unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    thumbnail_url = models.URLField(blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    view_count = models.BigIntegerField(default=0)
    like_count = models.BigIntegerField(default=0)
    comment_count = models.BigIntegerField(default=0)
    video_type = models.CharField(max_length=20, choices=VIDEO_TYPE_CHOICES, default="video")
    is_live_content = models.BooleanField(default=False)
    is_upcoming = models.BooleanField(default=False)
    youtube_url = models.URLField(blank=True)
    raw_json = models.JSONField(default=dict, blank=True)
    last_synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "youtube_video_cache"
        verbose_name = "유튜브 영상 캐시"
        verbose_name_plural = "유튜브 영상 캐시 목록"
        ordering = ("-published_at", "-id")

    def __str__(self):
        return self.title

class ChzzkVideoCache(models.Model):
    VIDEO_TYPE_CHOICES = (
        ("replay", "다시보기"),
        ("clip", "클립"),
    )

    channel_id = models.CharField(max_length=128, db_index=True, verbose_name="채널 ID")
    video_no = models.BigIntegerField(unique=True, verbose_name="영상 번호")
    video_id = models.CharField(max_length=128, blank=True, verbose_name="영상 ID")
    title = models.CharField(max_length=255, verbose_name="제목")
    video_type = models.CharField(max_length=20, choices=VIDEO_TYPE_CHOICES, default="replay", verbose_name="영상 타입")
    thumbnail_url = models.URLField(blank=True, verbose_name="썸네일 URL")
    duration_seconds = models.PositiveIntegerField(default=0, verbose_name="재생 시간(초)")
    read_count = models.BigIntegerField(default=0, verbose_name="조회수")
    publish_date = models.DateTimeField(null=True, blank=True, verbose_name="업로드 일시")
    category_type = models.CharField(max_length=50, blank=True, verbose_name="카테고리 타입")
    video_category = models.CharField(max_length=100, blank=True, verbose_name="카테고리")
    video_category_value = models.CharField(max_length=100, blank=True, verbose_name="카테고리명")
    chzzk_url = models.URLField(blank=True, verbose_name="치지직 URL")
    raw_json = models.JSONField(default=dict, blank=True)
    last_synced_at = models.DateTimeField(auto_now=True, verbose_name="마지막 동기화")

    class Meta:
        db_table = "chzzk_video_cache"
        verbose_name = "치지직 영상 캐시"
        verbose_name_plural = "치지직 영상 캐시 목록"
        ordering = ("-publish_date", "-video_no")

    def __str__(self):
        return f"[{self.get_video_type_display()}] {self.title}"

class NaverCafePostCache(models.Model):
    BOARD_TYPE_CHOICES = (
        ("notice", "공지"),
        ("community", "커뮤니티"),
    )

    club_id = models.IntegerField(verbose_name="카페 ID", db_index=True)
    menu_id = models.IntegerField(verbose_name="게시판 ID", db_index=True)
    article_id = models.BigIntegerField(unique=True, verbose_name="게시글 ID")
    board_type = models.CharField(max_length=20, choices=BOARD_TYPE_CHOICES, default="community", verbose_name="게시판 타입")
    subject = models.CharField(max_length=500, blank=True, verbose_name="제목")
    writer_nickname = models.CharField(max_length=100, blank=True, verbose_name="작성자")
    read_count = models.PositiveIntegerField(default=0, verbose_name="조회수")
    comment_count = models.PositiveIntegerField(default=0, verbose_name="댓글수")
    like_it_count = models.PositiveIntegerField(default=0, verbose_name="좋아요수")
    write_date_timestamp = models.BigIntegerField(default=0, verbose_name="작성시각(ms)")
    thumbnail_url = models.URLField(blank=True, verbose_name="썸네일")
    cafe_url = models.URLField(blank=True, verbose_name="카페 URL")
    raw_json = models.JSONField(default=dict, blank=True)
    last_synced_at = models.DateTimeField(auto_now=True, verbose_name="마지막 동기화")

    class Meta:
        db_table = "naver_cafe_post_cache"
        verbose_name = "네이버 카페 게시글 캐시"
        verbose_name_plural = "네이버 카페 게시글 캐시 목록"
        ordering = ("-write_date_timestamp",)

    def __str__(self):
        return f"[{self.get_board_type_display()}] {self.subject}"

class ContactPost(models.Model):
    STATUS_CHOICES = [
        ("pending", "답변 대기"),
        ("answered", "답변 완료"),
        ("closed", "종료"),
    ]

    author = models.ForeignKey(
        UserModel,
        on_delete=models.CASCADE,
        related_name="contact_posts",
        verbose_name="작성자",
    )
    title = models.CharField(max_length=200, verbose_name="제목")
    content = models.TextField(verbose_name="문의 내용")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending", verbose_name="처리 상태"
    )
    admin_reply = models.TextField(blank=True, default="", verbose_name="관리자 답변")
    is_private = models.BooleanField(default=True, verbose_name="비공개")
    views = models.PositiveIntegerField(default=0, verbose_name="조회수")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="작성일")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="수정일")

    class Meta:
        db_table = "contact_post"
        verbose_name = "문의사항"
        verbose_name_plural = "문의사항 목록"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.get_status_display()}] {self.title} — {self.author.username}"