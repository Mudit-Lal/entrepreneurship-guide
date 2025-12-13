export interface UserContext {
  stage: "exploring" | "validating" | "prototype" | "revenue";
  major?: string;
  isF1Visa?: boolean;
  industry?: string;
  hasCoFounders?: boolean;
  timeline?: string;
  hasRunway?: boolean;
  lastUpdated: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Source[];
}

export interface Source {
  title: string;
  speaker?: string;
  url?: string;
  type: "transcript" | "asu_resource" | "framework";
  relevanceSnippet: string;
}

export interface CalculationInputs {
  [key: string]: number | string;
}

export interface CalculationResult {
  [key: string]: number | string;
  assessment: string;
}

export interface ChatRequest {
  messages: Message[];
  userContext: UserContext | null;
}

export interface ChatResponse {
  message: string;
  sources: Source[];
}
