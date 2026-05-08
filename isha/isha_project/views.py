from django.shortcuts import render, redirect
from django.views.decorators.http import require_http_methods
import time
import datetime

# 페이지 렌더링 뷰 함수
@require_http_methods(["GET"])
def isha_main_rendering(request):
    return render(request, "main/isha_main.html")

@require_http_methods(["GET"])
def isha_legal_rendering(request):
    return render(request, "main/isha_legal.html")

@require_http_methods(["GET"])
def isha_intro_rendering(request):
    return render(request, "main/isha_member.html")

@require_http_methods(["GET"])
def isha_news_rendering(request):
    return render(request, "main/isha_news.html")

@require_http_methods(["GET"])
def isha_schedule_rendering(request):
    return render(request, "main/isha_schedule.html")

# status -> 방송 상태 및 실시간 렌더
@require_http_methods(['GET'])
def isha_status_main(request):
    return render(request, "main/status/isha_status_main.html")

@require_http_methods(["GET"])
def isha_contact_rendering(request):
    if not request.user.is_authenticated:
        print(f"{datetime.datetime.today()} -> lgogin -> None")
        return redirect("/")
    return render(request, "main/isha_contact.html")
