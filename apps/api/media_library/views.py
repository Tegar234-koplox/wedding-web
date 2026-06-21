from django.core.exceptions import ImproperlyConfigured, ValidationError
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from media_library.services import create_upload_signature


class UploadSignatureView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        request=inline_serializer(
            name="UploadSignatureRequest",
            fields={
                "namespace": serializers.ChoiceField(choices=["themes", "samples", "invitations"]),
                "resource_type": serializers.ChoiceField(
                    choices=["image", "video"],
                    default="image",
                ),
            },
        ),
        responses=inline_serializer(
            name="UploadSignatureResponse",
            fields={
                "cloud_name": serializers.CharField(),
                "api_key": serializers.CharField(),
                "resource_type": serializers.CharField(),
                "signature": serializers.CharField(),
                "folder": serializers.CharField(),
                "timestamp": serializers.IntegerField(),
                "use_filename": serializers.BooleanField(),
                "unique_filename": serializers.BooleanField(),
                "overwrite": serializers.BooleanField(),
            },
        ),
    )
    def post(self, request) -> Response:
        try:
            payload = create_upload_signature(
                namespace=request.data.get("namespace", ""),
                resource_type=request.data.get("resource_type", "image"),
            )
        except (ValidationError, ImproperlyConfigured) as exc:
            from rest_framework.exceptions import ValidationError as APIValidationError

            raise APIValidationError({"upload": str(exc)}) from exc
        return Response(payload)
