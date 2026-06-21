# AGENTS.md — BestHire Agent Guidelines

## Framework notes

Next.js 15 App Router with Turbopack. Key rules:
- All routes under `src/app/` use App Router (`page.tsx`, `layout.tsx`, `route.ts`)
- Server Components are the default; add `"use client"` only for hooks/browser APIs
- API routes export named functions: `GET`, `POST`, `PATCH`, `DELETE`
- `after()` from `next/server` for fire-and-forget background work post-response
- `params` in dynamic routes is a `Promise` — always `await params` before destructuring

## Critical rules (never violate)

### No pdf-parse
pdf-parse is broken in Next.js/Turbopack (CJS/ESM, DOMMatrix browser globals). All PDF parsing goes through Claude's native document API. See `src/lib/anthropic.ts → parseResumeFromPDF()`.

### Firebase Storage
Always use `getAdminStorage()` from `src/lib/firebase-admin.ts` — it always passes the bucket name explicitly. Storage writes are best-effort; core flows must not depend on Storage succeeding.

### ML model is org-level
`mlModels/{recruiterId}` — one model per recruiter across all jobs. Never write to `mlModels/{jobId}`. Train endpoint accepts `{ recruiterId }`. Score route loads via `job.recruiterId`.

### No auto fan-out
Candidates must explicitly click Apply. Never auto-create applications when jobs are posted or resumes uploaded.

### Fit score visibility
Never show numeric fit scores to candidates. Only show "★ Recommended" badge when `fitScore >= 60`.

### Dashboard z-index
Content divs with `-mt-10` (floating up from hero banner) must have `relative z-10` or cards render behind the banner.

## Code style

- No comments unless the WHY is non-obvious
- TypeScript strict — no `any` unless the SDK type is genuinely broken (Claude content blocks)
- Use `verifyAuth(request, role)` from `src/lib/auth-helpers.ts` for all API route auth
- Firestore `in` queries support max 30 values — chunk larger arrays

## Testing

```bash
npm test
npx jest src/path/to/file.test.ts
npx tsc --noEmit   # always run before committing
```

## Branch strategy

- `main` — production
- `develop` — integration branch; all work merges here
- Feature branches: `feature/<scope>`
