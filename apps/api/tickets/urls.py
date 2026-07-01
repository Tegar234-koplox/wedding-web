from django.urls import path

from tickets.views import StaffTicketDetailView, StaffTicketListView

urlpatterns = [
    path("admin/tickets", StaffTicketListView.as_view(), name="admin-ticket-list"),
    path(
        "admin/tickets/<uuid:ticket_id>",
        StaffTicketDetailView.as_view(),
        name="admin-ticket-detail",
    ),
]
