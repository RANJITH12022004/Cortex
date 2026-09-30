# Cortex — Production & Warehouse Management System

React + Vite + TypeScript PWA backed by Supabase (Postgres, Auth, Edge Functions).

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local dev and migrations)
- A Supabase project (cloud) for deployment

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Design system (Google Stitch)

UI follows the **Industrial Precision System** design imported from Google Stitch:

- [`DESIGN.md`](DESIGN.md) — colors, typography, spacing, component rules
- [`stitch-import/`](stitch-import/) — reference HTML screens from Stitch
- Re-import: `npm run import:stitch` (requires `STITCH_API_KEY` in env)

Read `DESIGN.md` before building or modifying any UI component.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build (includes PWA assets) |
| `npm run preview` | Preview production build |
| `npm run import:stitch` | Download DESIGN.md + screen HTML from Google Stitch |

## Project structure

```
src/
  app/                 # Router, layout, role landing stubs
  features/auth/       # Login, invite flow, guards, session
  lib/supabase.ts      # Typed Supabase client
  types/database.ts    # DB types (replace via supabase gen types)
supabase/
  migrations/          # Schema + RLS SQL
  functions/invite-user # Invite-only user creation (service role)
docs/
  SUPABASE_MANUAL_SETUP.md
```

## Supabase setup

Follow **[docs/SUPABASE_MANUAL_SETUP.md](docs/SUPABASE_MANUAL_SETUP.md)** for:

- Running migrations
- Disabling public signup
- Zoho SMTP configuration
- Auth redirect URLs
- Seeding the first admin
- Deploying the `invite-user` Edge Function
- Regenerating TypeScript types

## Auth model

- **Invite-only:** no public registration form
- **Admin** invites **Manager**; **Manager** invites **Employee** or **Procurement**
- Invites run through the `invite-user` Edge Function (never expose service role key to the client)
- Session persists via Supabase access/refresh tokens only — passwords are never stored on device

## Role default routes

| Role | Route |
|---|---|
| Admin | `/admin` |
| Manager | `/dashboard` |
| Procurement | `/procurement` |
| Employee | `/tasks` |

## Further reading

- [PRD.md](PRD.md) — product requirements
- [.cursorrules](.cursorrules) — build constraints
