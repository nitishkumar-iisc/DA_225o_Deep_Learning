# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BestHire is a full-stack AI-powered career portal built with Next.js (App Router), Firebase, and Claude AI. Two user roles exist:

- **Candidates** — register/login, upload resumes, receive AI-generated fit scores against every open role
- **Recruiters** — login with email+password, create/manage job postings (each has a unique Position ID), review scored applications, approve/reject candidates, trigger Google Calendar interview scheduling, view ML model status

An in-process logistic regression model retrains on each recruiter decision. The model is **org-level** — one model per recruiter trained across ALL their jobs, stored at `mlModels/{recruiterId}`.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npx tsc --noEmit
npm test
npx jest src/path/to/file.test.ts
npx ts-node scripts/setup-test-data.ts
vercel env pull .env.local
```

## Architecture

### Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router (TypeScript) |
| Auth | Firebase Auth (email/password for both roles) |
| Database | Firebase Firestore |
| File Storage | Firebase Storage (resume PDFs, best-effort background save) |
| AI Parsing | Anthropic Claude (`claude-sonnet-4-6`) — native PDF document API (no pdf-parse library) |
| ML Scoring | In-process logistic regression in `src/lib/ml-model.ts` |
| Calendar | Google Calendar API v3 via `/api/calendar/schedule` |
| Styling | Tailwind CSS + shadcn/ui |

### Data Flows

1. **Resume upload** → multipart FormData to `/api/resumes/upload` → Claude parses PDF via base64 document block → stored in Firestore `resumes/{id}` → Storage save is best-effort in `after()` (non-fatal if it fails)
2. **Fit scoring** → `/api/score` → Claude produces raw score + feature vector → org-level logistic regression applies learned weights → score stored on `applications/{id}`
3. **Recruiter decision** → approve/reject → `/api/ml/train` retrains on **all labelled applications across all recruiter jobs** → weights persisted to `mlModels/{recruiterId}`
4. **Interview scheduling** → `/api/calendar/schedule` → Google Calendar creates event → both parties invited

### Firestore Collections

```
users/{uid}              — role: "candidate" | "recruiter", profile
jobs/{jobId}             — positionId (BH-YYYY-NNNN), title, requirements, recruiterId, status
resumes/{resumeId}       — candidateId, storageUrl, parsedData, active, uploadedAt
applications/{appId}     — candidateId, jobId, resumeId, fitScore, featureVector, decision, scheduledAt
mlModels/{recruiterId}   — weights[], bias, trainedAt, sampleCount, positiveRate  ← ONE per recruiter
counters/{id}            — position ID sequence counters per recruiter per year
```

### Key Source Paths

```
src/app/
  candidate/              — vibrant dashboard, resume upload, application list
  recruiter/              — vibrant dashboard, job management, application review, ML tab (/recruiter/ml)
  api/
    resumes/upload/       — Claude PDF parsing (multipart, no pdf-parse)
    score/                — fit scoring (Claude + ML)
    ml/train/             — logistic regression retraining (org-level)
    ml/predict/           — scoring with current model weights
    ml/status/            — org model status for recruiter dashboard
    calendar/schedule/    — Google Calendar event creation
    jobs/                 — CRUD for job postings
    jobs/open/            — open jobs list for candidates
    applications/apply/   — candidate explicit apply
    applications/[id]/decide/ — recruiter approve/reject/undo

src/lib/
  firebase.ts             — client-side Firebase init
  firebase-admin.ts       — server-side Admin SDK; getAdminStorage() always passes bucket name explicitly
  anthropic.ts            — parseResumeFromPDF(buffer) via native document API
  ml-model.ts             — train(), predict(), sigmoid(), defaultWeights()
  google-calendar.ts      — OAuth2 + createEvent()
  auth-helpers.ts         — verifyAuth(request, role)

src/components/
  nav.tsx                 — role-aware nav; Brain icon → /recruiter/ml tab
```

### ML Model

`src/lib/ml-model.ts` implements logistic regression from scratch.

**Org-level:** Stored at `mlModels/{recruiterId}` — one model per recruiter across ALL jobs. Eliminates cold start on new roles. Minimum 5 decisions to activate.

Features: `keywordMatchScore`, `experienceMatchScore`, `educationScore`, `skillsOverlapScore`, `claudeRawScore`.

Score route loads model via `job.recruiterId`. Train endpoint accepts `{ recruiterId }` and chunks Firestore `in` queries at 30.

### Candidate Dashboard UX

- **My Applications** — explicitly applied jobs; status badge (Scoring / Under Review / Approved / Rejected); no numeric score; "★ Recommended" badge only if `fitScore >= 60`
- **Open Positions** — all open jobs with no application; "Apply Now" button
- No auto fan-out — candidates choose which jobs to apply to

### Recruiter Dashboard UX

- Gradient hero banner (blue → indigo → violet) with stat cards floating up (`-mt-10` + `z-10`)
- Each job row has a rotating colour palette (blue, violet, emerald, rose, amber)
- Quick links row: Review Applications + ML Hiring Model

### Environment Variables

```
NEXT_PUBLIC_FIREBASE_*        — Firebase client config (public)
FIREBASE_SERVICE_ACCOUNT_KEY  — JSON string, Admin SDK (server only)
ANTHROPIC_API_KEY             — Claude API key (server only)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```
