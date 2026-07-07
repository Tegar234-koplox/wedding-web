# Production smoke test

Gunakan checklist ini setelah deploy backend Railway dan frontend Vercel. Jalankan dari browser biasa dan satu sesi incognito agar session lama tidak menutupi masalah auth.

## 1. Backend readiness

- Buka `/health/live`; hasil harus `{"status":"ok"}`.
- Buka `/api/v1/`; hasil harus menampilkan nama dan versi API.
- Buka `/api/v1/auth/csrf`; hasil harus memiliki `csrfToken`.
- Cek Railway logs untuk 5xx baru setelah tiga endpoint di atas dibuka.

## 2. Staff session

- Buka `/admin`; user tanpa session harus diarahkan ke `/admin/login`.
- Login staff dengan akun produksi yang memiliki `role=staff` dan `is_staff=True`.
- Buka dashboard order dan tekan `Refresh`; user harus tetap berada di dashboard.
- Tekan `Export CSV`; file harus terunduh dan hanya berisi order aktif, bukan order archived.

## 3. Manual order flow

- Tambah order baru dengan format pasangan, misalnya `Reno dan Erisa`.
- Isi paket, harga, status pembayaran, tema, tanggal acara, lokasi, rekening, musik, dan slot foto wajib.
- Simpan detail dan buka link preview customer.
- Pastikan nama pasangan, media section, musik, gift, RSVP, dan closing tampil sesuai paket.

## 4. Guest delivery

- Tambah link tamu dengan nama tamu dan jumlah tamu.
- Copy link personal, buka di incognito, lalu submit RSVP dengan jumlah hadir yang valid.
- Pastikan dashboard staff memperbarui status RSVP dan export CSV tetap berjalan.
- Pastikan link undangan menampilkan `Untuk {nama tamu}` saat token guest valid.

## 5. Regression public site

- Buka homepage `/id` dan `/en`.
- Buka `/id/packages` dan satu live preview setiap paket.
- Cek tombol `BUKA UNDANGAN`, backsound, overlay tema, section gift, dan RSVP.
- Buka satu public invitation tanpa token preview dan pastikan tidak 404.

## 6. Post-check cleanup

- Arsipkan order test yang tidak dipakai.
- Simpan satu order demo rapi untuk regression manual berikutnya.
- Catat commit deploy, waktu test, dan hasil smoke test di catatan release.
