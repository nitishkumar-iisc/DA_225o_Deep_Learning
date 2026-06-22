"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ResumeUploader } from "@/components/resume-uploader";
import { ParsedResumePreview } from "@/components/parsed-resume-preview";
import { ParsedResume } from "@/types";

type Status = "idle" | "uploading" | "parsing" | "done" | "error";

export default function CandidateUpload() {
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [parsedData, setParsedData] = useState<ParsedResume | null>(null);

  function onFileSelected(f: File) {
    setFile(f);
    setParsedData(null);
    setStatus("idle");
    setError("");
  }

  async function readError(res: Response, fallback: string): Promise<string> {
    try {
      const body = await res.json();
      return body.error || fallback;
    } catch {
      return fallback;
    }
  }

  async function upload() {
    if (!file) return;
    setStatus("uploading");
    setProgress(20);
    setError("");

    try {
      const token = (await user?.getIdToken()) || "";

      const formData = new FormData();
      formData.append("file", file);

      // Single call: server parses the PDF in-memory and returns parsedData directly
      setStatus("parsing");
      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await readError(res, "Upload & parse failed"));
      const { parsedData: data } = await res.json();

      setProgress(100);
      setParsedData(data);
      setStatus("done");

      // Redirect to dashboard after a brief moment so the user sees success
      setTimeout(() => router.push("/candidate/dashboard"), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Upload Resume</h1>
          <p className="text-gray-500 mt-1">
            Supports <span className="font-medium text-gray-700">PDF, DOCX, DOC, and TXT</span> — Claude will extract and analyse your skills automatically.
          </p>
        </div>

        <ResumeUploader
          onFileSelected={onFileSelected}
          uploading={status === "uploading" || status === "parsing"}
          progress={progress}
          status={status}
        />

        {error && (
          <p className="text-red-600 text-sm mt-3 flex items-center gap-1">
            <span>⚠️</span> {error}
          </p>
        )}

        {file && status !== "done" && status !== "uploading" && status !== "parsing" && (
          <button
            onClick={upload}
            className="mt-5 w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-indigo-200 hover:shadow-lg transition-all duration-200 hover:scale-[1.01]"
          >
            Upload & Parse with AI
          </button>
        )}

        {status === "done" && (
          <div className="mt-4 flex items-center gap-2 text-emerald-600 font-medium text-sm">
            <span>✓</span> Resume parsed successfully — redirecting to dashboard…
          </div>
        )}

        {parsedData && (
          <div className="mt-6">
            <ParsedResumePreview data={parsedData} />
          </div>
        )}
      </div>
    </div>
  );
}
