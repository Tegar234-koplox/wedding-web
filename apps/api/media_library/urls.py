from django.urls import path

from media_library.views import UploadSignatureView

urlpatterns = [
    path("admin/media/upload-signature", UploadSignatureView.as_view(), name="upload-signature"),
]
