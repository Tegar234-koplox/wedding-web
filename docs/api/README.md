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

Staff endpoints require authenticated staff users. Role checks use owner, admin,
editor, support, and viewer levels; sensitive mutations write `AuditEvent`
records.

## Client endpoints

- `GET /api/v1/client/orders`
- `GET /api/v1/client/invitations`
- `GET|PATCH /api/v1/client/invitations/{public_slug}`
- `POST /api/v1/client/invitations/{public_slug}/submit-revision`
- `POST /api/v1/client/invitations/{public_slug}/approve-publish`
- `GET /api/v1/client/invitations/{public_slug}/guests/export`

## Payment endpoints

- `POST /api/v1/payments/invoices`
- `GET /api/v1/payments/invoices/{invoice_number}`
- `POST /api/v1/payments/midtrans/webhook`

Payment records are Midtrans-ready and webhooks are idempotent. The first
implementation stores invoice/webhook state and audit events; external charge
creation can be attached behind the same invoice contract.

## Operational endpoints

- `GET /health/live`
- `GET /health/ready`
