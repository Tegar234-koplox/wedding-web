from django.db.models import QuerySet

from invitations.models import Invitation


def public_invitations() -> QuerySet[Invitation]:
    return (
        Invitation.objects.filter(
            status=Invitation.Status.PUBLISHED,
            archived_at__isnull=True,
        )
        .select_related("theme", "package")
        .prefetch_related("events__location", "media__asset")
    )


def sample_for_theme(theme_slug: str) -> Invitation | None:
    return (
        public_invitations()
        .filter(theme__slug=theme_slug, is_sample=True)
        .order_by("-published_at")
        .first()
    )
