# Project Concept (React)

Aplikasi PWA untuk memetakan konsep project lewat canvas visual (node + koneksi seperti n8n).

## Setup deploy otomatis ke GitHub Pages

1. **Buat repo baru di GitHub**, upload semua isi folder ini (kecuali `node_modules` dan `dist`, yang sudah otomatis diabaikan lewat `.gitignore`).

2. **Sesuaikan nama repo di `vite.config.js`** — buka file itu dan ganti baris:
   ```js
   const REPO_NAME = 'project-concept'
   ```
   menjadi nama repo GitHub kamu yang sebenarnya (harus sama persis, termasuk huruf besar/kecil).

3. **Aktifkan GitHub Pages dengan sumber "GitHub Actions":**
   - Buka repo di GitHub → Settings → Pages
   - Pada bagian "Build and deployment" → Source, pilih **GitHub Actions** (bukan "Deploy from a branch").

4. **Push ke branch `main`.** GitHub Actions (`.github/workflows/deploy.yml`) akan otomatis:
   - Install semua dependency (`npm install`)
   - Build project React jadi file statis (`npm run build`)
   - Deploy hasil build ke GitHub Pages

5. Tunggu 1-2 menit, cek tab **Actions** di repo untuk lihat progress build. Kalau sukses (centang hijau), buka `https://username.github.io/nama-repo/`.

## Update selanjutnya

Setiap kali kamu (atau saya) mengedit file di folder `src/`, kamu tinggal:
1. Timpa file yang berubah di GitHub (edit langsung di web GitHub, atau upload ulang file yang berubah).
2. Commit ke branch `main`.
3. GitHub Actions otomatis build & deploy ulang — kamu tidak perlu install Node.js atau build manual sama sekali.

## Develop di lokal (opsional, kalau punya laptop dengan Node.js)

```bash
npm install
npm run dev       # jalankan mode development di localhost
npm run build     # build manual ke folder dist/
```

## Struktur folder

```
src/
  main.jsx              — entry point React
  App.jsx                — router antara daftar project & canvas
  db.js                   — penyimpanan IndexedDB
  utils.js                — helper (uid, kompresi gambar, bezier path)
  exportPdf.js             — logika export canvas ke PDF
  styles.css               — semua styling
  components/
    ProjectList.jsx         — halaman daftar project
    CanvasScreen.jsx         — canvas node-editor utama
    NodeItem.jsx              — satu kotak node (teks/gambar)
    Toast.jsx                  — notifikasi kecil
public/
  icons/                       — ikon PWA
.github/workflows/deploy.yml    — otomasi build & deploy
vite.config.js                   — konfigurasi build + PWA
```
