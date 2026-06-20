from django.http import JsonResponse
from django.urls import path
from django.views.decorators.http import require_GET


@require_GET
def api_root(_: object) -> JsonResponse:
    return JsonResponse({"name": "Wedding Invitation API", "version": "v1"})


urlpatterns = [path("", api_root, name="api-root")]
