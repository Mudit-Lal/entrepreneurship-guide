"use client";

import { useState, useEffect } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { OnboardingModal } from "@/components/OnboardingModal";
import { UserContext } from "@/types";

const USER_CONTEXT_KEY = "asu-mentor-user-context";

export default function Home() {
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load user context from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(USER_CONTEXT_KEY);
    if (stored) {
      try {
        setUserContext(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored user context:", e);
        localStorage.removeItem(USER_CONTEXT_KEY);
        setShowOnboarding(true);
      }
    } else {
      setShowOnboarding(true);
    }
    setIsLoaded(true);
  }, []);

  const handleOnboardingComplete = (context: UserContext) => {
    localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(context));
    setUserContext(context);
    setShowOnboarding(false);
  };

  const handleSkipOnboarding = () => {
    setShowOnboarding(false);
  };

  const handleUpdateContext = () => {
    setShowOnboarding(true);
  };

  // Show nothing while loading to prevent hydration mismatch
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-maroon-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      {showOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onSkip={handleSkipOnboarding}
        />
      )}
      <ChatInterface
        userContext={userContext}
        onUpdateContext={handleUpdateContext}
      />
    </main>
  );
}
