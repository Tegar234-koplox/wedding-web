from rest_framework.generics import ListAPIView

from common.permissions import HasStaffRole
from orders.permissions import IsStaffRole
from users.models import User
from users.serializers import StaffUserSerializer


class StaffUserListView(ListAPIView):
    permission_classes = [IsStaffRole, HasStaffRole]
    required_staff_roles = (User.StaffRole.OWNER,)
    serializer_class = StaffUserSerializer
    pagination_class = None

    def get_queryset(self):
        return User.objects.filter(is_staff=True, is_active=True).order_by("username")
