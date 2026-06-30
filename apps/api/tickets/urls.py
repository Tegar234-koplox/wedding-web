from django.urls import path

from tickets.views import ClientTicketListCreateView, StaffTicketDetailView, StaffTicketListView

urlpatterns = [
    path("client/tickets", ClientTicketListCreateView.as_view(), name="client-ticket-list"),
    path("admin/tickets", StaffTicketListView.as_view(), name="admin-ticket-list"),
    path(
        "admin/tickets/<uuid:ticket_id>",
        StaffTicketDetailView.as_view(),
        name="admin-ticket-detail",
    ),
]
