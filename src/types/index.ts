export type UserRole = "candidate" | "recruiter";

export interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;       // recruiters only (SPEC §4.1)
  createdAt: string;
  googleTokens?: GoogleTokens;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

export interface Job {
  id: string;
  positionId: string;             // BH-{YYYY}-{seq:04d}, immutable after creation
  title: string;
  department: string;
  description: string;
  requiredSkills: string[];
  requiredExperienceYears: number;
  educationLevel: JobEducationLevel;
  recruiterId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}

export type JobStatus = "open" | "closed" | "draft" | "deleted";

// Education level as required by a job posting (SPEC §4.2)
export type JobEducationLevel = "any" | "bachelor" | "master" | "phd";

// Education level as parsed from a candidate's resume (SPEC §6.1)
export type ResumeEducationLevel = "none" | "bachelor" | "master" | "phd";

export interface ParsedResume {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  experienceYears: number;
  educationLevel: ResumeEducationLevel;
  workHistory: WorkPosition[];    // SPEC §6.1 uses "workHistory"
  summary: string;
}

export interface WorkPosition {
  title: string;
  company: string;
  years: number;
}

export interface Resume {
  id: string;
  candidateId: string;
  storageUrl: string;
  parsedData: ParsedResume | null;
  active: boolean;
  uploadedAt: string;
}

export interface FeatureVector {
  keywordMatchScore: number;      // fraction of job keywords found in resume
  experienceMatchScore: number;   // candidate years vs required (clamped 0–1)
  educationScore: number;         // ordinal encoding of education level match
  skillsOverlapScore: number;     // Jaccard similarity of skill sets
  claudeRawScore: number;         // Claude's 0–1 holistic fit confidence
}

export type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "interview_scheduled";

export type Decision = "approved" | "rejected" | "undo";

export interface Application {
  id: string;
  candidateId: string;
  jobId: string;
  resumeId: string;
  fitScore: number;               // 0–100 final score (Math.round(probability * 100))
  featureVector: FeatureVector;
  claudeReasoning: string | null; // Claude's ≤100-word reasoning (SPEC §6.2), shown as tooltip
  status: ApplicationStatus;
  decision: "approved" | "rejected" | null;
  decidedAt: string | null;
  scheduledAt: string | null;     // set when interview_scheduled
  calendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MLModel {
  recruiterId: string;            // org-level: one model per recruiter, trained on all their decisions
  weights: number[];              // one per feature, length 5
  bias: number;
  trainedAt: string;
  sampleCount: number;
  positiveRate: number;           // fraction of approvals — for monitoring (SPEC §7.3)
}
