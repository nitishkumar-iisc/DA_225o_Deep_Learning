/**
 * Seed script — populates Firebase (Auth + Firestore) with deterministic test data.
 *
 * Run against the local emulator:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   npx ts-node scripts/setup-test-data.ts
 *
 * Or against real Firebase (needs FIREBASE_SERVICE_ACCOUNT_KEY env var set).
 *
 * Accounts created (password for all: Test1234!)
 *   Recruiters : recruiter1@besthire.dev, recruiter2@besthire.dev
 *   Candidates : alice@candidate.dev, bob@candidate.dev, carol@candidate.dev
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type {
  Job,
  Resume,
  Application,
  ParsedResume,
  FeatureVector,
  MLModel,
} from "../src/types";

// ── Init ─────────────────────────────────────────────────────────────────────

if (!getApps().length) {
  const isEmulator = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (isEmulator) {
    initializeApp({ projectId: "besthire-local" });
  } else {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!key) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
    initializeApp({ credential: cert(JSON.parse(key)) });
  }
}

const adminAuth = getAuth();
const db = getFirestore();

const PASSWORD = "Test1234!";
const NOW = new Date().toISOString();

// ── Helper ────────────────────────────────────────────────────────────────────

async function upsertUser(
  email: string,
  displayName: string,
  role: "recruiter" | "candidate",
  company?: string
): Promise<string> {
  let uid: string;
  try {
    const existing = await adminAuth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`  [exists] ${email} → ${uid}`);
  } catch {
    const created = await adminAuth.createUser({ email, password: PASSWORD, displayName });
    uid = created.uid;
    console.log(`  [created] ${email} → ${uid}`);
  }

  await adminAuth.setCustomUserClaims(uid, { role });

  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        uid,
        email,
        name: displayName,
        role,
        ...(company ? { company } : {}),
        createdAt: NOW,
      },
      { merge: true }
    );

  return uid;
}

// ── Users ─────────────────────────────────────────────────────────────────────

console.log("\n--- Creating users ---");

const [r1Uid, r2Uid, aliceUid, bobUid, carolUid] = await Promise.all([
  upsertUser("recruiter1@besthire.dev", "Recruiter One", "recruiter", "TechCorp"),
  upsertUser("recruiter2@besthire.dev", "Recruiter Two", "recruiter", "DataVentures"),
  upsertUser("alice@candidate.dev", "Alice Chen", "candidate"),
  upsertUser("bob@candidate.dev", "Bob Patel", "candidate"),
  upsertUser("carol@candidate.dev", "Carol Smith", "candidate"),
]);

// ── Jobs ──────────────────────────────────────────────────────────────────────

console.log("\n--- Creating jobs ---");

const JOBS: Omit<Job, "id">[] = [
  {
    positionId: "BH-2026-0001",
    title: "Senior Software Engineer",
    department: "Engineering",
    description:
      "Build scalable backend services using TypeScript and Node.js. Experience with cloud infrastructure (AWS/GCP) and CI/CD pipelines required.",
    requiredSkills: ["TypeScript", "Node.js", "React", "AWS", "PostgreSQL"],
    requiredExperienceYears: 5,
    educationLevel: "bachelor",
    recruiterId: r1Uid,
    status: "open",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    positionId: "BH-2026-0002",
    title: "Machine Learning Engineer",
    department: "AI Research",
    description:
      "Design and deploy ML pipelines. Solid understanding of deep learning frameworks, model evaluation, and MLOps practices.",
    requiredSkills: ["Python", "PyTorch", "TensorFlow", "MLflow", "Docker"],
    requiredExperienceYears: 3,
    educationLevel: "master",
    recruiterId: r1Uid,
    status: "open",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    positionId: "BH-2026-0003",
    title: "Data Engineer",
    department: "Data Platform",
    description:
      "Build and maintain data pipelines, warehouses, and streaming infrastructure. Apache Spark and Kafka experience valued.",
    requiredSkills: ["Python", "Apache Spark", "Kafka", "dbt", "BigQuery"],
    requiredExperienceYears: 4,
    educationLevel: "bachelor",
    recruiterId: r2Uid,
    status: "open",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    positionId: "BH-2026-0004",
    title: "Frontend Engineer",
    department: "Product",
    description:
      "Craft pixel-perfect, accessible UIs using React and Tailwind. You care about performance and test coverage.",
    requiredSkills: ["React", "TypeScript", "Tailwind CSS", "Vitest", "Figma"],
    requiredExperienceYears: 2,
    educationLevel: "any",
    recruiterId: r2Uid,
    status: "open",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    positionId: "BH-2026-0005",
    title: "DevOps / Platform Engineer",
    department: "Infrastructure",
    description:
      "Own our Kubernetes clusters and deployment automation. Terraform, Helm, and Prometheus expertise expected.",
    requiredSkills: ["Kubernetes", "Terraform", "Helm", "Prometheus", "GitHub Actions"],
    requiredExperienceYears: 4,
    educationLevel: "bachelor",
    recruiterId: r2Uid,
    status: "open",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const jobRefs = await Promise.all(
  JOBS.map(async (job) => {
    const ref = db.collection("jobs").doc();
    const full: Job = { id: ref.id, ...job };
    await ref.set(full);
    console.log(`  [job] ${job.positionId} — ${job.title} → ${ref.id}`);
    return { id: ref.id, ...job } as Job;
  })
);

// ── Resumes ───────────────────────────────────────────────────────────────────

console.log("\n--- Creating resumes ---");

const PARSED_RESUMES: Record<string, ParsedResume> = {
  alice: {
    name: "Alice Chen",
    email: "alice@candidate.dev",
    phone: "+1-555-0101",
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Docker", "GraphQL"],
    experienceYears: 6,
    educationLevel: "bachelor",
    workHistory: [
      { title: "Senior Frontend Engineer", company: "Stripe", years: 3 },
      { title: "Software Engineer", company: "Shopify", years: 3 },
    ],
    summary:
      "Senior full-stack engineer with 6 years building high-traffic web applications. Deep expertise in TypeScript, React, and Node.js. Led migration from REST to GraphQL at Stripe. Passionate about developer tooling and performance.",
  },
  bob: {
    name: "Bob Patel",
    email: "bob@candidate.dev",
    phone: "+1-555-0202",
    skills: ["Python", "PyTorch", "TensorFlow", "MLflow", "scikit-learn", "Docker", "FastAPI"],
    experienceYears: 4,
    educationLevel: "master",
    workHistory: [
      { title: "ML Engineer", company: "Hugging Face", years: 2 },
      { title: "Data Scientist", company: "Accenture", years: 2 },
    ],
    summary:
      "ML engineer specialising in NLP and computer vision. Published two papers on efficient transformer architectures. Built MLflow-based model registry at Hugging Face. Master's in Machine Learning from Carnegie Mellon.",
  },
  carol: {
    name: "Carol Smith",
    email: "carol@candidate.dev",
    phone: "+1-555-0303",
    skills: ["React", "TypeScript", "CSS", "Tailwind CSS", "Figma", "Vitest", "Storybook"],
    experienceYears: 2,
    educationLevel: "bachelor",
    workHistory: [
      { title: "Frontend Developer", company: "Vercel", years: 2 },
    ],
    summary:
      "Frontend developer with 2 years building design-system components and accessible UIs. Strong eye for detail; contributed 15+ PRs to the Tailwind CSS open-source project. Bachelor's in Computer Science.",
  },
};

const resumeIds: Record<string, string> = {};

for (const [name, data] of Object.entries(PARSED_RESUMES)) {
  const uid = name === "alice" ? aliceUid : name === "bob" ? bobUid : carolUid;
  const ref = db.collection("resumes").doc();
  const resume: Resume = {
    id: ref.id,
    candidateId: uid,
    storageUrl: `resumes/${uid}/seed-resume.pdf`,
    parsedData: data,
    active: true,
    uploadedAt: NOW,
  };
  await ref.set(resume);
  resumeIds[name] = ref.id;
  console.log(`  [resume] ${name} → ${ref.id}`);
}

// ── Feature vector helpers ────────────────────────────────────────────────────

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a.map((s) => s.toLowerCase()));
  const setB = new Set(b.map((s) => s.toLowerCase()));
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 1 : intersection / union;
}

const EDU_ORDINAL: Record<string, number> = {
  none: 0, any: 0.5, bachelor: 0.6, master: 0.8, phd: 1.0,
};

function buildFeatureVector(
  resume: ParsedResume,
  job: Job,
  claudeRawScore: number,
  keywordMatchScore: number
): FeatureVector {
  const experienceMatchScore =
    job.requiredExperienceYears === 0
      ? 1
      : Math.min(resume.experienceYears / job.requiredExperienceYears, 1);

  const candidateEdu = EDU_ORDINAL[resume.educationLevel] ?? 0;
  const requiredEdu = EDU_ORDINAL[job.educationLevel] ?? 0;
  const educationScore = candidateEdu >= requiredEdu ? 1 : candidateEdu / requiredEdu;

  const skillsOverlapScore = jaccard(resume.skills, job.requiredSkills);

  return {
    keywordMatchScore,
    experienceMatchScore,
    educationScore,
    skillsOverlapScore,
    claudeRawScore,
  };
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function computeFitScore(fv: FeatureVector, weights = [0.2, 0.2, 0.2, 0.2, 0.2], bias = 0): number {
  const x = [
    fv.keywordMatchScore,
    fv.experienceMatchScore,
    fv.educationScore,
    fv.skillsOverlapScore,
    fv.claudeRawScore,
  ];
  const logit = x.reduce((s, xi, i) => s + xi * weights[i], bias);
  return Math.round(sigmoid(logit) * 100);
}

// ── Applications — all (candidate × job) pairs ───────────────────────────────

console.log("\n--- Creating applications ---");

const candidates = [
  { name: "alice", uid: aliceUid, resumeId: resumeIds.alice, parsed: PARSED_RESUMES.alice },
  { name: "bob", uid: bobUid, resumeId: resumeIds.bob, parsed: PARSED_RESUMES.bob },
  { name: "carol", uid: carolUid, resumeId: resumeIds.carol, parsed: PARSED_RESUMES.carol },
];

// Pre-canned Claude scores (deterministic seed — no real API call)
const CLAUDE_SCORES: Record<string, { raw: number; keyword: number; reasoning: string }> = {
  "alice-BH-2026-0001": { raw: 0.88, keyword: 0.90, reasoning: "Strong TypeScript, React, Node.js match. AWS experience is a direct hit. Exceeds experience requirement." },
  "alice-BH-2026-0002": { raw: 0.40, keyword: 0.30, reasoning: "Limited ML/Python background. Strong software skills but missing core ML frameworks." },
  "alice-BH-2026-0003": { raw: 0.35, keyword: 0.20, reasoning: "Data engineering is a stretch — no Spark or Kafka experience listed." },
  "alice-BH-2026-0004": { raw: 0.85, keyword: 0.80, reasoning: "Excellent React and TypeScript skills. UI/UX sensibility evident in work history." },
  "alice-BH-2026-0005": { raw: 0.30, keyword: 0.15, reasoning: "No Kubernetes or infrastructure experience visible in resume." },
  "bob-BH-2026-0001": { raw: 0.50, keyword: 0.40, reasoning: "Python and Docker match but missing TypeScript and React core to the role." },
  "bob-BH-2026-0002": { raw: 0.92, keyword: 0.95, reasoning: "Perfect ML engineer profile. PyTorch, TensorFlow, MLflow all present. Master's degree matches requirement." },
  "bob-BH-2026-0003": { raw: 0.55, keyword: 0.45, reasoning: "Python experience transfers; missing Spark and Kafka but strong data intuition." },
  "bob-BH-2026-0004": { raw: 0.20, keyword: 0.10, reasoning: "No frontend experience. React and TypeScript absent from skill set." },
  "bob-BH-2026-0005": { raw: 0.45, keyword: 0.30, reasoning: "Docker knowledge helps but no Kubernetes or Terraform. Mostly ML-focused background." },
  "carol-BH-2026-0001": { raw: 0.40, keyword: 0.45, reasoning: "React and TypeScript are there but junior-level; Node.js and backend missing." },
  "carol-BH-2026-0002": { raw: 0.10, keyword: 0.05, reasoning: "No ML background at all. Skills and experience are entirely frontend-focused." },
  "carol-BH-2026-0003": { raw: 0.15, keyword: 0.08, reasoning: "No data engineering exposure. Frontend-only profile." },
  "carol-BH-2026-0004": { raw: 0.90, keyword: 0.85, reasoning: "Ideal frontend candidate. React, TypeScript, Tailwind, Figma, Vitest all match. 2 years is exactly the requirement." },
  "carol-BH-2026-0005": { raw: 0.12, keyword: 0.05, reasoning: "No infrastructure or DevOps experience." },
};

const appIds: string[] = [];

for (const candidate of candidates) {
  for (const job of jobRefs) {
    const key = `${candidate.name}-${job.positionId}`;
    const scores = CLAUDE_SCORES[key] ?? { raw: 0.5, keyword: 0.5, reasoning: "Evaluating fit." };
    const fv = buildFeatureVector(candidate.parsed, job, scores.raw, scores.keyword);
    const fitScore = computeFitScore(fv);

    const ref = db.collection("applications").doc();
    const app: Application = {
      id: ref.id,
      candidateId: candidate.uid,
      jobId: job.id,
      resumeId: candidate.resumeId,
      fitScore,
      featureVector: fv,
      claudeReasoning: scores.reasoning,
      status: "pending",
      decision: null,
      decidedAt: null,
      scheduledAt: null,
      calendarEventId: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    await ref.set(app);
    appIds.push(ref.id);
    console.log(`  [app] ${candidate.name} × ${job.positionId} → score=${fitScore} → ${ref.id}`);
  }
}

// ── 2 recruiter decisions (1 approve, 1 reject) for partial ML training ───────

console.log("\n--- Creating decisions ---");

// Find alice × BH-2026-0001 (she should score highest for job 1)
const aliceJob1Snap = await db
  .collection("applications")
  .where("candidateId", "==", aliceUid)
  .where("jobId", "==", jobRefs[0].id)
  .get();

if (!aliceJob1Snap.empty) {
  const appRef = aliceJob1Snap.docs[0].ref;
  await appRef.update({
    status: "approved",
    decision: "approved",
    decidedAt: NOW,
    updatedAt: NOW,
  });
  console.log(`  [approve] alice × ${jobRefs[0].positionId}`);
}

// Find carol × BH-2026-0001 (low score — rejected)
const carolJob1Snap = await db
  .collection("applications")
  .where("candidateId", "==", carolUid)
  .where("jobId", "==", jobRefs[0].id)
  .get();

if (!carolJob1Snap.empty) {
  const appRef = carolJob1Snap.docs[0].ref;
  await appRef.update({
    status: "rejected",
    decision: "rejected",
    decidedAt: NOW,
    updatedAt: NOW,
  });
  console.log(`  [reject] carol × ${jobRefs[0].positionId}`);
}

// ── Seed a partial ML model for job 1 (trained on 2 examples) ─────────────────

console.log("\n--- Creating ML model ---");

const mlModel: MLModel = {
  jobId: jobRefs[0].id,
  weights: [0.25, 0.22, 0.18, 0.20, 0.30],  // slightly adjusted from defaults after 2 decisions
  bias: 0.05,
  trainedAt: NOW,
  sampleCount: 2,
  positiveRate: 0.5,
};

await db.collection("mlModels").doc(jobRefs[0].id).set(mlModel);
console.log(`  [mlModel] job=${jobRefs[0].positionId} weights=${JSON.stringify(mlModel.weights)}`);

// ── Done ──────────────────────────────────────────────────────────────────────

console.log("\n=== Seed complete ===");
console.log(`  Recruiters : recruiter1@besthire.dev, recruiter2@besthire.dev (password: ${PASSWORD})`);
console.log(`  Candidates : alice@candidate.dev, bob@candidate.dev, carol@candidate.dev (password: ${PASSWORD})`);
console.log(`  Jobs       : ${jobRefs.length}`);
console.log(`  Resumes    : ${Object.keys(resumeIds).length}`);
console.log(`  Applications: ${appIds.length} (${candidates.length} candidates × ${jobRefs.length} jobs)`);
console.log(`  Decisions  : 1 approve (alice × BH-2026-0001), 1 reject (carol × BH-2026-0001)`);
