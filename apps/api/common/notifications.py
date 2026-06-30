from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model


@dataclass(frozen=True)
class ClientNotification:
    recipient_id: str
    event_type: str
    payload: dict[str, Any]


def enqueue_client_notification(
    *,
    recipient,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> ClientNotification | None:
    """Queue a client-facing notification for later dispatch.

    TODO: connect this to the production notification channel. The existing
    WhatsApp funnel records intent/click attribution, but it is not yet a
    transactional dispatch queue.
    """

    user_model = get_user_model()
    if recipient is None or not isinstance(recipient, user_model):
        return None
    return ClientNotification(
        recipient_id=str(recipient.id),
        event_type=event_type,
        payload=payload or {},
    )
