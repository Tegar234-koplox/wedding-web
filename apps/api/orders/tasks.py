from celery import shared_task

from orders.lifecycle import refresh_invitation_lifecycle


@shared_task(name="orders.tasks.refresh_invitation_lifecycle")
def refresh_invitation_lifecycle_task() -> dict[str, int]:
    return refresh_invitation_lifecycle()
