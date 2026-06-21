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

  async function upload() {
    if (!file) return;
    setStatus("uploading");
    setProgress(0);
    setError("");

    try {
      const token = (await user?.getIdToken()) || "";

      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Upload request failed");
      const { uploadUrl, resumeId, storagePath } = await res.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", "application/pdf");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      setStatus("parsing");
      setProgress(100);
      const parseRes = await fetch("/api/resumes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeId, storageUrl: storagePath }),
      });
      if (!parseRes.ok) throw new Error((await parseRes.json()).error || "Parsing failed");
      const { parsedData: data } = await parseRes.json();

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
