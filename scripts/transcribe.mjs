#!/usr/bin/env node
/**
 * Transcribe MP3 files using OpenAI Whisper API
 * Node.js alternative to the Python transcribe.py script
 */

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

/**
 * Transcribe a single audio file
 */
async function transcribeFile(filePath, videoId) {
  console.log(`  Transcribing: ${path.basename(filePath)}`);

  const fileStream = fs.createReadStream(filePath);

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: fileStream,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  return {
    source_file: filePath,
    video_id: videoId,
    title: `YouTube Video ${videoId}`,
    speaker: "Unknown",
    source_url: `https://www.youtube.com/watch?v=${videoId}`,
    topic_tags: ["entrepreneurship"],
    categories: ["Education"],
    transcript_text: response.text,
    segments: (response.segments || []).map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })),
    duration_seconds: response.duration || 0,
  };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : 5;

  const mp3Dir = path.join(ROOT_DIR, "mp3");
  const outputDir = path.join(ROOT_DIR, "content", "transcripts");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get MP3 files
  if (!fs.existsSync(mp3Dir)) {
    console.error(`MP3 directory not found: ${mp3Dir}`);
    process.exit(1);
  }

  const mp3Files = fs.readdirSync(mp3Dir)
    .filter((f) => f.endsWith(".mp3"))
    .map((f) => path.join(mp3Dir, f));

  console.log(`Found ${mp3Files.length} MP3 files`);

  // Check which files already have transcripts
  const existingTranscripts = new Set(
    fs.readdirSync(outputDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
  );

  // Filter to files without transcripts AND under 25MB (Whisper limit)
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  const filesToProcess = mp3Files
    .filter((f) => {
      const name = path.basename(f, ".mp3");
      if (existingTranscripts.has(name)) return false;
      const size = fs.statSync(f).size;
      if (size > MAX_SIZE) {
        console.log(`Skipping ${name} (${(size / 1024 / 1024).toFixed(1)}MB > 25MB limit)`);
        return false;
      }
      return true;
    })
    .slice(0, limit);

  console.log(`Already transcribed: ${existingTranscripts.size}`);
  console.log(`Will transcribe: ${filesToProcess.length} files\n`);

  if (filesToProcess.length === 0) {
    console.log("No new files to transcribe!");
    return;
  }

  // Estimate cost
  let totalSize = 0;
  for (const f of filesToProcess) {
    totalSize += fs.statSync(f).size;
  }
  const estimatedMinutes = totalSize / (1024 * 1024) * 2; // Rough estimate
  const estimatedCost = estimatedMinutes * 0.006;
  console.log(`Estimated cost: ~$${estimatedCost.toFixed(2)}\n`);

  // Process files
  let successful = 0;
  const failed = [];

  for (let i = 0; i < filesToProcess.length; i++) {
    const filePath = filesToProcess[i];
    const videoId = path.basename(filePath, ".mp3");

    console.log(`[${i + 1}/${filesToProcess.length}] Processing ${videoId}...`);

    try {
      const result = await transcribeFile(filePath, videoId);

      // Save transcript
      const outputPath = path.join(outputDir, `${videoId}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

      console.log(`  ✓ Saved (${Math.round(result.duration_seconds / 60)} min)\n`);
      successful++;
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}\n`);
      failed.push(videoId);
    }
  }

  console.log(`\n========================================`);
  console.log(`Completed: ${successful}/${filesToProcess.length}`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.join(", ")}`);
  }
  console.log(`Total transcripts: ${existingTranscripts.size + successful}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
