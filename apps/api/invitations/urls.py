from django.urls import path

from invitations.views import InvitationDetailView, InvitationWeatherView

urlpatterns = [
    path(
        "invitations/<slug:public_slug>",
        InvitationDetailView.as_view(),
        name="invitation-detail",
    ),
    path(
        "invitations/<slug:public_slug>/weather",
        InvitationWeatherView.as_view(),
        name="invitation-weather",
    ),
]
