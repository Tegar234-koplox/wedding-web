from django.urls import path

from catalog.views import PackageListView, ThemeDetailView, ThemeListView, ThemeSampleView

urlpatterns = [
    path("themes", ThemeListView.as_view(), name="theme-list"),
    path("themes/<slug:slug>", ThemeDetailView.as_view(), name="theme-detail"),
    path("themes/<slug:slug>/sample", ThemeSampleView.as_view(), name="theme-sample"),
    path("packages", PackageListView.as_view(), name="package-list"),
]
