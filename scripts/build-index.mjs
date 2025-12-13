#!/usr/bin/env node
/**
 * Build and upload vector index to Pinecone using Node.js
 * This is an alternative to the Python build-index.py script
 */

import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");

// Load environment variables from .env.local
const envPath = path.join(ROOT_DIR, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "asu-mentor";

/**
 * Chunk text into overlapping segments
 */
function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end >= words.length) break;
    start = end - overlap;
  }

  return chunks;
}

/**
 * Load transcript JSON files
 */
function loadTranscripts() {
  const transcriptDir = path.join(ROOT_DIR, "content", "transcripts");
  const docs = [];

  if (!fs.existsSync(transcriptDir)) {
    console.log("No transcripts directory found");
    return docs;
  }

  const files = fs.readdirSync(transcriptDir).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} transcript files`);

  for (const file of files) {
    try {
      const content = JSON.parse(
        fs.readFileSync(path.join(transcriptDir, file), "utf-8")
      );
      docs.push({
        id: path.basename(file, ".json"),
        text: content.transcript_text,
        metadata: {
          source_type: "transcript",
          title: content.title || "Unknown",
          speaker: content.speaker || "Unknown",
          source_url: content.source_url || "",
        },
      });
    } catch (e) {
      console.error(`Error loading ${file}:`, e.message);
    }
  }

  return docs;
}

/**
 * Load markdown files from a directory
 */
function loadMarkdownFiles(directory, sourceType) {
  const docs = [];
  const dirPath = path.join(ROOT_DIR, directory);

  if (!fs.existsSync(dirPath)) {
    console.log(`Directory ${directory} not found`);
    return docs;
  }

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} markdown files in ${directory}`);

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dirPath, file), "utf-8");

      // Extract title from first heading
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : file.replace(".md", "").replace(/_/g, " ");

      docs.push({
        id: `${sourceType}_${path.basename(file, ".md")}`,
        text: content,
        metadata: {
          source_type: sourceType,
          title: title,
          filename: file,
        },
      });
    } catch (e) {
      console.error(`Error loading ${file}:`, e.message);
    }
  }

  return docs;
}

/**
 * Create embeddings for texts
 */
async function createEmbeddings(texts) {
  const batchSize = 100;
  const embeddings = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`Creating embeddings for batch ${i / batchSize + 1}/${Math.ceil(texts.length / batchSize)}`);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });

    embeddings.push(...response.data.map((d) => d.embedding));
  }

  return embeddings;
}

/**
 * Main function to build and upload index
 */
async function main() {
  console.log("Loading documents...");

  // Load all documents
  const allDocs = [
    ...loadTranscripts(),
    ...loadMarkdownFiles("content/asu_resources", "asu_resource"),
    ...loadMarkdownFiles("content/frameworks", "framework"),
  ];

  console.log(`\nLoaded ${allDocs.length} documents total`);

  if (allDocs.length === 0) {
    console.error("No documents to index!");
    process.exit(1);
  }

  // Chunk documents
  console.log("\nChunking documents...");
  const chunks = [];

  for (const doc of allDocs) {
    const docChunks = chunkText(doc.text);
    for (let i = 0; i < docChunks.length; i++) {
      chunks.push({
        id: `${doc.id}_chunk_${i}`,
        text: docChunks[i],
        metadata: {
          ...doc.metadata,
          chunk_index: i,
          total_chunks: docChunks.length,
        },
      });
    }
  }

  console.log(`Created ${chunks.length} chunks`);

  // Create embeddings
  console.log("\nCreating embeddings...");
  const texts = chunks.map((c) => c.text);
  const embeddings = await createEmbeddings(texts);

  // Connect to Pinecone
  console.log(`\nConnecting to Pinecone index: ${INDEX_NAME}`);

  // Check if index exists
  const indexes = await pinecone.listIndexes();
  const indexExists = indexes.indexes?.some((idx) => idx.name === INDEX_NAME);

  if (!indexExists) {
    console.log(`Creating new index: ${INDEX_NAME}`);
    await pinecone.createIndex({
      name: INDEX_NAME,
      dimension: 1536,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });

    // Wait for index to be ready
    console.log("Waiting for index to be ready...");
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }

  const index = pinecone.Index(INDEX_NAME);

  // Upsert vectors in batches
  console.log("\nUploading to Pinecone...");
  const batchSize = 100;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    const batchEmbeddings = embeddings.slice(i, i + batchSize);

    const vectors = batchChunks.map((chunk, j) => ({
      id: chunk.id,
      values: batchEmbeddings[j],
      metadata: {
        ...chunk.metadata,
        text: chunk.text.substring(0, 1000), // Truncate for storage
      },
    }));

    await index.upsert(vectors);
    console.log(`Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
  }

  // Get stats
  const stats = await index.describeIndexStats();
  console.log(`\n✅ Successfully indexed ${chunks.length} chunks!`);
  console.log(`Index stats:`, stats);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
