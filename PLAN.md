# PLAN.md — BestHire Development Plan (Team of 6)

Restructured for parallel development. Six tracks run concurrently after a short foundation sprint. Each person owns a feature branch and merges in the order defined at the bottom.

---

## Team Work

| Person | Track | Branch |
|--------|-------|--------|
| P1 | Foundation + Auth | `foundation/phase-1`, `feature/phase-2-auth` |
| P2 | Recruiter Jobs API + Application Review API | `feature/phase-3-jobs-api`, `feature/phase-6-review-api` |
| P3 | All Recruiter UI | `feature/phase-3-jobs-ui`, `feature/phase-6-review-ui` |
| P4 | Resume Upload + Parsing + Candidate UI | `feature/phase-4-resume`, `feature/phase-5-candidate-ui` |
| P5 | ML Model + Scoring Pipeline | `feature/phase-5-scoring`, `feature/phase-6-ml-api` |
| P6 | Calendar + Tests + Seed Data | `feature/phase-7-calendar`, `feature/phase-8-hardening` |

---

## Step 0 — Foundation Sprint (P1 only, ~4 hours)

**Everyone else waits for this branch to merge before starting.** It establishes the project scaffold, shared types, and env contract that all other tracks import.

Branch: `foundation/phase-1` → merge to `develop` first

### Tasks

- [ ] Scaffold Next.js 15 project with TypeScript, Tailwind CSS, App Router (`create-next-app`)
- [ ] Install core dependencies: `firebase`, `firebase-admin`, `@anthropic-ai/sdk`, `googleapis`, `pdf-parse`, `shadcn/ui`
- [ ] Create `src/types/index.ts` — **complete** shared TypeScript interfaces: `User`, `Job`, `Resume`, `Application`, `MLModel`, `FeatureVector` (all other tracks import from here — define all fields now, even those used in later phases)
- [ ] Create `src/lib/firebase.ts` — client-side Firebase initialisation (guarded against double-init)
- [ ] Create `src/lib/firebase-admin.ts` — Admin SDK singleton via `FIREBASE_SERVICE_ACCOUNT_KEY` env var
- [ ] Create `src/middleware.ts` — stub: redirect unauthenticated users to `/login` (P1 extends this in Phase 2)
- [ ] Create `.env.local.example` listing all required env vars (see §Environment Variables)
- [ ] Write `firestore.rules` — candidates read/write own documents; recruiters read/write own jobs and all applications on those jobs
- [ ] Add `/unauthorized` page (minimal — role-mismatch message + logout button)
- [ ] Verify: `npm run dev` starts; navigating to `/candidate/dashboard` without auth redirects to `/login`

### Files Created
```
next.config.ts
tailwind.config.ts
firestore.rules
.env.local.example
src/types/index.ts          ← critical shared contract, define fully
src/middleware.ts
src/lib/firebase.ts
src/lib/firebase-admin.ts
src/app/layout.tsx
src/app/not-found.tsx
src/app/unauthorized/page.tsx
```

---

## Track A — Auth (P1)

Branch: `feature/phase-2-auth` off `foundation/phase-1`

Start: immediately after foundation sprint completes.

### Tasks

- [ ] Create `POST /api/auth/register` — create Firebase Auth user, set custom claim `{ role }` via Admin SDK, create `users/{uid}` Firestore document
- [ ] Create `/login` page — single form, email + password, role toggle (Candidate / Recruiter), inline error display
- [ ] Create `/register` page — name, email, password, role toggle; calls `/api/auth/register`; on success signs in and redirects
- [ ] Add `AuthProvider` context (`src/components/auth-provider.tsx`) — wraps app, exposes `useAuth()` hook returning `{ user, role, loading }`; calls `onIdTokenChanged` to keep token cookie fresh
- [ ] Extend `src/middleware.ts` — read role from decoded token claims; enforce `/candidate/*` vs `/recruiter/*` prefix matching
- [ ] Add logout button to shared nav; clears Firebase session + cookie, redirects to `/login`
- [ ] Verify: register as candidate → lands on `/candidate/dashboard`; register as recruiter → lands on `/recruiter/dashboard`; wrong-role URL → `/unauthorized`

### Files Created / Modified
```
src/app/login/page.tsx
src/app/register/page.tsx
src/app/api/auth/register/route.ts
src/components/auth-provider.tsx
src/components/nav.tsx
src/middleware.ts              ← modifies foundation stub (P1 owns both, no conflict)
```

---

## Track B — Recruiter Jobs API + Application Review API (P2)

Branch: `feature/phase-3-jobs-api` off `foundation/phase-1`

Start: immediately after Step 0. All routes are new files — no conflicts with other tracks.

### Phase 3 — Jobs API

- [ ] Create `POST /api/jobs` — Firestore transaction: read `counters/jobs/{recruiterId}/{year}`, increment, format `BH-{YYYY}-{seq:04d}`, write new `jobs/{jobId}` document
- [ ] Create `GET /api/jobs` — return all jobs for authenticated recruiter (filter by `recruiterId`, exclude `deleted`)
- [ ] Create `PATCH /api/jobs/[id]` — update mutable fields; reject `positionId` changes; validate `status` transitions
- [ ] Create `DELETE /api/jobs/[id]` — soft-delete: set `status: "deleted"`

### Phase 6 — Application Review API

> Start this after `feature/phase-5-scoring` is merged (P2 can stub the response shape and fill in Firestore queries early).

- [ ] Create `GET /api/applications` — query `applications` where `jobId` in recruiter's jobs; support query params: `jobId`, `status`, `minScore`, `maxScore`, `from`, `to`; join candidate name from `users/{uid}`
- [ ] Create `GET /api/applications/[id]` — single application detail (accessible by owner recruiter or the candidate themselves)
- [ ] Create `PATCH /api/applications/[id]/decide` — body `{ decision: "approved" | "rejected" | "undo" }`; validate undo within 30 min (`application.decidedAt`); update `decision`, `status`, `decidedAt`; **leave a clearly marked `// TODO: P6 wires calendar call here` comment** — P6 fills this in Phase 7

### Files Created
```
src/app/api/jobs/route.ts
src/app/api/jobs/[id]/route.ts
src/app/api/applications/route.ts
src/app/api/applications/[id]/route.ts
src/app/api/applications/[id]/decide/route.ts   ← P6 will add calendar call here
```

---

## Track C — All Recruiter UI (P3)

Branch: `feature/phase-3-jobs-ui` off `foundation/phase-1`

Start: immediately after Step 0. Use hardcoded mock data until Track B is merged; swap mocks for real `fetch()` calls during integration.

### Phase 3 — Jobs UI

- [ ] Create `/recruiter/dashboard` page — summary cards (open jobs count, total applications, pending review count); uses mock data initially
- [ ] Create `/recruiter/jobs` page — table of jobs with Position ID, title, status, application count, action buttons (Edit, Close, Delete)
- [ ] Create `/recruiter/jobs/new` page — form: title, department, description, requiredSkills (tag input), requiredExperienceYears, educationLevel; submits to `POST /api/jobs`
- [ ] Create `/recruiter/jobs/[id]/edit` page — pre-filled form; submits to `PATCH /api/jobs/[id]`
- [ ] Create `src/components/job-form.tsx`
- [ ] Create `src/components/skill-tag-input.tsx`

### Phase 6 — Application Review UI

> Can be built in parallel on the same branch using mock application data. Wire real API calls during integration.

- [ ] Create `/recruiter/applications` page — data table: Candidate, Position ID, Score, Status, Applied At, Actions; filters: job dropdown, status multi-select, score range slider, date range picker; default sort: score desc
- [ ] Create `/recruiter/applications/[id]` page — candidate details, resume link, Claude reasoning tooltip, fit score breakdown (feature bar chart), Approve / Reject buttons, Undo button (shown within 30-min window with countdown timer)
- [ ] Create `/recruiter/settings` page — Google Calendar connection status; "Connect Google Calendar" button
- [ ] Create `src/components/application-table.tsx`
- [ ] Create `src/components/feature-bar-chart.tsx`
- [ ] Create `src/components/undo-countdown.tsx`

### Files Created
```
src/app/recruiter/dashboard/page.tsx
src/app/recruiter/jobs/page.tsx
src/app/recruiter/jobs/new/page.tsx
src/app/recruiter/jobs/[id]/edit/page.tsx
src/app/recruiter/applications/page.tsx
src/app/recruiter/applications/[id]/page.tsx
src/app/recruiter/settings/page.tsx
src/components/job-form.tsx
src/components/skill-tag-input.tsx
src/components/application-table.tsx
src/components/feature-bar-chart.tsx
src/components/undo-countdown.tsx
```

---

## Track D — Resume Upload + Parsing + Candidate UI (P4)

Branch: `feature/phase-4-resume` off `foundation/phase-1`

Start: immediately after Step 0. `src/lib/anthropic.ts` has no external code deps — safe to build in isolation.

### Phase 4 — Resume Upload + Claude Parsing

- [ ] Create `src/lib/anthropic.ts` — Anthropic client singleton; `parseResume(text)` function encapsulating the structured extraction prompt
- [ ] Create `POST /api/resumes/upload` — verify PDF MIME + size ≤ 5 MB; return a Firebase Storage signed upload URL; mark previous resume as `active: false`
- [ ] Create `POST /api/resumes/parse` — receive `{ resumeId, storageUrl }`; download PDF bytes; extract text with `pdf-parse`; call `parseResume()`; validate response JSON; save `parsedData` to `resumes/{resumeId}`; **leave a clearly marked `// TODO: P5 adds scoring fan-out here` comment** after the save — P5 fills this when Phase 5 merges
- [ ] Create `/candidate/upload` page — drag-and-drop + file picker; client validates PDF + size before upload; shows progress bar; on success calls `/api/resumes/parse`; displays parsed data preview (skills chips, experience years, education)
- [ ] Create `src/components/resume-uploader.tsx`
- [ ] Create `src/components/parsed-resume-preview.tsx`

### Phase 5 — Candidate Dashboard UI

> Build with mock scored-application data first; wire real `/api/score` results during integration.

- [ ] Create `/candidate/dashboard` — if no active resume, show upload CTA; otherwise show application feed: card grid sorted by `fitScore` desc; each card shows job title, Position ID, fit score badge, status pill
- [ ] Update candidate dashboard to show `status === "interview_scheduled"` with event date/time beneath the status pill (Phase 7 field, just render it if present)
- [ ] Create `src/components/score-badge.tsx` — colour logic: ≥70 green, 40–69 amber, <40 red
- [ ] Create `src/components/application-card.tsx`

### Files Created
```
src/lib/anthropic.ts
src/app/api/resumes/upload/route.ts
src/app/api/resumes/parse/route.ts              ← P5 adds scoring fan-out here
src/app/candidate/dashboard/page.tsx
src/components/resume-uploader.tsx
src/components/parsed-resume-preview.tsx
src/components/score-badge.tsx
src/components/application-card.tsx
```

---

## Track E — ML Model + Scoring Pipeline (P5)

Branch: `feature/phase-5-scoring` off `foundation/phase-1`

Start: immediately after Step 0. `src/lib/ml-model.ts` is pure TypeScript with zero project dependencies — can be written and tested entirely in isolation.

### Phase 5 — ML Model + Scoring API

- [ ] Create `src/lib/ml-model.ts`:
  - `sigmoid(z: number): number`
  - `dot(a: number[], b: number[]): number`
  - `predict(features: number[], weights: number[], bias: number): number`
  - `train(examples: { features: number[]; label: number }[]): { weights: number[]; bias: number }` — gradient descent, lr=0.1, max 1000 iterations, early-stop on loss delta < 1e-6
  - `defaultWeights(): { weights: number[]; bias: number }` — equal weights [0.2, 0.2, 0.2, 0.2, 0.2], bias 0
- [ ] Create `src/lib/ml-model.test.ts` — unit tests: `sigmoid` boundary values, `predict` with known weights, `train` converges on linearly-separable dataset (no Firestore needed)
- [ ] Create `POST /api/score` — receive `{ resumeId, jobId, appId }`; load parsed resume + job; call Claude fit scoring prompt; compute deterministic features; load ML weights from `mlModels/{jobId}` (or defaults); compute `fitScore`; write to `applications/{appId}`

### After Track D and Track B are merged (P5 rebase step):

- [ ] Rebase `feature/phase-5-scoring` onto `develop` after Phase 4 merges
- [ ] Fill in the `// TODO: P5 adds scoring fan-out here` in `src/app/api/resumes/parse/route.ts` — fan out `POST /api/score` calls for all open jobs after parse succeeds (fire-and-forget)
- [ ] Add scoring fan-out in `src/app/api/jobs/route.ts` — after job created, fan out `POST /api/score` for all candidates with active resumes (P2 must have merged first; P5 adds this as a follow-up commit on the integration branch)
- [ ] Auto-create `applications/{appId}` on each (candidateId, jobId) pair before scoring if it doesn't exist (Firestore transaction to prevent duplicates)

### Phase 6 — ML Retraining API

- [ ] Create `POST /api/ml/train` — load all decided applications for `jobId`; skip if < 5 examples; run `mlModel.train()`; write results to `mlModels/{jobId}`; fan out re-scoring for all `status: "pending"` applications on that job
- [ ] Create `GET /api/ml/predict` — receive feature vector; load model weights; return predicted probability

### Files Created / Modified
```
src/lib/ml-model.ts
src/lib/ml-model.test.ts
src/app/api/score/route.ts
src/app/api/ml/train/route.ts
src/app/api/ml/predict/route.ts
src/app/api/resumes/parse/route.ts              ← adds scoring fan-out (after P4 merges)
src/app/api/jobs/route.ts                       ← adds scoring fan-out (after P2 merges)
```

---

## Track F — Calendar + Tests + Seed Data (P6)

Branch: `feature/phase-7-calendar` off `foundation/phase-1`

Start: immediately after Step 0. `src/lib/google-calendar.ts` is a pure library with no project deps — safe to build in isolation. Jest config and seed script can also start immediately.

### Phase 7 — Google Calendar Integration

- [ ] Create `src/lib/google-calendar.ts`:
  - `getOAuthClient(tokens)` — OAuth2 client from `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - `findNextSlot(recruiterTimezone, existingEvents)` — returns next available weekday 10:00 / 14:00 / 16:00 at least 48 h from now
  - `createInterviewEvent({ recruiterTokens, candidateEmail, recruiterEmail, job, application })` → `{ eventId, startTime }`
  - `cancelEvent(recruiterTokens, eventId)` — deletes event via Google Calendar API
- [ ] Create `GET /api/calendar/auth` — generate Google OAuth2 consent URL with `calendar.events` scope; redirect recruiter
- [ ] Create `GET /api/calendar/callback` — exchange code for tokens; encrypt and store in `users/{uid}.googleTokens`; redirect to `/recruiter/settings`
- [ ] Create `POST /api/calendar/schedule` — load recruiter tokens; call `createInterviewEvent`; update `application.status`, `scheduledAt`, `calendarEventId`
- [ ] Create `DELETE /api/calendar/schedule` — call `cancelEvent`; clear `scheduledAt` and `calendarEventId` on application

### After Track B (Phase 6 decide route) is merged (P6 rebase step):

- [ ] Rebase `feature/phase-7-calendar` onto `develop`
- [ ] Fill in `// TODO: P6 wires calendar call here` in `src/app/api/applications/[id]/decide/route.ts` — call `POST /api/calendar/schedule` on approve; call `DELETE /api/calendar/schedule` on undo

### Phase 8 — Hardening + Seed Data + Tests

- [ ] Create `scripts/setup-test-data.ts`:
  - 2 recruiter accounts: `recruiter1@besthire.dev` / `recruiter2@besthire.dev` (password: `Test1234!`)
  - 3 candidate accounts: `alice@candidate.dev`, `bob@candidate.dev`, `carol@candidate.dev` (password: `Test1234!`)
  - 5 open job postings across the 2 recruiters with varied requirements
  - 3 pre-parsed resumes (one per candidate) with realistic skills/experience
  - Pre-scored applications covering all (candidate, job) pairs
  - 2 recruiter decisions (one approve, one reject) so ML model is partially trained
- [ ] Set up `jest.config.ts`
- [ ] Write `src/lib/anthropic.test.ts` — mock Anthropic client; verify `parseResume` prompt includes required JSON schema; verify response parsing handles `null` fields
- [ ] Write `src/app/api/applications/[id]/decide/route.test.ts` — undo blocked after 30 min; approve triggers calendar call; reject does not
- [ ] Write `src/app/api/jobs/route.test.ts` — concurrent POST requests produce unique Position IDs
- [ ] Hardening: enforce PDF size limit server-side in `/api/resumes/upload` (reject > 5 MB with 413)
- [ ] Hardening: add 30-minute undo lock check on server (not just UI hide) in `/api/applications/[id]/decide`
- [ ] Hardening: add Google token refresh logic in `google-calendar.ts` — silently refresh if access token expired
- [ ] Hardening: loading skeletons on candidate dashboard, recruiter application table, and job list
- [ ] Hardening: confirm Position ID counter transaction prevents duplicates (load-test with 10 simultaneous requests)

### Files Created / Modified
```
src/lib/google-calendar.ts
src/app/api/calendar/schedule/route.ts
src/app/api/calendar/auth/route.ts
src/app/api/calendar/callback/route.ts
src/app/api/applications/[id]/decide/route.ts   ← adds calendar wiring (after P2 merges)
scripts/setup-test-data.ts
jest.config.ts
src/lib/anthropic.test.ts
src/lib/ml-model.test.ts                        ← coordinate with P5 (P6 may write, P5 reviews)
src/app/api/applications/[id]/decide/route.test.ts
src/app/api/jobs/route.test.ts
```

---

## Branch & Merge Protocol

### Branch naming
```
foundation/phase-1
feature/phase-2-auth
feature/phase-3-jobs-api
feature/phase-3-jobs-ui
feature/phase-4-resume
feature/phase-5-scoring
feature/phase-6-review-api
feature/phase-6-review-ui        ← same branch as phase-3-jobs-ui for P3
feature/phase-7-calendar
feature/phase-8-hardening
```

### Merge order (strict)

Merge to `develop` in this sequence. Never skip a step.

```
1.  foundation/phase-1           (P1 — unblocks all others)
2.  feature/phase-2-auth         (P1 — rebase onto step 1 first)
3a. feature/phase-3-jobs-api     (P2 — rebase onto step 2)
3b. feature/phase-4-resume       (P4 — rebase onto step 2; parallel with 3a)
4.  feature/phase-3-jobs-ui      (P3 — rebase onto step 3a; no file conflicts)
5.  feature/phase-5-scoring      (P5 — rebase onto develop after 3a+3b merged;
                                       fills fan-out TODOs in parse + jobs routes)
6.  feature/phase-6-review-api   (P2 — rebase onto step 5)
7.  feature/phase-6-review-ui    (P3 — rebase onto step 6; P3's branch already
                                       has recruiter UI, just wire real API calls)
8.  feature/phase-7-calendar     (P6 — rebase onto step 6;
                                       fills calendar TODO in decide route)
9.  feature/phase-8-hardening    (P6 — rebase onto step 8)
```

### Conflict zones and resolutions

These three files are intentionally left with `// TODO` stubs so each owner fills them in at rebase time — not during initial development.

| File | Created by | Modified by | Resolution |
|------|-----------|-------------|------------|
| `src/middleware.ts` | P1 (foundation) | P1 (auth) | Same person — no conflict |
| `src/app/api/resumes/parse/route.ts` | P4 | P5 fills fan-out TODO | P5 rebases onto develop after P4 merges, then fills the stub |
| `src/app/api/jobs/route.ts` | P2 | P5 fills fan-out TODO | P5 rebases onto develop after P2 merges, then fills the stub |
| `src/app/api/applications/[id]/decide/route.ts` | P2 | P6 fills calendar TODO | P6 rebases onto develop after P2 merges Phase 6 API |

### Daily sync checkpoints

- **Day 1 end**: `foundation/phase-1` merged. All 5 others pull and start branches.
- **Day 2 end**: `feature/phase-2-auth` merged. All others rebase.
- **Mid-project**: P2 + P4 open PRs for jobs-api and resume. P5 reviews to validate types are correct before their scoring work.
- **Integration day**: Merge 3a → 3b → 5 in quick succession. P3 + P4 wire mock data to real API calls.
- **Final day**: P6 merges calendar + hardening. Full smoke test with seed data.

---

## Dependency Graph

```
Step 0 — foundation/phase-1
  └── Track A: phase-2-auth (P1)
        ├── Track B: phase-3-jobs-api (P2) ──────────────────────────────┐
        │     └── Track B: phase-6-review-api (P2) ──────────────────────┤
        ├── Track C: phase-3-jobs-ui (P3) ───────────────────────────────┤
        │     └── Track C: phase-6-review-ui (P3) ───────────────────────┤
        ├── Track D: phase-4-resume (P4) ────────────────────────────────┤
        │     └── Track D: phase-5-candidate-ui (P4) ────────────────────┤
        ├── Track E: phase-5-scoring (P5) [ml-model pure — starts day 1] ┤
        │     └── Track E: phase-6-ml-api (P5) ──────────────────────────┤
        └── Track F: phase-7-calendar (P6) [lib pure — starts day 1] ────┘
              └── Track F: phase-8-hardening (P6)
```

---

## Environment Setup Checklist

All team members must complete this before starting their branch.

- [ ] Firebase project created; Auth (email/password), Firestore, and Storage enabled
- [ ] Firebase service account JSON downloaded → set as `FIREBASE_SERVICE_ACCOUNT_KEY` (stringified)
- [ ] `NEXT_PUBLIC_FIREBASE_*` values copied from Firebase console
- [ ] `ANTHROPIC_API_KEY` obtained from console.anthropic.com
- [ ] Google Cloud project created; Calendar API enabled; OAuth2 credentials created → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- [ ] `.env.local` created from `.env.local.example` (after P1 creates the example file in Step 0)
