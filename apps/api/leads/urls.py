from django.urls import path

from leads.views import StaffWhatsAppIntentListView, WhatsAppRedirectView

urlpatterns = [
    path("cta/whatsapp", WhatsAppRedirectView.as_view(), name="whatsapp-redirect"),
    path("admin/leads", StaffWhatsAppIntentListView.as_view(), name="admin-lead-list"),
]
