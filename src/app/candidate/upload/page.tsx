"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ResumeUploader } from "@/components/resume-uploader";
import { ParsedResumePreview } from "@/components/parsed-resume-preview";
import { ParsedResume } from "@/types";

type Status = "idle" | "uploading" | "parsing" | "done" | "error";

export default function CandidateUpload() {
  const { user } = useAuth();
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
    setProgress(10);
    setError("");

    try {
      const token = (await user?.getIdToken()) || "";

      // Send file directly to our API — server uploads to Firebase Storage (avoids CORS)
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await readError(res, "Upload failed"));
      const { resumeId, storagePath } = await res.json();

      setStatus("parsing");
      setProgress(50);

      const parseRes = await fetch("/api/resumes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeId, storageUrl: storagePath }),
      });
      if (!parseRes.ok) throw new Error(await readError(parseRes, "Parsing failed"));
      const { parsedData: data } = await parseRes.json();

      setProgress(100);
      setParsedData(data);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Upload Resume</h1>
      <p className="text-gray-500 mt-1 mb-6">Upload your resume as a PDF (max 5 MB)</p>

      <ResumeUploader onFileSelected={onFileSelected} uploading={status === "uploading" || status === "parsing"} progress={progress} status={status} />

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      {file && status !== "done" && status !== "uploading" && status !== "parsing" && (
        <button onClick={upload} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Upload & Parse
        </button>
      )}

      {parsedData && (
        <div className="mt-6">
          <ParsedResumePreview data={parsedData} />
        </div>
      )}
    </div>
  );
}
