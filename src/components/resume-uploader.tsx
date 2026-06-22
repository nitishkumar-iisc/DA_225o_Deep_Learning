"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

interface ResumeUploaderProps {
  onFileSelected: (file: File) => void;
  uploading: boolean;
  progress: number;
  status: "idle" | "uploading" | "parsing" | "done" | "error";
}

const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

const ACCEPT_ATTR = ACCEPTED_MIME.join(",");

const FILE_TYPE_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/msword": "DOC",
  "text/plain": "TXT",
};

const FILE_ICONS: Record<string, string> = {
  "application/pdf": "📄",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/msword": "📝",
  "text/plain": "📃",
};

export function ResumeUploader({ onFileSelected, uploading, progress, status }: ResumeUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(f: File): string | null {
    if (!ACCEPTED_MIME.includes(f.type)) {
      return "Unsupported file type. Please upload a PDF, DOCX, DOC, or TXT file.";
    }
    if (f.size > 5 * 1024 * 1024) return "File must be 5 MB or smaller.";
    return null;
  }

  function handleFile(f: File) {
    const err = validate(f);
    if (err) { setError(err); return; }
    setError("");
    setFileName(f.name);
    setFileType(f.type);
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

  const icon = fileType ? (FILE_ICONS[fileType] ?? "📄") : "⬆️";
  const label = fileType ? FILE_TYPE_LABEL[fileType] : null;

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
          uploading
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer"
        } ${
          dragOver
            ? "border-violet-500 bg-violet-50 scale-[1.01]"
            : fileName
            ? "border-indigo-300 bg-indigo-50"
            : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
        }`}
      >
        <div className="text-4xl mb-3">{icon}</div>

        {fileName ? (
          <div>
            <p className="font-semibold text-gray-800 text-sm">{fileName}</p>
            {label && (
              <span className="inline-block mt-1 text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                {label}
              </span>
            )}
          </div>
        ) : (
          <div>
            <p className="text-gray-600 font-medium">Drag & drop your resume here</p>
            <p className="text-gray-400 text-xs mt-1">or click to browse</p>
          </div>
        )}

        <p className="text-gray-400 text-xs mt-3">
          Supported formats: <span className="font-medium text-gray-500">PDF · DOCX · DOC · TXT</span> &nbsp;·&nbsp; Max 5 MB
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={onFileChange}
          disabled={uploading}
        />
      </div>

      {error && (
        <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
          <span>⚠️</span> {error}
        </p>
      )}

      {(status === "uploading" || status === "parsing") && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-violet-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {status === "uploading" ? `Uploading… ${progress}%` : "Parsing resume with AI…"}
          </p>
        </div>
      )}
    </div>
  );
}
