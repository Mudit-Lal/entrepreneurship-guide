import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import { Source } from "@/types";

// Initialize clients (lazy initialization)
let pineconeClient: Pinecone | null = null;
let openaiClient: OpenAI | null = null;

function getPinecone(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }
  return openaiClient;
}

interface PineconeMatch {
  id: string;
  score: number;
  metadata: {
    source_type: string;
    title: string;
    speaker?: string;
    source_url?: string;
    text: string;
    [key: string]: unknown;
  };
}

interface QueryResult {
  text: string;
  metadata: PineconeMatch["metadata"];
  score: number;
}

/**
 * Query the Pinecone index with a text query.
 * Embeds the query and performs similarity search.
 */
export async function queryIndex(
  query: string,
  options: { topK?: number } = {}
): Promise<QueryResult[]> {
  const { topK = 5 } = options;

  const openai = getOpenAI();
  const pinecone = getPinecone();

  // Create embedding for the query
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Query Pinecone
  const indexName = process.env.PINECONE_INDEX_NAME || "asu-mentor";
  const index = pinecone.Index(indexName);

  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  // Format results
  const results: QueryResult[] = (queryResponse.matches || []).map((match) => {
    const metadata = match.metadata as PineconeMatch["metadata"];
    return {
      text: metadata?.text || "",
      metadata: metadata,
      score: match.score || 0,
    };
  });

  return results;
}

/**
 * Format query results into a context string for the LLM.
 */
export function formatContextForPrompt(results: QueryResult[]): string {
  if (results.length === 0) {
    return "No relevant content found in the knowledge base.";
  }

  return results
    .map((result, index) => {
      const { metadata, text } = result;
      const sourceType = metadata.source_type || "unknown";
      const title = metadata.title || "Unknown";
      const speaker = metadata.speaker ? ` (${metadata.speaker})` : "";

      return `[Source ${index + 1}] [${sourceType}] ${title}${speaker}:\n${text}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Format query results into Source objects for the frontend.
 */
export function formatSources(results: QueryResult[]): Source[] {
  return results.map((result) => ({
    title: result.metadata.title || "Unknown",
    speaker: result.metadata.speaker,
    url: result.metadata.source_url,
    type: result.metadata.source_type as Source["type"],
    relevanceSnippet:
      result.text.substring(0, 200) + (result.text.length > 200 ? "..." : ""),
  }));
}

/**
 * Check if the Pinecone index is available and has content.
 */
export async function checkIndexHealth(): Promise<{
  available: boolean;
  vectorCount: number;
  error?: string;
}> {
  try {
    const pinecone = getPinecone();
    const indexName = process.env.PINECONE_INDEX_NAME || "asu-mentor";
    const index = pinecone.Index(indexName);

    const stats = await index.describeIndexStats();

    return {
      available: true,
      vectorCount: stats.totalRecordCount || 0,
    };
  } catch (error) {
    return {
      available: false,
      vectorCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
