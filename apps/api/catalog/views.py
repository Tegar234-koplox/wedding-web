from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

from catalog.models import Package
from catalog.selectors import public_packages, public_themes
from catalog.serializers import PackageSerializer, ThemeSerializer
from common.api import request_locale
from common.pagination import PublicPagination
from invitations.selectors import sample_for_theme
from invitations.serializers import PublicInvitationSerializer


class ThemeListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ThemeSerializer
    pagination_class = PublicPagination

    def get_queryset(self):
        queryset = public_themes()
        category = self.request.query_params.get("category")
        featured = self.request.query_params.get("featured")
        if category:
            queryset = queryset.filter(category=category)
        if featured in {"true", "false"}:
            queryset = queryset.filter(is_featured=featured == "true")
        return queryset

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "locale": request_locale(self.request)}


class ThemeDetailView(RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = ThemeSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return public_themes()

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "locale": request_locale(self.request)}


class ThemeSampleView(RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicInvitationSerializer
    lookup_url_kwarg = "slug"

    def get_object(self):
        from django.http import Http404

        invitation = sample_for_theme(self.kwargs["slug"])
        if invitation is None:
            raise Http404
        return invitation


@extend_schema(tags=["packages"])
class PackageListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PackageSerializer
    pagination_class = None
    queryset = Package.objects.none()

    def get_queryset(self):
        return public_packages()

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "locale": request_locale(self.request)}
