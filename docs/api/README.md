# API documentation

The API is versioned under `/api/v1/`. The generated contract is stored in
`docs/api/openapi.yaml`; interactive documentation is available at `/api/docs/`
when Django is running.

## Public endpoints

- `GET /api/v1/public/site-config`
- `GET /api/v1/themes`
- `GET /api/v1/themes/{slug}`
- `GET /api/v1/themes/{slug}/sample`
- `GET /api/v1/packages`
- `GET /api/v1/invitations/{public_slug}`
- `GET /api/v1/invitations/{public_slug}/weather`
- `POST /api/v1/invitations/{public_slug}/rsvp`
- `POST /api/v1/analytics/events`
- `GET /api/v1/cta/whatsapp`

Public serializers intentionally exclude database UUIDs, draft records, guests,
audit events, private settings, and provider credentials.

The weather endpoint calls BMKG only from Django, caches normalized forecasts in
Redis, persists snapshots in PostgreSQL, and returns stale saved data when the
provider is temporarily unavailable.

## Staff endpoints

- `POST /api/v1/admin/media/upload-signature`
- `GET /api/v1/admin/dashboard/metrics`
- `GET /api/v1/admin/leads`
- `GET|POST /api/v1/admin/orders`
- `GET|PATCH /api/v1/admin/orders/{reference}`
- `GET /api/v1/admin/staff-users`
- `POST /api/v1/admin/invitations/{public_slug}/publish`
- `POST /api/v1/admin/guests/{guest_id}/anonymize`
- `GET /api/v1/admin/audit-events`
- `GET /api/v1/admin/analytics/metrics`

Staff endpoints require an authenticated staff session plus MFA. Role checks use
owner, finance, editor, support, and viewer levels; assignment scoping is applied
to non-owner staff. Sensitive mutations write `AuditEvent` records. Generic order
PATCH cannot set `payment_status`; that value is derived from reviewed manual
payment records. `verified` and `rejected` transitions use their dedicated action
endpoints rather than the generic order editor.

## Capability-session endpoints

- `POST /api/v1/access/client/bootstrap`
- `POST /api/v1/access/client/login/{grant_id}`
- `GET /api/v1/access/client/me`
- `POST /api/v1/access/client/pin`
- `POST /api/v1/access/client/logout`
- `POST /api/v1/access/guest/redeem`
- `GET /api/v1/access/guest/me`
- `POST /api/v1/access/guest/logout`
- `POST /api/v1/access/preview/redeem`
- `POST /api/v1/access/preview/logout`
- `GET /api/v1/client/portal`

Bootstrap bearer grants arrive in URL fragments and are exchanged once for
host-only HttpOnly sessions. Session mutations require CSRF protection. Legacy
slug/query-token routes are disabled by default and may only be enabled for a
short, explicit migration window.

## Payment endpoints

Payments are recorded and reviewed manually by authenticated staff. No public
payment-provider webhook is exposed, and automated invoice endpoints are not
routed.

## Operational endpoints

- `GET /health/live`
- `GET /health/ready`
