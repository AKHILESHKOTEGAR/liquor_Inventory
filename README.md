<div align="center">

```
██╗     ██╗ ██████╗ ██╗   ██╗ ██████╗ ██████╗ ███████╗ █████╗ ███████╗███████╗
██║     ██║██╔═══██╗██║   ██║██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝██╔════╝
██║     ██║██║   ██║██║   ██║██║   ██║██████╔╝███████╗███████║█████╗  █████╗  
██║     ██║██║▄▄ ██║██║   ██║██║   ██║██╔══██╗╚════██║██╔══██║██╔══╝  ██╔══╝  
███████╗██║╚██████╔╝╚██████╔╝╚██████╔╝██║  ██║███████║██║  ██║██║     ███████╗
╚══════╝╚═╝ ╚══▀▀═╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝
```

**Blind inventory audit system for government-licensed liquor stores**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.29-000000?style=flat-square&logo=fastify)](https://fastify.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Expo](https://img.shields.io/badge/Expo-51-000020?style=flat-square&logo=expo)](https://expo.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

---

## 🛡️ What is LiquorSafe?

LiquorSafe is a **full-stack inventory audit platform** built for government-licensed liquor stores. Staff scan bottle QR codes (State Excise labels) on mobile during a blind audit session — they never see expected stock counts. Managers and owners view real-time discrepancies, verify sessions, and export compliance reports.

> Built to be shown to government inspectors. Every scan logged. Every surplus flagged. Every session signed off.

---

## 🏗️ Architecture

```
liquor-inventory/
├── apps/
│   ├── web/          → Next.js 14 dashboard (Vercel)
│   └── mobile/       → Expo React Native scanner app (EAS Build)
├── packages/
│   ├── api/          → Fastify REST API (Railway)
│   └── db/           → Prisma schema + client (PostgreSQL)
├── Dockerfile        → Railway API container
└── railway.toml      → Railway deployment config
```

```
┌─────────────────┐     HTTPS      ┌──────────────────────┐
│   Web Dashboard │ ──────────────▶│                      │
│   (Next.js 14)  │                │   Fastify REST API   │
│   Vercel        │                │   Railway            │
└─────────────────┘                │                      │
                                   └──────────┬───────────┘
┌─────────────────┐     HTTPS               │
│  Mobile Scanner │ ──────────────▶          │ Prisma ORM
│  Expo / RN      │                          ▼
│  iOS + Android  │               ┌──────────────────────┐
└─────────────────┘               │   PostgreSQL 15       │
                                  │   Railway            │
                                  └──────────────────────┘
```

---

## ✨ Features

### 🔐 Role-Based Access
| Role | Access |
|------|--------|
| **OWNER** | All stores, all data, create managers, view all reports |
| **ADMIN** (Manager) | Single store, manage staff, verify sessions |
| **STAFF** | Mobile app only — scan bottles during audit sessions |

### 📱 Mobile Scanner (Expo)
- Scan State Excise QR codes via camera
- Manual serial entry fallback (max 10 per session — fraud guard)
- Photo fallback for damaged QR labels
- Blind audit — staff never see expected stock counts
- Offline-tolerant with optimistic UI

### 🖥️ Web Dashboard
- **Real-time session monitoring** — see active scans live
- **Discrepancy matrix** — snapshot vs actual, bottle-by-bottle
- **Calendar view** — click any date to see who worked, scans made
- **Surplus detection** — flags when scanned > expected, requires manager notes to close
- **Session verification** — manager sign-off with verifiedBy stamp
- **Export** — PDF audit reports, monthly CSV
- **Date range filtering** — filter sessions by any date range

### 🔒 Security (13 hardened controls)
- JWT with JTI claims — every token uniquely identified
- In-memory JTI deny list — logout actually revokes tokens
- MANUAL_SERIAL scan cap (10/session) — blocks fake entry fraud
- Snapshot-based discrepancy — stock frozen at session start, manipulation-proof
- BoxId store validation — cross-store scan injection blocked
- Auto-close stale sessions (12h) — no ghost session locks
- Session manager sign-off workflow
- Surplus notes required to close surplus sessions
- bcrypt PIN hashing (12 rounds in production)
- Rate limiting — 8 login attempts per 15 min per IP
- CORS origin whitelist in production
- Role-scoped store access — ADMIN sees only their store
- First-time setup endpoint — disabled after initial OWNER created

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

### 1. Install

```bash
git clone <repo-url>
cd liquor-inventory
pnpm install
```

### 2. Environment

```bash
# API
cp packages/api/.env.example packages/api/.env
# Edit: DATABASE_URL, JWT_SECRET

# Web
cp apps/web/.env.example apps/web/.env.local
# Edit: NEXT_PUBLIC_API_URL=http://localhost:3001

# Mobile
cp apps/mobile/.env.example apps/mobile/.env.local
# Edit: EXPO_PUBLIC_API_URL=http://localhost:3001
```

### 3. Database

```bash
npx prisma db push --schema=packages/db/prisma/schema.prisma
npx prisma db seed --schema=packages/db/prisma/schema.prisma   # optional demo data
```

### 4. Run

```bash
# Terminal 1 — API
pnpm --filter @liquor/api dev

# Terminal 2 — Web
pnpm --filter @liquor/web dev

# Terminal 3 — Mobile
pnpm --filter @liquor/mobile start
```

Web dashboard → `http://localhost:3000`
API → `http://localhost:3001`

> **First time?** Visit `http://localhost:3000/setup` to create your owner account.

> **UI went blank?** Run `bash restart-web.sh` — clears stale Next.js cache.

---

## ☁️ Production Deployment

### Railway (API + PostgreSQL)

1. Push code to GitHub
2. Create new Railway project → **Deploy from GitHub**
3. Add **PostgreSQL** service — Railway auto-sets `DATABASE_URL`
4. Set environment variables:
   ```
   JWT_SECRET=<64-char random hex>
   JWT_EXPIRES_IN=8h
   NODE_ENV=production
   BCRYPT_ROUNDS=12
   CORS_ORIGIN=https://your-app.vercel.app
   UPLOAD_DIR=/tmp/uploads
   ```
5. Railway auto-detects `Dockerfile` and `railway.toml`
6. First deploy runs `prisma db push` automatically

### Vercel (Web Dashboard)

1. Import repo to Vercel → select `apps/web`
2. Framework: **Next.js** (auto-detected)
3. Set environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.railway.app
   ```
4. Deploy → done

### EAS Build (Mobile APK / iOS)

```bash
cd apps/mobile
eas build --profile preview --platform android    # APK for Android
eas build --profile production --platform ios     # iOS (Apple Developer account required)
```

Update `apps/mobile/eas.json` with your Railway API URL before building.

---

## 📐 Database Schema

```
User ──────────── StoreOwner ─── Store
 │  (OWNER/ADMIN/STAFF)              │
 │                                   ├── Box ─── Bottle
 │                                   │
 └── AuditSession ─── ScanLog ───────┘
       │
       └── snapshotData (JSON)   ← stock frozen at session start
           verifiedBy (String)   ← manager sign-off
           surplusNotes (String) ← required if surplus detected
```

---

## 🔑 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | — | Login, returns JWT |
| `DELETE` | `/api/auth/logout` | JWT | Revoke token (JTI deny) |
| `GET` | `/api/setup/status` | — | Is system initialized? |
| `POST` | `/api/setup` | — | First-time owner setup |
| `GET` | `/api/audit/sessions` | JWT | List sessions (date filter) |
| `GET` | `/api/audit/sessions/calendar` | JWT | Monthly session heatmap |
| `POST` | `/api/audit/sessions` | JWT | Start audit session |
| `PATCH` | `/api/audit/sessions/:id/close` | JWT | Close session |
| `PATCH` | `/api/audit/sessions/:id/verify` | ADMIN | Manager sign-off |
| `GET` | `/api/audit/sessions/:id/discrepancy` | JWT | Snapshot vs actual |
| `POST` | `/api/scan/batch` | JWT | Submit scans |
| `GET` | `/api/workers` | ADMIN | List staff |
| `GET` | `/api/workers/managers` | OWNER | List managers |
| `POST` | `/api/workers` | ADMIN | Create staff / manager |
| `GET` | `/api/export/:id/pdf` | ADMIN | PDF audit report |
| `GET` | `/health` | — | Health check |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Web Frontend | Next.js 14, React 18, TailwindCSS, TanStack Query |
| Mobile | Expo 51, React Native, Expo Camera |
| API | Fastify 4, Zod, @fastify/jwt, @fastify/rate-limit |
| ORM | Prisma 5, PostgreSQL 15 |
| Auth | JWT (HS256) + JTI deny list |
| Monorepo | pnpm workspaces |
| API Deploy | Railway (Docker) |
| Web Deploy | Vercel |
| Mobile Build | EAS Build (Expo) |

---

## 📁 Environment Variables

### `packages/api/.env`
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=<64-char hex>
JWT_EXPIRES_IN=8h
NODE_ENV=production
PORT=3001
BCRYPT_ROUNDS=12
CORS_ORIGIN=https://your-app.vercel.app
UPLOAD_DIR=/tmp/uploads
MAX_FILE_SIZE_MB=5
```

### `apps/web/.env.local`
```env
NEXT_PUBLIC_API_URL=https://your-api.railway.app
```

### `apps/mobile/.env.local`
```env
EXPO_PUBLIC_API_URL=https://your-api.railway.app
```

---

## 👥 Roles & Workflow

```
         OWNER creates store
              │
              ▼
         OWNER creates ADMIN (Manager)
              │
              ▼
         ADMIN creates STAFF workers
              │
              ▼
         STAFF scans bottles on mobile
              │
              ▼
         ADMIN reviews discrepancy report
              │
              ▼
         ADMIN verifies + signs off session
              │
              ▼
         OWNER exports compliance report
```

---

<div align="center">

Built with ❤️ for government compliance and loss prevention.

*Every bottle accounted for. Every session signed.*

</div>
