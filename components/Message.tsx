"use client";

import ReactMarkdown from "react-markdown";
import { Message as MessageType } from "@/types";
import { SourceCard } from "./SourceCard";

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] ${
          isUser
            ? "bg-maroon-500 text-white rounded-2xl rounded-br-md px-4 py-3"
            : "bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // Style links
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-maroon-600 hover:text-maroon-700 underline"
                  >
                    {children}
                  </a>
                ),
                // Style code blocks
                code: ({ className, children }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={className}>{children}</code>
                  );
                },
                // Style lists
                ul: ({ children }) => (
                  <ul className="list-disc pl-5 space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-5 space-y-1">{children}</ol>
                ),
                // Style headings
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
                ),
                // Style paragraphs
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                // Style strong/bold
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Show sources if available */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2 font-medium">Sources:</p>
            <div className="space-y-2">
              {message.sources.map((source, index) => (
                <SourceCard key={index} source={source} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
