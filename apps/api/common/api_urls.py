from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.http import require_GET

from common.views import (
    ClientLoginView,
    ClientSessionMeView,
    CsrfTokenView,
    StaffAuditEventListView,
    StaffLoginView,
    StaffLogoutView,
    StaffSessionMeView,
)


@require_GET
def api_root(_: object) -> JsonResponse:
    return JsonResponse({"name": "Wedding Invitation API", "version": "v1"})


urlpatterns = [
    path("", api_root, name="api-root"),
    path("auth/csrf", CsrfTokenView.as_view(), name="api-csrf-token"),
    path("auth/login", StaffLoginView.as_view(), name="api-staff-login"),
    path("auth/client/login", ClientLoginView.as_view(), name="api-client-login"),
    path("auth/client/me", ClientSessionMeView.as_view(), name="api-client-session-me"),
    path("auth/logout", StaffLogoutView.as_view(), name="api-staff-logout"),
    path("auth/me", StaffSessionMeView.as_view(), name="api-staff-session-me"),
    path("client/profile", ClientSessionMeView.as_view(), name="client-profile"),
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
]
