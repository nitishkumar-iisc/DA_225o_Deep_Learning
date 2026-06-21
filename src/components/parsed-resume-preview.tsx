import { ParsedResume } from "@/types";

interface ParsedResumePreviewProps {
  data: ParsedResume;
}

export function ParsedResumePreview({ data }: ParsedResumePreviewProps) {
  return (
    <div className="border rounded-lg p-6 bg-gray-50">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Parsed Resume</h2>

      {data.name && (
        <p className="text-sm text-gray-700"><span className="font-medium">Name:</span> {data.name}</p>
      )}

      <p className="text-sm text-gray-700 mt-1">
        <span className="font-medium">Experience:</span> {data.experienceYears} years
      </p>

      <p className="text-sm text-gray-700 mt-1">
        <span className="font-medium">Education:</span> {data.educationLevel}
      </p>

      {data.skills.length > 0 && (
        <div className="mt-3">
          <span className="text-sm font-medium text-gray-700">Skills:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.skills.map((skill) => (
              <span key={skill} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.summary && (
        <p className="text-sm text-gray-600 mt-3 italic">{data.summary}</p>
      )}
    </div>
  );
}
