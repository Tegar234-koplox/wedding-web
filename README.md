# Niskala Wedding Web

Production-oriented monorepo untuk layanan undangan digital wedding bilingual. Project ini berisi website utama, live preview tema, public invitation renderer, backend operasional, dashboard staff, RSVP, guest delivery, dan flow pengelolaan order manual.

## Ringkasan Produk

Niskala adalah website bisnis undangan digital dengan:

- Landing page bilingual `id` dan `en`.
- 7 tema undangan: Elegant Classic, Islamic Soft, Luxury Gold, Minimalist White, Dark Cinematic, Floral Romantic, Javanese / Traditional.
- 3 paket: Essential, Signature, Couture.
- Live preview per tema dan paket.
- Public invitation URL untuk customer dan tamu.
- Musik latar belakang setelah undangan dibuka.
- RSVP, ucapan tamu, gift, galeri, cuaca, dan link tamu personal.
- Dashboard staff untuk order manual dari WhatsApp dan transfer bank.

Project ini tidak memakai payment gateway untuk operasional utama saat ini. Pembayaran dicatat manual oleh staff berdasarkan komunikasi WhatsApp dan bukti transfer.

## Stack

- Monorepo: pnpm workspace + Turborepo
- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- Backend: Django 5.2, Django REST Framework
- Database: PostgreSQL untuk production, SQLite/PostgreSQL untuk lokal sesuai env
- Cache/queue: Redis, Celery foundation
- Media: Cloudinary URL/manual asset input
- Deploy: Vercel untuk web, Railway untuk API
- Observability: Sentry foundation

## Struktur Repo

```text
apps/
  api/        Django API, admin, order ops, invitation, RSVP, guest delivery
  web/        Next.js website utama, live preview, public invitation, staff UI
packages/
  invitation-themes/  shared invitation schema/theme package
infra/
  docker-compose.yml  local PostgreSQL/Redis
docs/
  architecture/       boundary dan overview teknis
  operations/         local dev, deployment, hardening, smoke test
  api/                OpenAPI docs
```

## Requirements

- Node.js 24+
- pnpm 11+
- Python 3.12 sampai 3.14
- Docker Desktop untuk PostgreSQL dan Redis lokal

## Local Setup

1. Copy `.env.example` ke `.env`, lalu isi value lokal.
2. Jalankan service lokal:

   ```powershell
   docker compose -f infra/docker-compose.yml up -d
   ```

3. Install dependency frontend:

   ```powershell
   pnpm install
   ```

4. Siapkan virtual environment backend:

   ```powershell
   cd C:\Projects\wedding-web\apps\api
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -e ".[dev]"
   ```

5. Jalankan migration:

   ```powershell
   .\.venv\Scripts\python.exe manage.py migrate
   ```

6. Jalankan backend:

   ```powershell
   .\.venv\Scripts\python.exe manage.py runserver 8000
   ```

7. Jalankan frontend dari root repo:

   ```powershell
   cd C:\Projects\wedding-web
   pnpm --filter @wedding/web dev
   ```

Default lokal:

- Frontend: `http://localhost:3000`
- Backend API: `http://127.0.0.1:8000/api/v1`
- Django admin: `http://127.0.0.1:8000/admin`

## Environment Penting

Frontend Vercel:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_DEFAULT_LOCALE`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`

Backend Railway:

- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DATABASE_URL`
- `REDIS_URL`
- Cloudinary/Sentry env sesuai kebutuhan production

`NEXT_PUBLIC_API_URL` harus menunjuk ke domain API Railway dengan suffix `/api/v1`. `DJANGO_ALLOWED_HOSTS` berisi host backend, bukan domain frontend.

## Area Aplikasi

### Public Website

Website utama menampilkan brand, tema, paket, proses, WhatsApp CTA, dan live preview. Bilingual route tetap dipertahankan:

- `/id`
- `/en`
- `/id/packages`
- `/en/packages`
- preview invitation per tema/paket

### Public Invitation

Public invitation memakai renderer v2 dan mendukung:

- cover dengan guest name personal jika link tamu dipakai
- section waktu/tempat
- section foto sesuai paket
- love story dan timeline per tema/paket
- RSVP dan ucapan
- prakiraan cuaca
- gift
- backsound
- overlay/corner asset sesuai tema dan aturan paket

### Staff Dashboard

Dashboard staff berada di:

- `/admin/login`
- `/admin`
- `/admin/orders/{reference}`

Dashboard staff adalah satu-satunya dashboard internal aktif. Dashboard client lama tidak diaktifkan.

Fungsi utama staff:

- melihat daftar order
- tambah order manual
- update order
- status pengerjaan: Baru, Data Kurang, Proses, Revisi, Final, Publikasi
- status pembayaran manual: Belum Bayar, DP, Lunas
- catat pembayaran manual
- kelola data client, tema, paket, tanggal acara, lokasi, media, rekening
- link preview customer
- link form daftar tamu untuk client
- catatan revisi
- custom request workflow
- audit dan workflow operasional

### Guest Delivery Workspace

Staff membagikan link khusus dari detail order ke client:

```text
/guest-delivery/{token}
```

Workspace ini tidak membutuhkan login client dan menggunakan signed token. Isi workspace:

- `Import CSV`
- `Daftar Tamu`
- `Ucapan Tamu`

Client dapat:

- membaca guide import dengan bahasa awam
- download template CSV
- drag and drop atau pilih CSV
- preview hasil import
- commit import
- tambah tamu manual sebagai fallback
- export CSV
- search nama tamu
- copy link personal
- buka WhatsApp
- checklist manual link sudah dikirim atau belum
- melihat rekap RSVP dan ucapan tamu tanpa data kontak tamu

Data ucapan tamu dipindahkan ke workspace ini agar RSVP/ucapan tetap berada di area privat client dan tamu.

## CSV Guest List

Template CSV:

```csv
name,phone,email,party_size,group,note
Nama Tamu, WhatsApp,namatamu@example.com, 2, Keluarga, VIP
```

Aturan import:

- `name` wajib.
- `phone` dan `email` opsional.
- `party_size` default `1`, maksimum `20`.
- nomor Indonesia dinormalisasi ke format `+62` bila memungkinkan.
- duplicate dicocokkan berdasarkan phone, lalu email, lalu nama.
- RSVP yang sudah masuk tidak ditimpa.
- export CSV di-escape untuk mengurangi risiko CSV injection.

## Roadmap / Phase Status

### Phase 1 - Foundation

- Monorepo pnpm/Turbo.
- Next.js web dan Django API runtime.
- CI, lint, typecheck, formatting baseline.
- Shared docs dan env foundation.

### Phase 2 - Public Website

- Landing page bilingual.
- Struktur konten utama Niskala.
- Tema, paket, proses, CTA WhatsApp.
- Design system awal: editorial dark, gold accent, serif heading.

### Phase 3 - Theme Preview

- Live preview tema.
- Renderer invitation v2.
- Support theme/package switching.
- Preview dalam konteks website utama.

### Phase 4 - Public Invitation Runtime

- Public invitation route.
- Cover, section waktu/tempat, gallery, story, RSVP, gift, closing.
- Invitation schema dan sample content.
- Guest token untuk personal link.

### Phase 5 - Premium Theme Assets

- Overlay/corner theme assets.
- Aturan paket:
  - Essential tanpa premium overlay.
  - Signature memakai premium overlay/cover animation.
  - Couture memakai premium overlay, cover animation, content animation.
- Optimasi overlay dari SVG berat ke WebP untuk tema tertentu.

### Phase 6 - Weather, Music, and Interaction

- Integrasi BMKG/weather foundation.
- Backsound undangan setelah klik buka undangan.
- Live preview juga memutar/mematikan musik sesuai state undangan.
- Gift interaction dengan icon before/after dan morph transition.
- Couture gift sound effect per tema dengan background audio ducking.

### Phase 7 - Production Readiness

- Deployment Vercel/Railway.
- Health endpoint.
- CSRF/CORS/session env hardening.
- Smoke test production.
- Dokumentasi deployment dan production hardening.

### Phase 8 - Staff Operations

- Staff login dan dashboard staff.
- Order management manual.
- Create/update/archive order.
- Workflow order, payment status manual, preview URL.
- Data client, media URL, rekening, RSVP summary.
- Revision timeline.
- Custom request workflow: brief custom, status custom, catatan approval, checklist asset/motion.

### Phase 9 - Client Dashboard Decision

- Dashboard client lama dinonaktifkan.
- Scope diarahkan ke link privat berbasis token untuk kebutuhan client tertentu.
- Staff dashboard tetap menjadi pusat operasional.

### Phase 10 - RSVP, Guest Management, and Music

- Guest model dan personal RSVP token.
- Public RSVP.
- Guest import/export CSV.
- Guest delivery link per tamu.
- Checklist delivery manual.
- Ucapan tamu privat untuk client.
- Backsound menggunakan media/Cloudinary URL.

### Phase 11 - Manual Payment Operations

- Payment gateway tidak dipakai untuk flow utama.
- Pembayaran dicatat manual:
  - DP
  - pelunasan
  - status valid/pending/rejected
  - outstanding amount
- Cocok untuk flow WhatsApp dan transfer bank.

### Phase 12 - Analytics and Operational Polish

- First-party analytics event foundation.
- RSVP submitted event.
- Dashboard polish: search, filters, summary.
- Staff dashboard UX polish:
  - validasi nama pasangan
  - indikator jumlah foto per section
  - warning slot foto wajib belum lengkap
- Guest delivery workspace untuk client:
  - Import CSV
  - Daftar Tamu
  - Ucapan Tamu

## Testing

Backend:

```powershell
cd C:\Projects\wedding-web\apps\api
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pytest
```

Frontend:

```powershell
cd C:\Projects\wedding-web
pnpm --filter @wedding/web lint
pnpm --filter @wedding/web typecheck
pnpm --filter @wedding/web build
```

## Production Smoke Test

Backend:

- `/health/live`
- `/api/v1/`
- `/api/v1/auth/csrf`

Frontend:

- public website `/id` dan `/en`
- packages page
- live preview semua paket
- `/admin/login`
- `/admin`
- `/admin/orders/{reference}`
- public invitation URL
- guest personal URL
- `/guest-delivery/{token}`
- `/guest-delivery/{token}/guests`
- `/guest-delivery/{token}/wishes`

Flow manual penting:

1. Staff login.
2. Staff tambah order.
3. Staff lengkapi tema, paket, acara, media, rekening, pembayaran.
4. Staff kirim preview customer.
5. Staff kirim link guest delivery ke client.
6. Client import CSV tamu.
7. Client cek daftar tamu dan kirim link personal.
8. Tamu buka link personal dan submit RSVP/ucapan.
9. Client lihat RSVP dan ucapan di tab Ucapan Tamu.
10. Staff publish/finalisasi sesuai workflow order.

## Dokumentasi Lanjutan

- [Architecture Overview](docs/architecture/overview.md)
- [Local Development](docs/operations/local-development.md)
- [Deployment](docs/operations/deployment.md)
- [Production Hardening](docs/operations/production-hardening.md)
- [Production Smoke Test](docs/operations/production-smoke-test.md)
- [API Docs](docs/api/README.md)
