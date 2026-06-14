# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BestHire is a full-stack AI-powered career portal built with Next.js (App Router), Firebase, and Claude AI. Two user roles exist:

- **Candidates** — register/login, upload resumes, receive AI-generated fit scores against every open role
- **Recruiters** — login with email+password, create/manage job postings (each has a unique Position ID), review scored applications, approve/reject candidates, and trigger Google Calendar interview scheduling

An in-process logistic regression model (TypeScript) retrains on each recruiter decision (approve/reject) to improve fit scores over time.

## Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Run type checker
npx tsc --noEmit

# Run tests
npm test

# Run a single test file
npx jest src/path/to/file.test.ts

# Seed Firestore with test data
npx ts-node scripts/setup-test-data.ts

# Pull Vercel env vars locally
vercel env pull .env.local
```

## Architecture

### Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router (TypeScript) |
| Auth | Firebase Auth (email/password for both roles) |
| Database | Firebase Firestore |
| File Storage | Firebase Storage (resume PDFs) |
| AI Parsing | Anthropic Claude (`claude-sonnet-4-6`) via `/api/resumes/parse` |
| ML Scoring | In-process logistic regression in `src/lib/ml-model.ts` |
| Calendar | Google Calendar API v3 via `/api/calendar/schedule` |
| Styling | Tailwind CSS + shadcn/ui |

### Data Flow

1. **Resume upload** → Firebase Storage → `/api/resumes/parse` → Claude extracts structured skills/experience → stored in Firestore `resumes/{id}`
2. **Fit scoring** → `/api/score` → Claude produces raw score + feature vector (keyword match, years experience, education, skills overlap) → logistic regression applies learned weights → score stored on `applications/{id}`
3. **Recruiter decision** → approve/reject written to `applications/{id}.decision` → `/api/ml/train` retrains model on all labelled applications for that job → updated weights persisted to Firestore `mlModels/{jobId}`
4. **Interview scheduling** → `/api/calendar/schedule` → Google Calendar API creates event → candidate and recruiter both receive invites

### Firestore Collections

```
users/{uid}           — role: "candidate" | "recruiter", profile
jobs/{jobId}          — positionId (unique), title, requirements, recruiterId, status
resumes/{resumeId}    — candidateId, storageUrl, parsedData, uploadedAt
applications/{appId}  — candidateId, jobId, resumeId, fitScore, featureVector, decision, scheduledAt
mlModels/{jobId}      — weights[], bias, trainedAt, sampleCount
```

### Key Source Paths

```
src/app/
  candidate/          — dashboard, resume upload, application list
  recruiter/          — dashboard, job management, application review
  api/
    resumes/parse/    — Claude resume parsing
    score/            — fit scoring (Claude + ML)
    ml/train/         — logistic regression retraining
    ml/predict/       — scoring with current model weights
    calendar/schedule/ — Google Calendar event creation
    jobs/             — CRUD for job postings
    applications/     — application state management

src/lib/
  firebase.ts         — client-side Firebase init
  firebase-admin.ts   — server-side Admin SDK (API routes only)
  anthropic.ts        — Anthropic client + resume parsing prompt
  ml-model.ts         — logistic regression: train(), predict(), sigmoid()
  google-calendar.ts  — OAuth2 client + createEvent()
```

### ML Model

`src/lib/ml-model.ts` implements logistic regression from scratch (no external ML library). Features per application:

- `keywordMatchScore` — fraction of job keywords found in resume (from Claude parse)
- `experienceMatchScore` — candidate years vs required years (clamped 0–1)
- `educationScore` — ordinal encoding of education level match
- `skillsOverlapScore` — Jaccard similarity of skill sets
- `claudeRawScore` — Claude's 0–1 confidence from the parsing step

`train(applications)` runs gradient descent over all labelled examples for a job. Weights are stored in Firestore and loaded on each `/api/score` call.

### Auth & Role Gating

Firebase Auth custom claims set `role: "candidate" | "recruiter"` at registration. Middleware (`src/middleware.ts`) reads the decoded ID token on every request and redirects to `/login` if unauthenticated, or `/unauthorized` if the role doesn't match the route prefix (`/candidate/*`, `/recruiter/*`).

### Environment Variables

```
NEXT_PUBLIC_FIREBASE_*        — Firebase client config (public)
FIREBASE_SERVICE_ACCOUNT_KEY  — JSON string, Admin SDK (server only)
ANTHROPIC_API_KEY             — Claude API key (server only)
GOOGLE_CLIENT_ID              — OAuth2 client for Calendar
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```
