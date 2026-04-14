from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect


endpoint_ = ['api', 'Api', 'APi', 'apI', 'API', 'APi', 'ApI']
def _json_fail(message, status=400):
    return JsonResponse({"result": "fail", "message": message}, status=status)

class BlockEndPoint:
    def _require_staff(request):
        if not request.user.is_authenticated or not request.user.isStaff:
            return _json_fail("관리자 권한이 필요합니다.", 403)
        return None
       
@csrf_protect
@require_http_methods(["POST"])
def api_isha_news_create(request):
    staff_error = BlockEndPoint._require_staff(request)
    if staff_error:
        return staff_error
    else:
        pass

    