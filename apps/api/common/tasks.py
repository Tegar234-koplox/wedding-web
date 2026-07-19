from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from invitations.models import ClientOtpChallenge


def _send_whatsapp_otp(phone: str, code: str, locale: str) -> None:
    url = (
        f"https://graph.facebook.com/{settings.META_WHATSAPP_GRAPH_VERSION}/"
        f"{settings.META_WHATSAPP_PHONE_NUMBER_ID}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": "".join(character for character in phone if character.isdigit()),
        "type": "template",
        "template": {
            "name": settings.META_WHATSAPP_OTP_TEMPLATE_ID,
            "language": {"code": "id" if locale == "id" else "en_US"},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": code}],
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": code}],
                },
            ],
        },
    }
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.META_WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        if response.status >= 300:
            raise RuntimeError(f"Meta WhatsApp returned HTTP {response.status}")


def _send_email_otp(email: str, code: str, locale: str) -> None:
    if locale == "id":
        subject = "Kode persetujuan Niskala"
        message = (
            f"Kode OTP Anda: {code}\n\nKode berlaku selama 5 menit. "
            "Jangan bagikan kode ini kepada siapa pun."
        )
    else:
        subject = "Your Niskala approval code"
        message = (
            f"Your OTP code: {code}\n\nThis code is valid for 5 minutes. "
            "Do not share it with anyone."
        )
    sent = send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email])
    if sent != 1:
        raise RuntimeError("SMTP did not accept the OTP message")


@shared_task(
    bind=True,
    autoretry_for=(HTTPError, URLError, TimeoutError),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
)
def deliver_bespoke_otp(
    self,
    challenge_id: str,
    code: str,
    phone: str,
    email: str,
    locale: str,
) -> None:
    challenge = ClientOtpChallenge.objects.filter(pk=challenge_id).first()
    if challenge is None or challenge.consumed_at is not None:
        return
    try:
        if challenge.channel == ClientOtpChallenge.Channel.WHATSAPP:
            try:
                _send_whatsapp_otp(phone, code, locale)
            except (HTTPError, URLError, TimeoutError, RuntimeError):
                if not email:
                    raise
                _send_email_otp(email, code, locale)
                from invitations.bespoke import audit_hash, mask_email

                challenge.channel = ClientOtpChallenge.Channel.EMAIL
                challenge.destination_hash = audit_hash(email.strip().lower())
                challenge.destination_masked = mask_email(email)
        else:
            _send_email_otp(email, code, locale)
        challenge.delivery_status = ClientOtpChallenge.DeliveryStatus.SENT
        challenge.save(
            update_fields=[
                "channel",
                "destination_hash",
                "destination_masked",
                "delivery_status",
                "updated_at",
            ]
        )
    except Exception:
        challenge.delivery_status = ClientOtpChallenge.DeliveryStatus.FAILED
        challenge.save(update_fields=["delivery_status", "updated_at"])
        raise
