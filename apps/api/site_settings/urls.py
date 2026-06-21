from django.urls import path

from site_settings.views import PublicSiteConfigView

urlpatterns = [
    path("public/site-config", PublicSiteConfigView.as_view(), name="public-site-config"),
]
