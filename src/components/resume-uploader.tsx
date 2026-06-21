"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

interface ResumeUploaderProps {
  onFileSelected: (file: File) => void;
  uploading: boolean;
  progress: number;
  status: "idle" | "uploading" | "parsing" | "done" | "error";
}

export function ResumeUploader({ onFileSelected, uploading, progress, status }: ResumeUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(f: File): string | null {
    if (f.type !== "application/pdf") return "Only PDF files are accepted.";
    if (f.size > 5 * 1024 * 1024) return "File must be 5 MB or smaller.";
    return null;
  }

  function handleFile(f: File) {
    const err = validate(f);
    if (err) { setError(err); return; }
    setError("");
    setFileName(f.name);
    onFileSelected(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <p className="text-gray-600">{fileName || "Drag & drop your PDF here, or click to browse"}</p>
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
      </div>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      {(status === "uploading" || status === "parsing") && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {status === "uploading" ? `Uploading... ${progress}%` : "Parsing resume with AI..."}
          </p>
        </div>
      )}
    </div>
  );
}
