from __future__ import annotations

import hashlib
import re

from django.conf import settings
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle


class AuthenticatedUserRateThrottle(UserRateThrottle):
    """Apply the general user bucket only after Django authentication succeeds."""

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return None
        return super().get_cache_key(request, view)


class NiskalaScopedRateThrottle(ScopedRateThrottle):
    """Scoped throttle keyed by the protected subject, never a shared BFF IP."""

    rate_pattern = re.compile(r"^(?P<count>\d+)/(?P<period>\d+)?(?P<unit>s|sec|m|min|minute|h|d)$")
    unit_seconds = {
        "s": 1,
        "sec": 1,
        "m": 60,
        "min": 60,
        "minute": 60,
        "h": 3_600,
        "d": 86_400,
    }

    def parse_rate(self, rate):
        if rate is None:
            return None, None
        match = self.rate_pattern.fullmatch(rate.strip().lower())
        if match is None:
            raise ValueError(f"Invalid Niskala throttle rate: {rate!r}")
        count = int(match.group("count"))
        period = int(match.group("period") or "1")
        return count, period * self.unit_seconds[match.group("unit")]

    @staticmethod
    def _request_value(request, name: str) -> str:
        try:
            return str(request.data.get(name) or "").strip()
        except Exception:
            return ""

    @staticmethod
    def _cookie(request, setting_name: str) -> str:
        cookie_name = str(getattr(settings, setting_name, ""))
        return str(request.COOKIES.get(cookie_name) or "").strip() if cookie_name else ""

    def _subject(self, request, view) -> str:
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return f"user:{user.pk}"

        scope = str(getattr(self, "scope", "") or "")
        if scope == "login":
            identifier = self._request_value(request, "username") or self._request_value(
                request, "email"
            )
            return f"identifier:{identifier.casefold()}" if identifier else ""
        if scope == "mfa":
            challenge = self._request_value(request, "challenge")
            return f"challenge:{challenge}" if challenge else ""
        if scope == "client_access":
            grant_id = str(getattr(view, "kwargs", {}).get("grant_id") or "").strip()
            token = self._request_value(request, "token")
            session = self._cookie(request, "CLIENT_ACCESS_COOKIE_NAME")
            subject = grant_id or token or session
            return f"client:{subject}" if subject else ""
        if scope == "grant_redeem":
            token = self._request_value(request, "token")
            return f"grant:{token}" if token else ""
        if scope == "rsvp":
            token = self._request_value(request, "token")
            session = self._cookie(request, "GUEST_ACCESS_COOKIE_NAME")
            public_slug = str(getattr(view, "kwargs", {}).get("public_slug") or "").strip()
            subject = session or token or public_slug
            return f"rsvp:{subject}" if subject else ""
        if scope == "csrf":
            session = (
                self._cookie(request, "SESSION_COOKIE_NAME")
                or self._cookie(request, "CLIENT_ACCESS_COOKIE_NAME")
                or self._cookie(request, "GUEST_ACCESS_COOKIE_NAME")
            )
            return f"csrf:{session}" if session else ""
        if scope == "guest_import":
            session = self._cookie(request, "CLIENT_ACCESS_COOKIE_NAME")
            return f"guest-import:{session}" if session else ""
        return ""

    def get_cache_key(self, request, view):
        subject = self._subject(request, view)
        if not subject:
            # Public edge controls own per-client-IP limiting. Returning no key here
            # avoids treating all Vercel requests as one anonymous caller.
            return None
        digest = hashlib.sha256(subject.encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": digest}
