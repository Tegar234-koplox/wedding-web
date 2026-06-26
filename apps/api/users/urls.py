from django.urls import path

from users.views import StaffUserListView

urlpatterns = [
    path("admin/staff-users", StaffUserListView.as_view(), name="admin-staff-user-list"),
]
