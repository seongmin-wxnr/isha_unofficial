from datetime import datetime, timedelta
import json

from django.contrib import messages
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import redirect, render, get_object_or_404
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from .models import UserModel, NewsPost, NewsBlock, IshaSchedule


class isha_userpageRender:
    @staticmethod
    @csrf_protect
    def isha_register_rendering(request):
        if request.method == "GET":
            return render(request, "main/auth/isha_register.html")

        username = (request.POST.get("username") or "").strip()
        email = (request.POST.get("email") or "").strip().lower()
        nickname = (request.POST.get("nickname") or "").strip()
        password1 = request.POST.get("password1") or ""
        password2 = request.POST.get("password2") or ""
        agree = request.POST.get("agree")

        context = {
            "saved_username": username,
            "saved_email": email,
            "saved_nickname": nickname,
        }

        if not username or not email or not password1 or not password2:
            messages.error(request, "필수 항목을 모두 입력해주세요.")
            return render(request, "main/auth/isha_register.html", context)

        if not agree:
            messages.error(request, "이용 안내 및 개인정보 처리 동의가 필요합니다.")
            return render(request, "main/auth/isha_register.html", context)

        if len(username) < 4 or len(username) > 20:
            messages.error(request, "아이디는 4자 이상 20자 이하로 입력해주세요.")
            return render(request, "main/auth/isha_register.html", context)

        if password1 != password2:
            messages.error(request, "비밀번호 확인이 일치하지 않습니다.")
            return render(request, "main/auth/isha_register.html", context)

        if UserModel.objects.filter(username=username).exists():
            messages.error(request, "이미 사용 중인 아이디입니다.")
            return render(request, "main/auth/isha_register.html", context)

        if UserModel.objects.filter(email__iexact=email).exists():
            messages.error(request, "이미 사용 중인 이메일입니다.")
            return render(request, "main/auth/isha_register.html", context)

        try:
            temp_user = UserModel(username=username, email=email, nickname=nickname)
            validate_password(password1, user=temp_user)
        except ValidationError as e:
            messages.error(request, e.messages[0])
            return render(request, "main/auth/isha_register.html", context)

        try:
            user = UserModel.objects.create_user(
                username=username,
                email=email,
                nickname=nickname,
                password=password1,
            )
        except IntegrityError:
            messages.error(request, "회원가입 처리 중 중복 데이터가 감지되었습니다.")
            return render(request, "main/auth/isha_register.html", context)

        login(request, user)
        messages.success(request, "회원가입이 완료되었습니다.")
        return redirect("/")

    @staticmethod
    @csrf_protect
    def isha_login_rendering(request):
        if request.method == "GET":
            return render(request, "main/auth/isha_login.html")

        username_or_email = (request.POST.get("username") or "").strip()
        passwd = request.POST.get("password") or ""
        remember_me = request.POST.get("remember_me")

        context = {
            "saved_username": username_or_email,
        }

        if not username_or_email or not passwd:
            messages.error(request, "아이디(또는 이메일)와 비밀번호를 모두 입력해주세요.")
            return render(request, "main/auth/isha_login.html", context)

        user_obj = UserModel.objects.filter(
            Q(username=username_or_email) | Q(email__iexact=username_or_email)
        ).first()

        if not user_obj:
            messages.error(request, "존재하지 않는 계정입니다.")
            return render(request, "main/auth/isha_login.html", context)

        user = authenticate(request, username=user_obj.username, password=passwd)
        if user is None:
            messages.error(request, "비밀번호가 올바르지 않습니다.")
            return render(request, "main/auth/isha_login.html", context)

        if not user.is_active:
            messages.error(request, "비활성화된 계정입니다.")
            return render(request, "main/auth/isha_login.html", context)

        login(request, user)

        if not remember_me:
            request.session.set_expiry(0)

        messages.success(request, "로그인에 성공했습니다.")
        return redirect("/")

    @staticmethod
    def isha_news_rendering(request):
        return render(request, "main/isha_news.html")


def _json_fail(message, status=400):
    return JsonResponse({"result": "fail", "message": message}, status=status)


def _require_staff(request):
    if not request.user.is_authenticated or not request.user.isStaff:
        return _json_fail("관리자 권한이 필요합니다.", 403)
    return None


def isha_logout(request):
    logout(request)
    return redirect("/")


@csrf_protect
@require_http_methods(["POST"])
def api_isha_login(request):
    username_or_email = (request.POST.get("username") or "").strip()
    passwd = request.POST.get("password") or ""
    remember_me = request.POST.get("remember_me")

    if not username_or_email or not passwd:
        return _json_fail("아이디(또는 이메일)와 비밀번호를 모두 입력해주세요.")

    user_obj = UserModel.objects.filter(
        Q(username=username_or_email) | Q(email__iexact=username_or_email)
    ).first()

    if not user_obj:
        return _json_fail("존재하지 않는 계정입니다.", 404)

    user = authenticate(request, username=user_obj.username, password=passwd)
    if user is None:
        return _json_fail("비밀번호가 올바르지 않습니다.", 401)

    if not user.is_active:
        return _json_fail("비활성화된 계정입니다.", 403)

    login(request, user)

    if not remember_me:
        request.session.set_expiry(0)

    return JsonResponse(
        {
            "result": "success",
            "message": "로그인에 성공했습니다.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "nickname": user.nickname,
                "isStaff": user.isStaff,
            },
        },
        status=200,
    )


@csrf_protect
@require_http_methods(["POST"])
def api_isha_register(request):
    username = (request.POST.get("username") or "").strip()
    email = (request.POST.get("email") or "").strip().lower()
    nickname = (request.POST.get("nickname") or "").strip()
    password1 = request.POST.get("password1") or ""
    password2 = request.POST.get("password2") or ""
    agree = request.POST.get("agree")

    if not username or not email or not password1 or not password2:
        return _json_fail("필수 항목을 모두 입력해주세요.")

    if not agree:
        return _json_fail("이용 안내 및 개인정보 처리 동의가 필요합니다.")

    if len(username) < 4 or len(username) > 20:
        return _json_fail("아이디는 4자 이상 20자 이하로 입력해주세요.")

    if password1 != password2:
        return _json_fail("비밀번호 확인이 일치하지 않습니다.")

    if UserModel.objects.filter(username=username).exists():
        return _json_fail("이미 사용 중인 아이디입니다.", 409)

    if UserModel.objects.filter(email__iexact=email).exists():
        return _json_fail("이미 사용 중인 이메일입니다.", 409)

    try:
        temp_user = UserModel(username=username, email=email, nickname=nickname)
        validate_password(password1, user=temp_user)
    except ValidationError as e:
        return _json_fail(e.messages[0])

    try:
        user = UserModel.objects.create_user(
            username=username,
            email=email,
            nickname=nickname,
            password=password1,
        )
    except IntegrityError:
        return _json_fail("회원가입 처리 중 중복 데이터가 감지되었습니다.", 409)

    return JsonResponse(
        {
            "result": "success",
            "message": "회원가입이 완료되었습니다.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "nickname": user.nickname,
            },
        },
        status=201,
    )


@csrf_protect
@require_http_methods(["POST"])
def api_isha_change_password(request):
    if not request.user or not request.user.is_authenticated:
        return _json_fail("로그인이 필요합니다.", 401)

    new_password = (request.POST.get("new_password") or "").strip()
    if not new_password:
        return _json_fail("새 비밀번호를 입력해주세요.")

    try:
        validate_password(new_password, user=request.user)
    except ValidationError as e:
        return _json_fail(e.messages[0])

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    update_session_auth_hash(request, request.user)

    return JsonResponse({"result": "success", "message": "비밀번호가 변경되었습니다."}, status=200)


@require_http_methods(["GET"])
def api_isha_news_list(request):
    posts = NewsPost.objects.select_related("author").prefetch_related("blocks").all()
    post_list = []

    for post in posts:
        blocks = []
        for block in post.blocks.all():
            if block.block_type == "text":
                blocks.append({
                    "type": "text",
                    "content": block.content,
                })
            elif block.block_type == "image":
                blocks.append({
                    "type": "image",
                    "src": block.image.url if block.image else "",
                    "caption": block.caption,
                })

        post_list.append({
            "id": post.id,
            "pinned": post.is_pinned,
            "category": post.category,
            "isNew": post.is_new,
            "title": post.title,
            "summary": post.summary,
            "date": post.created_at.strftime("%Y.%m.%d"),
            "author": post.author.username if post.author else "관리자",
            "views": post.views,
            "blocks": blocks,
        })

    return JsonResponse({"result": "success", "posts": post_list}, status=200)


@csrf_protect
@require_http_methods(["POST"])
def api_isha_news_create(request):
    staff_error = _require_staff(request)
    if staff_error:
        return staff_error

    title = (request.POST.get("title") or "").strip()
    category = request.POST.get("category") or "notice"
    summary = (request.POST.get("summary") or "").strip()
    is_pinned = request.POST.get("is_pinned") == "true"
    blocks_raw = request.POST.get("blocks")

    if not title:
        return _json_fail("제목을 입력해주세요.")
    if not blocks_raw:
        return _json_fail("본문 데이터가 없습니다.")

    try:
        blocks = json.loads(blocks_raw)
    except json.JSONDecodeError:
        return _json_fail("본문 데이터 형식 오류")

    if is_pinned:
        NewsPost.objects.filter(is_pinned=True).update(is_pinned=False)

    post = NewsPost.objects.create(
        author=request.user,
        title=title,
        category=category,
        summary=summary,
        is_pinned=is_pinned,
    )

    for index, block in enumerate(blocks):
        block_type = block.get("type")

        if block_type == "text":
            NewsBlock.objects.create(
                post=post,
                block_type="text",
                content=block.get("content", ""),
                sort_order=index,
            )
        elif block_type == "image":
            image_key = block.get("image_key")
            image_file = request.FILES.get(image_key)

            if image_file:
                NewsBlock.objects.create(
                    post=post,
                    block_type="image",
                    image=image_file,
                    caption=block.get("caption", ""),
                    sort_order=index,
                )

    return JsonResponse(
        {
            "result": "success",
            "message": "공지 작성 완료",
            "post_id": post.id,
        },
        status=201,
    )


@csrf_protect
@require_http_methods(["POST"])
def api_isha_news_increase_view(request, post_id):
    post = get_object_or_404(NewsPost, id=post_id)
    post.views += 1
    post.save(update_fields=["views"])
    return JsonResponse({"result": "success", "views": post.views}, status=200)


WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


def _parse_week_start(value):
    if value:
        try:
            selected = datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            selected = datetime.today().date()
    else:
        selected = datetime.today().date()

    return selected - timedelta(days=selected.weekday())


def _serialize_schedule(item):
    return {
        "id": item.id,
        "title": item.title,
        "subtitle": item.subtitle,
        "date": item.schedule_date.strftime("%Y-%m-%d"),
        "start_time": item.start_time.strftime("%H:%M"),
        "end_time": item.end_time.strftime("%H:%M") if item.end_time else "",
        "time_label": (
            f"{item.start_time.strftime('%H:%M')} - {item.end_time.strftime('%H:%M')}"
            if item.end_time
            else item.start_time.strftime("%H:%M")
        ),
        "color": item.color,
        "sort_order": item.sort_order,
        "image_url": item.image.url if item.image else "",
    }


@require_http_methods(["GET"])
def api_isha_schedule_list(request):
    week_start = _parse_week_start(request.GET.get("week_start"))
    week_end = week_start + timedelta(days=6)

    queryset = IshaSchedule.objects.filter(
        schedule_date__gte=week_start,
        schedule_date__lte=week_end,
    ).select_related("created_by")

    grouped = []
    total = 0

    for offset in range(7):
        current_date = week_start + timedelta(days=offset)
        items = [item for item in queryset if item.schedule_date == current_date]
        total += len(items)

        grouped.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "label": f"{current_date.month}.{current_date.day} {WEEKDAY_LABELS[current_date.weekday()]}",
            "items": [_serialize_schedule(item) for item in items],
        })

    return JsonResponse({
        "result": "success",
        "week_start": week_start.strftime("%Y-%m-%d"),
        "week_end": week_end.strftime("%Y-%m-%d"),
        "days": grouped,
        "total_count": total,
    })


@csrf_protect
@require_http_methods(["POST"])
def api_isha_schedule_create(request):
    staff_error = _require_staff(request)
    if staff_error:
        return staff_error

    title = (request.POST.get("title") or "").strip()
    subtitle = (request.POST.get("subtitle") or "").strip()
    schedule_date = request.POST.get("schedule_date")
    start_time = request.POST.get("start_time")
    end_time = request.POST.get("end_time") or None
    color = request.POST.get("color") or "blue"
    sort_order = request.POST.get("sort_order") or 0
    image = request.FILES.get("image")

    if not title or not schedule_date or not start_time:
        return _json_fail("날짜, 제목, 시작 시간은 필수입니다.")

    try:
        parsed_date = datetime.strptime(schedule_date, "%Y-%m-%d").date()
        parsed_start = datetime.strptime(start_time, "%H:%M").time()
        parsed_end = datetime.strptime(end_time, "%H:%M").time() if end_time else None
        parsed_sort_order = int(sort_order)
    except ValueError:
        return _json_fail("날짜 또는 시간 형식이 올바르지 않습니다.")

    item = IshaSchedule.objects.create(
        title=title,
        subtitle=subtitle,
        schedule_date=parsed_date,
        start_time=parsed_start,
        end_time=parsed_end,
        color=color,
        sort_order=parsed_sort_order,
        image=image,
        created_by=request.user,
    )

    return JsonResponse({
        "result": "success",
        "message": "일정이 등록되었습니다.",
        "item": _serialize_schedule(item),
    }, status=201)


@csrf_protect
@require_http_methods(["POST"])
def api_isha_schedule_update(request, schedule_id):
    staff_error = _require_staff(request)
    if staff_error:
        return staff_error

    try:
        item = IshaSchedule.objects.get(id=schedule_id)
    except IshaSchedule.DoesNotExist:
        return _json_fail("수정할 일정을 찾을 수 없습니다.", 404)

    title = (request.POST.get("title") or "").strip()
    subtitle = (request.POST.get("subtitle") or "").strip()
    schedule_date = request.POST.get("schedule_date")
    start_time = request.POST.get("start_time")
    end_time = request.POST.get("end_time") or None
    color = request.POST.get("color") or item.color
    sort_order = request.POST.get("sort_order") or item.sort_order
    image = request.FILES.get("image")
    remove_image = request.POST.get("remove_image") == "true"

    if not title or not schedule_date or not start_time:
        return _json_fail("날짜, 제목, 시작 시간은 필수입니다.")

    try:
        item.schedule_date = datetime.strptime(schedule_date, "%Y-%m-%d").date()
        item.start_time = datetime.strptime(start_time, "%H:%M").time()
        item.end_time = datetime.strptime(end_time, "%H:%M").time() if end_time else None
        item.sort_order = int(sort_order)
    except ValueError:
        return _json_fail("날짜 또는 시간 형식이 올바르지 않습니다.")

    item.title = title
    item.subtitle = subtitle
    item.color = color

    if remove_image and item.image:
        item.image.delete(save=False)
        item.image = None

    if image:
        item.image = image

    item.save()

    return JsonResponse({
        "result": "success",
        "message": "일정이 수정되었습니다.",
        "item": _serialize_schedule(item),
    })


@csrf_protect
@require_http_methods(["POST"])
def api_isha_schedule_delete(request, schedule_id):
    staff_error = _require_staff(request)
    if staff_error:
        return staff_error

    try:
        item = IshaSchedule.objects.get(id=schedule_id)
    except IshaSchedule.DoesNotExist:
        return _json_fail("삭제할 일정을 찾을 수 없습니다.", 404)

    item.delete()
    return JsonResponse({"result": "success", "message": "일정이 삭제되었습니다."})

@csrf_protect
@require_http_methods(["POST"])
def api_isha_news_update(request, post_id):
    staff_error = _require_staff(request)
    if staff_error:
        return staff_error

    post = get_object_or_404(NewsPost, id=post_id)

    title = (request.POST.get("title") or "").strip()
    category = request.POST.get("category") or "notice"
    summary = (request.POST.get("summary") or "").strip()
    is_pinned = request.POST.get("is_pinned") == "true"
    blocks_raw = request.POST.get("blocks")

    if not title:
        return _json_fail("제목을 입력해주세요.")
    if not blocks_raw:
        return _json_fail("본문 데이터가 없습니다.")

    try:
        blocks = json.loads(blocks_raw)
    except json.JSONDecodeError:
        return _json_fail("본문 데이터 형식 오류")

    if is_pinned:
        NewsPost.objects.exclude(id=post.id).filter(is_pinned=True).update(is_pinned=False)

    post.title = title
    post.category = category
    post.summary = summary
    post.is_pinned = is_pinned
    post.save()

    post.blocks.all().delete()

    for index, block in enumerate(blocks):
        block_type = block.get("type")

        if block_type == "text":
            NewsBlock.objects.create(
                post=post,
                block_type="text",
                content=block.get("content", ""),
                sort_order=index,
            )

        elif block_type == "image":
            image_key = block.get("image_key")
            image_file = request.FILES.get(image_key)

            if image_file:
                NewsBlock.objects.create(
                    post=post,
                    block_type="image",
                    image=image_file,
                    caption=block.get("caption", ""),
                    sort_order=index,
                )
            else:
                existing_src = block.get("src", "")
                if existing_src:
                    NewsBlock.objects.create(
                        post=post,
                        block_type="image",
                        caption=block.get("caption", ""),
                        sort_order=index,
                    )

    return JsonResponse(
        {
            "result": "success",
            "message": "공지 수정 완료",
            "post_id": post.id,
        },
        status=200,
    )


@csrf_protect
@require_http_methods(["POST"])
def api_isha_news_delete(request, post_id):
    staff_error = _require_staff(request)
    if staff_error:
        return staff_error

    post = get_object_or_404(NewsPost, id=post_id)
    post.delete()

    return JsonResponse(
        {
            "result": "success",
            "message": "공지 삭제 완료",
        },
        status=200,
    )


## live db read -> main
@require_http_methods(["GET"])
def api_isha_main_latest_news(request):
    posts = (
        NewsPost.objects.select_related("author")
        .order_by("-is_pinned", "-created_at")[:3]
    )

    items = []
    for post in posts:
        preview_text = ""
        first_text_block = post.blocks.filter(block_type="text").order_by("sort_order").first()
        if first_text_block and first_text_block.content:
            preview_text = first_text_block.content.strip().replace("\n", " ")[:120]
        elif post.summary:
            preview_text = post.summary

        items.append({
            "id": post.id,
            "title": post.title,
            "summary": post.summary,
            "preview": preview_text,
            "category": post.category,
            "date": post.created_at.strftime("%Y-%m-%d"),
            "pinned": post.is_pinned,
        })

    return JsonResponse({
        "result": "success",
        "items": items,
    }, status=200)


@require_http_methods(["GET"])
def api_isha_main_upcoming_schedules(request):
    today = timezone.localdate()

    items_qs = (
        IshaSchedule.objects.filter(schedule_date__gte=today)
        .order_by("schedule_date", "sort_order", "start_time", "id")[:5]
    )

    items = []
    for item in items_qs:
        items.append({
            "id": item.id,
            "title": item.title,
            "subtitle": item.subtitle,
            "date": item.schedule_date.strftime("%Y-%m-%d"),
            "start_time": item.start_time.strftime("%H:%M") if item.start_time else "",
            "end_time": item.end_time.strftime("%H:%M") if item.end_time else "",
            "color": item.color,
        })

    return JsonResponse({
        "result": "success",
        "items": items,
    }, status=200)

# ──────────────────────────────────────────────
# 문의사항 API
# ──────────────────────────────────────────────

@require_http_methods(["GET"])
def api_isha_contact_list(request):
    """문의 목록 반환 — 본인 글 + 관리자만 전체 열람"""
    if not request.user.is_authenticated:
        return JsonResponse({"result": "fail", "message": "로그인이 필요합니다."}, status=401)

    from .models import ContactPost

    if request.user.isStaff:
        qs = ContactPost.objects.all()
    else:
        qs = ContactPost.objects.filter(author=request.user)

    items = [
        {
            "id": p.id,
            "title": p.title,
            "status": p.status,
            "status_display": p.get_status_display(),
            "is_mine": p.author == request.user,
            "author": p.author.nickname or p.author.username,
            "views": p.views,
            "created_at": p.created_at.strftime("%Y-%m-%d %H:%M"),
            "has_reply": bool(p.admin_reply),
        }
        for p in qs
    ]
    return JsonResponse({"result": "success", "items": items}, status=200)


@require_http_methods(["GET"])
def api_isha_contact_detail(request, post_id):
    """문의 상세 — 본인 또는 관리자만 열람"""
    if not request.user.is_authenticated:
        return JsonResponse({"result": "fail", "message": "로그인이 필요합니다."}, status=401)

    from .models import ContactPost

    try:
        post = ContactPost.objects.get(id=post_id)
    except ContactPost.DoesNotExist:
        return JsonResponse({"result": "fail", "message": "존재하지 않는 문의입니다."}, status=404)

    if post.author != request.user and not request.user.isStaff:
        return JsonResponse({"result": "fail", "message": "열람 권한이 없습니다."}, status=403)

    post.views += 1
    post.save(update_fields=["views"])

    return JsonResponse({
        "result": "success",
        "item": {
            "id": post.id,
            "title": post.title,
            "content": post.content,
            "status": post.status,
            "status_display": post.get_status_display(),
            "admin_reply": post.admin_reply,
            "author": post.author.nickname or post.author.username,
            "is_mine": post.author == request.user,
            "views": post.views,
            "created_at": post.created_at.strftime("%Y-%m-%d %H:%M"),
            "updated_at": post.updated_at.strftime("%Y-%m-%d %H:%M"),
        }
    }, status=200)


@require_http_methods(["POST"])
def api_isha_contact_create(request):
    """문의 작성 — 로그인 필수"""
    if not request.user.is_authenticated:
        return JsonResponse({"result": "fail", "message": "로그인이 필요합니다."}, status=401)

    import json
    from .models import ContactPost

    try:
        body = json.loads(request.body)
    except Exception:
        return JsonResponse({"result": "fail", "message": "잘못된 요청입니다."}, status=400)

    title = (body.get("title") or "").strip()
    content = (body.get("content") or "").strip()

    if not title:
        return JsonResponse({"result": "fail", "message": "제목을 입력해주세요."}, status=400)
    if not content:
        return JsonResponse({"result": "fail", "message": "내용을 입력해주세요."}, status=400)

    post = ContactPost.objects.create(
        author=request.user,
        title=title,
        content=content,
    )
    return JsonResponse({"result": "success", "id": post.id}, status=201)


@require_http_methods(["POST"])
def api_isha_contact_reply(request, post_id):
    """관리자 답변 등록"""
    if not request.user.is_authenticated or not request.user.isStaff:
        return JsonResponse({"result": "fail", "message": "권한이 없습니다."}, status=403)

    import json
    from .models import ContactPost

    try:
        post = ContactPost.objects.get(id=post_id)
    except ContactPost.DoesNotExist:
        return JsonResponse({"result": "fail", "message": "존재하지 않는 문의입니다."}, status=404)

    try:
        body = json.loads(request.body)
    except Exception:
        return JsonResponse({"result": "fail", "message": "잘못된 요청입니다."}, status=400)

    reply = (body.get("reply") or "").strip()
    if not reply:
        return JsonResponse({"result": "fail", "message": "답변 내용을 입력해주세요."}, status=400)

    post.admin_reply = reply
    post.status = "answered"
    post.save(update_fields=["admin_reply", "status", "updated_at"])

    return JsonResponse({"result": "success"}, status=200)


@require_http_methods(["DELETE"])
def api_isha_contact_delete(request, post_id):
    """문의 삭제 — 본인 또는 관리자"""
    if not request.user.is_authenticated:
        return JsonResponse({"result": "fail", "message": "로그인이 필요합니다."}, status=401)

    from .models import ContactPost

    try:
        post = ContactPost.objects.get(id=post_id)
    except ContactPost.DoesNotExist:
        return JsonResponse({"result": "fail", "message": "존재하지 않는 문의입니다."}, status=404)

    if post.author != request.user and not request.user.isStaff:
        return JsonResponse({"result": "fail", "message": "삭제 권한이 없습니다."}, status=403)

    post.delete()
    return JsonResponse({"result": "success"}, status=200)