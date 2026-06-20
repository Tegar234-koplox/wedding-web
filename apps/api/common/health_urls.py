from django.urls import path

from common import health

urlpatterns = [
    path("live", health.live, name="health-live"),
    path("ready", health.ready, name="health-ready"),
]
