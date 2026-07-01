from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.http import require_GET

from common.views import (
    CsrfTokenView,
    StaffAuditEventListView,
)


@require_GET
def api_root(_: object) -> JsonResponse:
    return JsonResponse({"name": "Wedding Invitation API", "version": "v1"})


urlpatterns = [
    path("", api_root, name="api-root"),
    path("auth/csrf", CsrfTokenView.as_view(), name="api-csrf-token"),
    path("", include("site_settings.urls")),
    path("admin/audit-events", StaffAuditEventListView.as_view(), name="admin-audit-event-list"),
    path("", include("catalog.urls")),
    path("", include("invitations.urls")),
    path("", include("leads.urls")),
    path("", include("media_library.urls")),
    path("", include("orders.urls")),
    path("", include("payments.urls")),
    path("", include("analytics.urls")),
    path("", include("users.urls")),
    path("", include("tickets.urls")),
]
