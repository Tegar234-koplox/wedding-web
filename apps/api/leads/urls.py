from django.urls import path

from leads.views import WhatsAppRedirectView

urlpatterns = [
    path("cta/whatsapp", WhatsAppRedirectView.as_view(), name="whatsapp-redirect"),
]
