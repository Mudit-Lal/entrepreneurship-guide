"use client";

import { useState } from "react";
import { UserContext } from "@/types";

interface OnboardingModalProps {
  onComplete: (context: UserContext) => void;
  onSkip: () => void;
}

type Step = "stage" | "details";

export function OnboardingModal({ onComplete, onSkip }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>("stage");
  const [context, setContext] = useState<Partial<UserContext>>({});

  const handleStageSelect = (stage: UserContext["stage"]) => {
    setContext({ ...context, stage });
    setStep("details");
  };

  const handleComplete = () => {
    if (!context.stage) return;

    onComplete({
      stage: context.stage,
      major: context.major,
      isF1Visa: context.isF1Visa,
      industry: context.industry,
      hasCoFounders: context.hasCoFounders,
      timeline: context.timeline,
      hasRunway: context.hasRunway,
      lastUpdated: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-maroon-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Welcome to ASU Venture Mentor Bot
            </h2>
            <p className="text-gray-600 mt-2">
              I&apos;m here to help you build something real.
            </p>
            <p className="text-gray-500 text-sm mt-3 max-w-sm">
              This tool is your always-available resource for the countless questions that come up on your entrepreneurship journey. While it&apos;s not a replacement for real mentors and advisors, it&apos;s here to provide quick guidance whenever you need it.
            </p>
          </div>

          {step === "stage" && (
            <>
              <p className="text-sm text-gray-500 mb-4 text-center">
                Tell me about where you are in your journey:
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleStageSelect("exploring")}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-maroon-500 hover:bg-maroon-50 transition-colors text-left"
                >
                  <div className="font-semibold text-gray-900">
                    Just exploring ideas
                  </div>
                  <div className="text-sm text-gray-500">
                    I don&apos;t have a specific venture yet
                  </div>
                </button>

                <button
                  onClick={() => handleStageSelect("validating")}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-maroon-500 hover:bg-maroon-50 transition-colors text-left"
                >
                  <div className="font-semibold text-gray-900">
                    Validating an idea
                  </div>
                  <div className="text-sm text-gray-500">
                    I have an idea and I&apos;m testing assumptions
                  </div>
                </button>

                <button
                  onClick={() => handleStageSelect("prototype")}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-maroon-500 hover:bg-maroon-50 transition-colors text-left"
                >
                  <div className="font-semibold text-gray-900">
                    Building a prototype
                  </div>
                  <div className="text-sm text-gray-500">
                    I have an MVP or working product
                  </div>
                </button>

                <button
                  onClick={() => handleStageSelect("revenue")}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-maroon-500 hover:bg-maroon-50 transition-colors text-left"
                >
                  <div className="font-semibold text-gray-900">
                    Generating revenue
                  </div>
                  <div className="text-sm text-gray-500">
                    I have paying customers
                  </div>
                </button>
              </div>

              <button
                onClick={onSkip}
                className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                Skip for now
              </button>
            </>
          )}

          {step === "details" && (
            <>
              <p className="text-sm text-gray-500 mb-4 text-center">
                A bit more context helps me help you better.
                <br />
                <span className="text-xs">(All fields optional)</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    What&apos;s your major or program?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Computer Science, MBA, TEM"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                    value={context.major || ""}
                    onChange={(e) =>
                      setContext({ ...context, major: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    What industry or problem area?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., EdTech, Healthcare, Sustainability"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                    value={context.industry || ""}
                    onChange={(e) =>
                      setContext({ ...context, industry: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Are you on an F-1 visa?
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setContext({ ...context, isF1Visa: true })}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                        context.isF1Visa === true
                          ? "border-maroon-500 bg-maroon-50 text-maroon-700"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setContext({ ...context, isF1Visa: false })}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                        context.isF1Visa === false
                          ? "border-maroon-500 bg-maroon-50 text-maroon-700"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Do you have co-founders?
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        setContext({ ...context, hasCoFounders: true })
                      }
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                        context.hasCoFounders === true
                          ? "border-maroon-500 bg-maroon-50 text-maroon-700"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() =>
                        setContext({ ...context, hasCoFounders: false })
                      }
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                        context.hasCoFounders === false
                          ? "border-maroon-500 bg-maroon-50 text-maroon-700"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      Solo
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    What&apos;s your timeline?
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                    value={context.timeline || ""}
                    onChange={(e) =>
                      setContext({ ...context, timeline: e.target.value })
                    }
                  >
                    <option value="">Select...</option>
                    <option value="graduating-soon">
                      Graduating within 6 months
                    </option>
                    <option value="1-2-years">1-2 years left at ASU</option>
                    <option value="plenty-of-time">
                      Plenty of time (3+ years)
                    </option>
                    <option value="already-graduated">Already graduated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Financial situation?
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setContext({ ...context, hasRunway: true })}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors text-sm ${
                        context.hasRunway === true
                          ? "border-maroon-500 bg-maroon-50 text-maroon-700"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      Have savings/runway
                    </button>
                    <button
                      onClick={() =>
                        setContext({ ...context, hasRunway: false })
                      }
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors text-sm ${
                        context.hasRunway === false
                          ? "border-maroon-500 bg-maroon-50 text-maroon-700"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      Need income now
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep("stage")}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  className="flex-1 py-3 px-4 bg-maroon-500 text-white rounded-xl hover:bg-maroon-600 transition-colors font-semibold"
                >
                  Get Started
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
