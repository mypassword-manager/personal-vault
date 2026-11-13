# Vault Peribadi

Simpanan profil dan akaun laman web untuk kegunaan seorang. Semua data kekal dalam pelayar. Tiada pelayan, pangkalan data awan, atau analitik.

Kata laluan utama tidak disimpan. Jika terlupa, vault dan sandaran tidak boleh dibuka. Memadam data pelayar boleh menghapuskan salinan tempatan.

## Struktur

```text
personal-vault/
  index.html                 fail permulaan Vite sahaja
  src/main.js                titik masuk
  src/App.vue                rangka skrin
  src/styles.css             gaya
  src/components/            komponen Vue
  src/crypto/vault-crypto.js AES-GCM dan PBKDF2
  src/storage/vault-db.js    IndexedDB
  src/session/               kunci, kunci automatik, keadaan
```

## Jalankan

Perlu Node.js 20 atau lebih baharu.

```bash
cd personal-vault
npm install
npm run dev
```

Buka `http://localhost:8080`. Localhost ialah konteks selamat, jadi Web Crypto dan Salin berfungsi.

Untuk binaan produksi:

```bash
npm run build
npm run preview
```

## HTTPS

`crypto.subtle` tidak berfungsi pada halaman `http://` selain localhost. Safari di iPhone yang membuka komputer melalui alamat IP memerlukan HTTPS.

1. Jana sijil tempatan (contoh dengan mkcert), kemudian:
   ```bash
   npm run dev -- --host 0.0.0.0 --port 8080
   ```
2. Atau letakkan proksi HTTPS di hadapan pelayan tempatan dan buka `https://` pada telefon. Terima amaran sijil jika ia sijil sendiri.
3. Jangan buka vault melalui `http://192.168.x.x` — pelayar akan sekat Web Crypto.

## GitHub Pages

Binaan produksi menggunakan `base: '/personal-vault/'`, iaitu laman projek `https://USERNAME.github.io/personal-vault/`.

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) berjalan pada branch lalai `main` atau `master`: `npm install`, `npm run build`, kemudian hanya folder `dist` diterbitkan. Data vault, sandaran, `.env`, nama, IC dan kata laluan tidak disertakan.

GitHub Free hanya membenarkan Pages untuk repositori public. Jangan tukar visibility repo secara automatik.

## Neon

Log masuk menggunakan Neon Auth (GitHub atau Google). Pangkalan data Neon menyimpan satu baris vault tersulit bagi setiap pengguna. Kata laluan, IC dan kunci penyulitan tidak dihantar.

Salin `env` daripada `.env.example` ke `.env` dan isi `VITE_NEON_DATABASE_URL` dengan URL HTTPS tanpa kata laluan. Jangan guna `postgres://`. Untuk GitHub Actions, tambah pemboleh ubah repositori `VITE_NEON_DATABASE_URL` di **Settings → Secrets and variables → Actions → Variables**.

Jalankan [neon/vault.sql](neon/vault.sql) dalam SQL Editor Neon selepas Auth dan Data API dihidupkan. Dalam Neon: **Settings → Auth → Add OAuth provider → GitHub**. Callback yang ditunjuk ialah `{URL Auth Neon}/callback/github`. Tambah domain `https://USERNAME.github.io` sebagai trusted domain.

## Ujian

```bash
npm test
```

Ujian kripto menggunakan 600,000 lelaran PBKDF2, jadi ia mengambil sedikit masa.
