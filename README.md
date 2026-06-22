# BestHire — AI-Powered Career Portal

BestHire is a full-stack AI hiring platform built with **Next.js 15 App Router**, **Firebase**, and **Anthropic Claude**. It matches candidates to open roles using a live logistic-regression model that learns from every recruiter decision.

---

## Roles

| Role | What they can do |
|---|---|
| **Candidate** | Register/login, upload resume (PDF), browse open roles, apply, track application status |
| **Recruiter** | Login, post/manage jobs (unique Position IDs), review scored applications, approve/reject, trigger Google Calendar interview invites, monitor ML model |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router (TypeScript) |
| Auth | Firebase Auth — email/password, custom role claims |
| Database | Firestore (Admin SDK on server, client SDK in browser) |
| File Storage | Firebase Storage (resume PDFs, best-effort background save) |
| AI Parsing | Anthropic Claude `claude-sonnet-4-6` — native PDF document API (no pdf-parse) |
| ML Scoring | In-process logistic regression (`src/lib/ml-model.ts`) — org-level per recruiter |
| Calendar | Google Calendar API v3 |
| Styling | Tailwind CSS + shadcn/ui |

---

## Getting Started

```bash
npm install
vercel env pull .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Commands

```bash
npm run dev                              # Start dev server (Turbopack)
npm run build                           # Production build
npm run lint                            # ESLint
npx tsc --noEmit                        # Type-check
npm test                                # Jest unit tests
npx jest src/path/to/file.test.ts       # Single test file
npx ts-node scripts/setup-test-data.ts  # Seed Firestore with test data
vercel env pull .env.local              # Pull Vercel env vars locally
```

---

## Architecture

### Data Flows

1. **Resume upload** → multipart POST `/api/resumes/upload` → Claude parses PDF via native document API → stored in Firestore `resumes/{id}` → Storage save is best-effort background
2. **Candidate applies** → `POST /api/applications/apply` → application created → `/api/score` triggered → Claude computes feature vector → org-level ML weights applied → fit score (0–100) stored
3. **Recruiter decides** → approve/reject → `POST /api/ml/train` retrains one model across **all recruiter jobs** → weights saved to `mlModels/{recruiterId}`
4. **Interview** → `POST /api/calendar/schedule` → Google Calendar event → both parties invited

### Firestore Collections

```
users/{uid}              — role, profile, optional googleTokens
jobs/{jobId}             — positionId (BH-YYYY-NNNN), title, requirements, recruiterId, status
resumes/{resumeId}       — candidateId, storageUrl, parsedData, active, uploadedAt
applications/{appId}     — candidateId, jobId, resumeId, fitScore, featureVector, decision, scheduledAt
mlModels/{recruiterId}   — weights[], bias, trainedAt, sampleCount, positiveRate  ← org-level
counters/{id}            — position ID sequence counters
```

### ML Model

`src/lib/ml-model.ts` — logistic regression from scratch.

**Org-level:** One model per recruiter (`mlModels/{recruiterId}`), trained on all decisions across all jobs. No cold start on new roles.

| # | Feature | Description |
|---|---|---|
| f1 | `keywordMatchScore` | Fraction of job keywords in resume |
| f2 | `experienceMatchScore` | Candidate years vs required (clamped 0–1) |
| f3 | `educationScore` | Ordinal education level match |
| f4 | `skillsOverlapScore` | Jaccard similarity of skill sets |
| f5 | `claudeRawScore` | Claude's holistic 0–1 fit confidence |

Requires ≥ 5 decisions to activate. Default equal weights until then.

### Key API Routes

```
POST /api/resumes/upload               — PDF upload + Claude parse
POST /api/score                        — fit scoring (Claude + ML)
POST /api/applications/apply           — candidate applies to a job
PATCH /api/applications/[id]/decide   — recruiter approve/reject/undo
GET  /api/jobs/open                    — open jobs (candidates)
GET  /api/jobs                         — recruiter's own jobs
POST /api/jobs                         — create job posting
POST /api/ml/train                     — retrain org-level model
GET  /api/ml/status                    — org model status
GET  /api/ml/predict                   — predict score for a feature vector
POST /api/calendar/schedule            — Google Calendar interview event
```

### Auth & Middleware

Firebase custom claims (`role: "candidate" | "recruiter"`). `src/middleware.ts` enforces auth on every request — unauthenticated → `/login`, wrong role → `/unauthorized`.

---

## Environment Variables

```bash
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT_KEY   # JSON string, Admin SDK
ANTHROPIC_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

---

## Project Structure

```
src/
  app/
    candidate/        — vibrant dashboard, upload, application tracking
    recruiter/        — vibrant dashboard, jobs, applications, ML model tab (/recruiter/ml)
    api/              — resumes/upload, score, ml/*, jobs, applications, calendar
  lib/
    firebase.ts       — client Firebase init
    firebase-admin.ts — server Admin SDK (getAdminStorage always passes bucket)
    anthropic.ts      — parseResumeFromPDF(buffer) via native document API
    ml-model.ts       — train(), predict(), sigmoid(), defaultWeights()
    auth-helpers.ts   — verifyAuth(request, role)
  components/
    nav.tsx           — role-aware nav (Brain icon → ML tab for recruiters)
  types/index.ts      — shared TypeScript interfaces
scripts/
  setup-test-data.ts  — seed Firestore (recruiters, candidates, jobs, applications)
```

---

## Test Accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Recruiter 1 | recruiter1@besthire.dev | Test1234! |
| Recruiter 2 | recruiter2@besthire.dev | Test1234! |
| Candidate 1 | candidate1@besthire.dev | Test1234! |
| Candidate 2 | candidate2@besthire.dev | Test1234! |
