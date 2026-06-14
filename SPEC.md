# SPEC.md — BestHire Product Specification

## 1. Purpose

BestHire is an AI-powered career portal that connects job candidates with recruiters. Candidates upload resumes; Claude AI parses them and scores fit against every open role. Recruiters manage postings, review ranked applicants, and approve or reject them. Each recruiter decision feeds a per-job logistic regression model that continuously improves scoring accuracy. Approved candidates receive Google Calendar interview invites automatically.

---

## 2. User Roles

| Role | Auth method | Entry point |
|---|---|---|
| Candidate | Email + password (Firebase Auth) | `/candidate/dashboard` |
| Recruiter | Email + password (Firebase Auth) | `/recruiter/dashboard` |

Role is stored as a Firebase Auth custom claim (`role: "candidate" | "recruiter"`) set at registration. Middleware enforces route-level access control.

---

## 3. Candidate Flows

### 3.1 Registration & Login
- Register with name, email, password; role auto-set to `candidate`.
- Login redirects to `/candidate/dashboard`.
- Failed login shows an inline error; no redirect.

### 3.2 Resume Upload
- Accepts PDF only, max 5 MB.
- File stored in Firebase Storage at `resumes/{uid}/{timestamp}.pdf`.
- On upload success, `/api/resumes/parse` is called server-side:
  - Claude reads the PDF text and extracts structured data (see §6.1).
  - Parsed result saved to Firestore `resumes/{resumeId}`.
- A candidate may upload a new resume at any time; the latest one is used for all scoring.
- Previous resumes are retained in Storage but marked inactive.

### 3.3 Application Feed
- After upload, the system auto-creates an `application` record for every open job the candidate has not already applied to.
- Candidate sees a card list of all open roles with their current fit score (0–100), updated whenever the ML model or resume changes.
- Cards are sorted by fit score descending.
- Score badge colour: ≥70 green, 40–69 amber, <40 red.

### 3.4 Application Status
- Each card shows status: `Pending Review`, `Approved`, `Rejected`, `Interview Scheduled`.
- If status is `Interview Scheduled`, the card shows the calendar event date/time.

---

## 4. Recruiter Flows

### 4.1 Registration & Login
- Register with name, company, email, password; role set to `recruiter`.
- Login redirects to `/recruiter/dashboard`.

### 4.2 Job Posting Management

#### Create Job
Fields:
| Field | Type | Notes |
|---|---|---|
| `positionId` | string | System-generated, unique (e.g. `BH-2026-0042`), immutable after creation |
| `title` | string | Required |
| `department` | string | Optional |
| `description` | string | Required, used by Claude for keyword extraction |
| `requiredSkills` | string[] | Tag input |
| `requiredExperienceYears` | number | Min years |
| `educationLevel` | enum | `any` \| `bachelor` \| `master` \| `phd` |
| `status` | enum | `open` \| `closed` \| `draft` |
| `createdAt` | timestamp | Auto |

- Position ID format: `BH-{YYYY}-{4-digit-seq}`, sequence is per-recruiter per-year, padded.
- Closing a job sets `status: "closed"` and stops new auto-applications.

#### Edit / Delete Job
- All fields editable except `positionId`.
- Deleting a job soft-deletes (sets `status: "deleted"`); applications are retained.

### 4.3 Application Review

- Dashboard shows a table of all applications across all recruiter's jobs.
- Filterable by job, status, score range, date range.
- Sortable by fit score (default desc), applicant name, application date.
- Each row: candidate name, position, fit score, resume preview link, action buttons.

#### Approve
- Sets `application.decision = "approved"` and `application.status = "approved"`.
- Triggers `/api/ml/train` for that job in the background.
- Triggers `/api/calendar/schedule` — creates a Google Calendar event (see §7).

#### Reject
- Sets `application.decision = "rejected"` and `application.status = "rejected"`.
- Triggers `/api/ml/train` for that job in the background.
- No calendar event.

#### Undo Decision (within 30 minutes)
- Recruiter may undo approve or reject within 30 minutes of the decision.
- Undo sets decision back to `null`, status back to `"pending"`, and cancels any calendar event.
- After 30 minutes the decision is locked.

---

## 5. Scoring Pipeline

### 5.1 Trigger
Scoring runs:
1. When a candidate uploads or re-uploads a resume (score all open jobs for that candidate).
2. When a new job is posted (score all candidates with active resumes against it).
3. When the ML model is retrained for a job (re-score pending applications for that job).

### 5.2 Feature Extraction (`/api/score`)
Endpoint receives `{ resumeId, jobId }`. Steps:

1. Load `resumes/{resumeId}.parsedData` and `jobs/{jobId}`.
2. Ask Claude to produce:
   - `keywordMatchScore` (0–1): fraction of job keywords present in resume.
   - `claudeRawScore` (0–1): Claude's holistic fit confidence.
3. Compute deterministically:
   - `experienceMatchScore`: `min(candidateYears / requiredYears, 1)`, or 1 if job requires 0.
   - `educationScore`: ordinal match (any=0.5, bachelor=0.6, master=0.8, phd=1.0) compared to candidate's level.
   - `skillsOverlapScore`: Jaccard similarity between `job.requiredSkills` and `resume.parsedData.skills`.
4. Build feature vector `[keywordMatchScore, experienceMatchScore, educationScore, skillsOverlapScore, claudeRawScore]`.
5. Call `mlModel.predict(featureVector, weights, bias)` → raw logit → sigmoid → probability (0–1).
6. `fitScore = Math.round(probability * 100)`.
7. Write `fitScore` and `featureVector` to `applications/{appId}`.

### 5.3 Initial Weights
Before any recruiter decisions exist for a job, weights default to equal (0.2 each) and bias to 0 — effectively using the average of the five features as a score.

---

## 6. AI Integration (Claude)

### 6.1 Resume Parsing Prompt
`POST /api/resumes/parse` — called with PDF text extracted server-side.

Claude returns structured JSON:
```json
{
  "name": "string",
  "email": "string",
  "phone": "string | null",
  "skills": ["string"],
  "experienceYears": "number",
  "educationLevel": "none | bachelor | master | phd",
  "workHistory": [
    { "title": "string", "company": "string", "years": "number" }
  ],
  "summary": "string (≤200 words)"
}
```

Prompt instructs Claude to infer `experienceYears` from work history if not stated, and to return `null` for any field it cannot determine.

### 6.2 Fit Scoring Prompt
`POST /api/score` (step 2 above) — Claude receives resume summary + job description and required skills.

Claude returns:
```json
{
  "keywordMatchScore": 0.0,
  "claudeRawScore": 0.0,
  "matchedKeywords": ["string"],
  "missingKeywords": ["string"],
  "reasoning": "string (≤100 words)"
}
```

`reasoning` is stored on the application and shown to the recruiter as a tooltip.

---

## 7. ML Model

### 7.1 Algorithm
Logistic regression implemented from scratch in `src/lib/ml-model.ts`. No external ML library.

```
predict(x, w, b) = sigmoid(dot(x, w) + b)
sigmoid(z) = 1 / (1 + exp(-z))
```

### 7.2 Training (`/api/ml/train`)
- Input: all `applications` for `jobId` where `decision` is not null.
- Label: `approved → 1`, `rejected → 0`.
- Gradient descent, learning rate 0.1, up to 1000 iterations or convergence (loss delta < 1e-6).
- Minimum 5 labelled examples before training runs (below threshold, default weights are used).
- Trained weights + bias written to `mlModels/{jobId}`.

### 7.3 Persistence
```
mlModels/{jobId}:
  weights: number[]   // one per feature, length 5
  bias: number
  trainedAt: timestamp
  sampleCount: number
  positiveRate: number  // fraction of approvals (for monitoring)
```

---

## 8. Google Calendar Integration

### 8.1 OAuth Flow
- Recruiter connects their Google account once from `/recruiter/settings`.
- OAuth tokens stored encrypted in Firestore `users/{uid}.googleTokens`.
- Token refresh handled transparently on each API call.

### 8.2 Interview Scheduling (`/api/calendar/schedule`)
- Default duration: 60 minutes.
- Default timing: next available weekday slot at 10:00, 14:00, or 16:00 in recruiter's timezone, at least 48 hours from now.
- Event title: `Interview — {candidateName} for {job.title} ({job.positionId})`.
- Description includes Claude's fit reasoning.
- Attendees: candidate email + recruiter email.
- On success: `application.status = "interview_scheduled"`, `application.scheduledAt` set to event start time, `application.calendarEventId` stored.

### 8.3 Cancellation (on Undo)
- `DELETE /api/calendar/schedule` calls Google Calendar API to cancel the event using stored `calendarEventId`.

---

## 9. API Surface

All routes under `/api/` are Next.js Route Handlers. Auth is verified server-side via Firebase Admin SDK on every request.

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create user + set custom claim |
| POST | `/api/resumes/upload` | candidate | Generate signed Storage URL |
| POST | `/api/resumes/parse` | candidate | Claude parse, save to Firestore |
| POST | `/api/score` | internal | Score one application |
| GET | `/api/jobs` | recruiter | List recruiter's jobs |
| POST | `/api/jobs` | recruiter | Create job posting |
| PATCH | `/api/jobs/[id]` | recruiter | Update job |
| DELETE | `/api/jobs/[id]` | recruiter | Soft-delete job |
| GET | `/api/applications` | recruiter | List applications (with filters) |
| GET | `/api/applications/[id]` | recruiter/candidate | Single application |
| PATCH | `/api/applications/[id]/decide` | recruiter | approve / reject / undo |
| POST | `/api/ml/train` | internal | Retrain model for a job |
| GET | `/api/ml/predict` | internal | Predict score for feature vector |
| POST | `/api/calendar/schedule` | internal | Create calendar event |
| DELETE | `/api/calendar/schedule` | internal | Cancel calendar event |
| GET | `/api/calendar/auth` | recruiter | Start Google OAuth flow |
| GET | `/api/calendar/callback` | recruiter | Handle OAuth callback |

---

## 10. Non-Functional Requirements

| Concern | Requirement |
|---|---|
| Resume parse latency | P95 < 8 s (Claude streaming not needed) |
| Scoring latency | P95 < 5 s per application |
| ML retrain latency | P95 < 2 s (background, non-blocking to recruiter) |
| File size limit | PDF ≤ 5 MB; enforced client + server |
| Concurrent uploads | Firestore transactions prevent duplicate `application` records |
| Position ID uniqueness | Enforced via Firestore transaction on job creation |
| Session expiry | Firebase ID token (1 h); client auto-refreshes via `onIdTokenChanged` |
| Undo window | Decisions locked after 30 minutes; checked server-side on every decide request |
