"use client";

import { Source } from "@/types";

interface SourceCardProps {
  source: Source;
}

export function SourceCard({ source }: SourceCardProps) {
  const typeColors = {
    transcript: "bg-blue-50 text-blue-700 border-blue-200",
    asu_resource: "bg-green-50 text-green-700 border-green-200",
    framework: "bg-purple-50 text-purple-700 border-purple-200",
  };

  const typeLabels = {
    transcript: "Lecture/Podcast",
    asu_resource: "ASU Resource",
    framework: "Framework",
  };

  const colorClass = typeColors[source.type] || "bg-gray-50 text-gray-700 border-gray-200";
  const label = typeLabels[source.type] || source.type;

  return (
    <div className="bg-gray-50 rounded-lg p-2.5 text-sm">
      <div className="flex items-start gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}
        >
          {label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {source.title}
            {source.speaker && (
              <span className="font-normal text-gray-500">
                {" "}
                — {source.speaker}
              </span>
            )}
          </div>
          <p className="text-gray-600 text-xs mt-0.5 line-clamp-2">
            {source.relevanceSnippet}
          </p>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-maroon-600 hover:text-maroon-700 text-xs mt-1 inline-flex items-center gap-1"
            >
              View source
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
