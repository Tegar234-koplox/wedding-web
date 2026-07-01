from django.contrib.auth import authenticate, get_user_model, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.models import AuditEvent
from common.serializers import StaffAuditEventSerializer, StaffSessionUserSerializer
from orders.permissions import IsStaffRole

STAFF_ROLE = "staff"


class StaffAuditEventListView(ListAPIView):
    permission_classes = [IsStaffRole]
    serializer_class = StaffAuditEventSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = AuditEvent.objects.select_related("actor")
        resource_type = self.request.query_params.get("resource_type")
        resource_reference = self.request.query_params.get("resource_reference")
        if resource_type:
            queryset = queryset.filter(resource_type=resource_type)
        if resource_reference:
            queryset = queryset.filter(resource_reference=resource_reference)
        return queryset[:100]


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfTokenView(APIView):
    permission_classes = [AllowAny]

    def get(self, request) -> Response:
        return Response({"csrfToken": get_token(request)})


class StaffSessionMeView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request) -> Response:
        return Response({"user": StaffSessionUserSerializer(request.user).data})


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(ensure_csrf_cookie, name="dispatch")
class StaffLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request) -> Response:
        identifier = str(request.data.get("username") or request.data.get("email") or "").strip()
        password = str(request.data.get("password") or "")
        if not identifier or not password:
            return Response(
                {"detail": "Username/email dan password wajib diisi."},
                status=400,
            )

        username = identifier
        if "@" in identifier:
            user_model = get_user_model()
            username = (
                user_model.objects.filter(email__iexact=identifier)
                .values_list("username", flat=True)
                .first()
                or identifier
            )

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({"detail": "Kredensial staff tidak valid."}, status=400)

        has_staff_role = getattr(user, "role", "") == STAFF_ROLE
        has_staff_access = getattr(user, "is_superuser", False) or has_staff_role
        if not user.is_active or not user.is_staff or not has_staff_access:
            return Response({"detail": "Akun ini tidak memiliki akses staff."}, status=403)

        login(request, user)
        return Response({"user": StaffSessionUserSerializer(user).data})


class StaffLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request) -> Response:
        logout(request)
        return Response({"ok": True})
