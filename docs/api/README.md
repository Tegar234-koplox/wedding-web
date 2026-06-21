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
- `GET /api/v1/cta/whatsapp`

Public serializers intentionally exclude database UUIDs, draft records, guests,
audit events, private settings, and provider credentials.

## Staff endpoint

- `POST /api/v1/admin/media/upload-signature`

The media endpoint requires an authenticated staff user and only signs uploads
for allowlisted Cloudinary namespaces.

## Operational endpoints

- `GET /health/live`
- `GET /health/ready`
