# LiquorSafe — Setup Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Expo CLI: `npm install -g expo-cli`

---

## 1. Install dependencies

```bash
pnpm install
```

---

## 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET
```

---

## 3. Database setup

```bash
# Generate Prisma client
pnpm db:generate

# Apply schema to DB
pnpm db:migrate

# Seed demo data (4 brands, 3 boxes, 3 staff users)
pnpm db:seed
```

Default seed credentials:
| Employee ID | PIN  | Role  |
|-------------|------|-------|
| EMP-0001    | 1234 | Admin |
| EMP-0002    | 5678 | Staff |
| EMP-0003    | 9012 | Staff |

---

## 4. Run the API server

```bash
pnpm dev:api
# Runs on http://localhost:3001
# Health check: GET /health
```

---

## 5. Run the web dashboard

```bash
pnpm dev:web
# Runs on http://localhost:3000
```

---

## 6. Run the mobile app

```bash
cd apps/mobile

# Add sound files to assets/ (beep.mp3, error.mp3)
# Update EXPO_PUBLIC_API_URL in app.json to your machine's LAN IP

expo start
```

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/src/utils/constants.ts` to your local IP (e.g. `http://192.168.1.x:3001`) so the device can reach the API.

---

## 7. Run tests

```bash
# Integration tests (requires live DB)
pnpm test
```

---

## Architecture Notes

### Concurrent Scan Deduplication
The `/api/scan/batch-sync` endpoint processes scans inside a `prisma.$transaction`. For each QR scan, it checks `scanLog` for prior non-duplicate entries in the same session before creating the new log. Race conditions between 2–5 simultaneous devices are handled by the unique constraint on `bottles.stateExciseQrString` — a bottle can only appear once, so duplicate QR resolution always resolves to the same `bottleId`.

### Blind Counting
The mobile scanner intentionally never displays expected counts during active scanning. The counter only shows the running total of scanned bottles. The expected quantity is only shown in the discrepancy matrix on the web dashboard after a session is closed.

### Status State Machine
```
INWARDED → ON_SHELF → SOLD
                   ↓
           DAMAGED_MANUAL
           DAMAGED_PHOTO
```

### PDF Export
Generated server-side via pdfkit. Content is streamed as a binary blob with `Content-Disposition: attachment`. Headers include `Cache-Control: no-store` to prevent caching of compliance documents.
