from __future__ import annotations

import re

from rest_framework.throttling import ScopedRateThrottle


class NiskalaScopedRateThrottle(ScopedRateThrottle):
    """Scoped DRF throttle with support for multi-unit windows such as 5/5m."""

    rate_pattern = re.compile(r"^(?P<count>\d+)/(?P<period>\d+)?(?P<unit>s|sec|m|min|h|d)$")
    unit_seconds = {
        "s": 1,
        "sec": 1,
        "m": 60,
        "min": 60,
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
