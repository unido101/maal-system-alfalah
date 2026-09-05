# PRD — BAITUL MAAL AL-FALAH

## Original Problem Statement
Internal management system (Indonesian) for Masjid Raya Al-Falah Sragen's Baitul Maal (charity/finance)
and Media/Content operations. Real full-stack app: DB persistence, auth, RBAC, CRUD, real relationships,
dynamic calculations, validation, search/filter, and loading/empty/error/success states.
Principle: DATA → INFORMATION → DECISION → ACTION. Manager understands org health in ~5 seconds.

## User Choices
- Auth: Emergent-managed Google login + email/password JWT (session_token, 7-day).
- Build all phases at once.
- Export (Excel/CSV/PDF): UI + backend structure, marked pending.
- Design: deep green / white / soft gold, fintech-clean.
- Payment Gateway/QRIS: pending integration (status recorded manually).

## Architecture
- Backend: FastAPI single file `/app/backend/server.py`, MongoDB (motor). Custom `id` string keys,
  soft-delete via `deleted_at`. Bearer session auth via `user_sessions` collection (TTL index).
- Frontend: Expo Router. `src/theme.ts`, `src/format.ts` (Rupiah/ID dates), `src/api.ts`, `src/auth.tsx`,
  `src/ui.tsx` (shared components). Screens under `app/(tabs)` + detail/create routes.
- RBAC enforced on backend (require_roles) and frontend (tab visibility, quick actions, report chips).

## User Personas
- Manajer: full access, command center, finance, users, all reports.
- Tim Konten: tasks/briefs/checklists/calendar + content report only.
- Fundraising/CS: donations, donors, programs, fundraising/donation/program reports.

## Core Requirements (static)
- Auth + protected routes + session persistence.
- Command center dashboard (Today/Fundraising/Content/Finance cards + "Perlu Perhatian" + quick actions).
- Content: tasks (category/priority/status), briefs, checklists w/ auto progress, calendar.
- Fundraising: donations, donors, programs w/ achievement %, dynamic relationships.
- Finance: expenses, summary (income/expenses/balance, SURPLUS/DEFICIT/BALANCED).
- Reports: fundraising/donation/program/expense/financial/content w/ filters + pending export.
- Search & filter across tasks/donors/donations/programs/expenses.

## Implemented (2026-09-02)
- ✅ Backend: full CRUD for users/programs/donors/donations/expenses/tasks/briefs/checklists;
  dashboard, finance summary, reports aggregations; RBAC; seed data (3 users, 4 programs, 5 donors,
  7 donations, 4 expenses, 5 tasks, 1 brief, 5 checklist items).
- ✅ Auth: email/password login + Emergent Google OAuth (`/api/auth/session`), unified session tokens.
- ✅ Frontend: login, command center dashboard, content (list + calendar + task detail w/ checklist,
  status, brief), fundraising (program/donation/donor + create donation w/ inline donor), reports,
  profile, user management, expenses list, dynamic create forms w/ validation + toasts.
- ✅ Real relationships verified: Paid donation → program raised, dashboard, finance income;
  expense → finance expenses + program remaining funds; checklist → auto progress %.
- ✅ Tested: 26/26 backend pytest + frontend flows + RBAC (content hides Donasi tab).

## Implemented — Alfalah AI Content Assistant (2026-09-02)
- ✅ LLM: Gemini 3 Flash (`gemini-3-flash-preview`) via emergentintegrations + EMERGENT_LLM_KEY.
- ✅ Content strategist system prompt encoding 6 Content DNA, Hook Engine, Show-Don't-Tell,
  Retention, Fundraising rule, Tone/Visual style, and strict Factual Integrity ([DATA DIPERLUKAN]).
- ✅ Endpoints: POST /api/ai/generate (program/idea/facility/fundraising context, reads verified DB
  program data — financials gated to manager), POST /api/ai/transform (7 actions), content-items CRUD +
  duplicate + soft-archive, POST /api/content-items/{id}/create-task, GET /api/ai/programs-context.
- ✅ Output package: title, content_dna, strategy, hook, 3 alt_hooks, scene-based script, shot_list,
  cta, caption, platform → persisted as Content Library item (Draft→Approved→In Production→Published→Archived).
- ✅ Program → AI → Content Item → Create Task: real task (Reels) with brief (hook/script/cta/caption/
  platform) + auto checklist from shot list, linked to program; appears in Content Tasks & Calendar;
  content item flips to In Production with related_task_id.
- ✅ Frontend: `/ai` assistant (quick-start + form + expandable result sections + transform buttons +
  create-task sheet), `/content-library` (search + status chips + history), `/content-item/[id]` (reopen,
  duplicate, archive), entry points on Home quick action, Konten tab header, and Program detail
  ("Buat Konten dengan AI"). RBAC: manager + content only (backend 403 + client redirect for fundraising).
- ✅ Tested: 22/22 AI backend pytest (real Gemini) + frontend flow + RBAC. Existing features regress-checked.

## Backlog / Remaining
- P1: Excel/CSV/PDF export implementation (currently pending stub).
- P1: Payment Gateway/QRIS auto-capture integration (currently manual status).
- P2: AI Content Assistant module (schema ready: PROGRAM → CONTENT IDEA → AI CONTENT → LIBRARY → TASK → CALENDAR).
- P2: Content Library storage (object storage) + reference attachments.
- P2: Edit flows for donations/programs/expenses (create + delete exist; program/donation edit via API ready).

## Demo Credentials (fictional)
- Manager: manager@alfalah.id / manager123
- Content: content@alfalah.id / content123
- Fundraising: cs@alfalah.id / cs123456
