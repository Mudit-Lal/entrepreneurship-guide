#!/usr/bin/env python3
"""
Transcribe MP3 files using OpenAI Whisper API.
Reads metadata from content_metadata.json and outputs transcript JSONs.
"""

import os
import json
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv
from tqdm import tqdm

# Load environment variables
load_dotenv()


def transcribe_audio(client: OpenAI, audio_path: str, metadata: dict) -> dict:
    """
    Transcribe a single audio file using Whisper API.

    Args:
        client: OpenAI client
        audio_path: Path to MP3 file
        metadata: Dict containing video metadata

    Returns:
        Dict with transcript and metadata
    """
    with open(audio_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["segment"]
        )

    return {
        "source_file": str(audio_path),
        "video_id": metadata.get("video_id", ""),
        "title": metadata.get("title", "Unknown"),
        "speaker": metadata.get("channel", "Unknown"),
        "source_url": metadata.get("url", ""),
        "topic_tags": metadata.get("tags", [])[:10],  # Limit tags
        "categories": metadata.get("categories", []),
        "transcript_text": transcript.text,
        "segments": [
            {
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
                "text": seg.get("text", "")
            }
            for seg in (transcript.segments or [])
        ],
        "duration_seconds": transcript.duration
    }


def process_batch(
    mp3_dir: str,
    metadata_file: str,
    output_dir: str,
    limit: int = None,
    skip_existing: bool = True
):
    """
    Process a batch of audio files.

    Args:
        mp3_dir: Directory containing MP3 files
        metadata_file: Path to content_metadata.json
        output_dir: Where to save transcript JSONs
        limit: Maximum number of files to process (None = all)
        skip_existing: Skip files that already have transcripts
    """
    client = OpenAI()  # Uses OPENAI_API_KEY env variable

    # Load metadata
    with open(metadata_file, "r", encoding="utf-8") as f:
        metadata_data = json.load(f)

    videos = metadata_data.get("videos", [])
    print(f"Found {len(videos)} videos in metadata")

    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Build lookup by filename
    metadata_by_filename = {v["filename"]: v for v in videos}

    # Get MP3 files to process
    mp3_path = Path(mp3_dir)
    mp3_files = list(mp3_path.glob("*.mp3"))

    # Filter to files with metadata
    mp3_files = [f for f in mp3_files if f.name in metadata_by_filename]
    print(f"Found {len(mp3_files)} MP3 files with metadata")

    # Apply limit
    if limit:
        mp3_files = mp3_files[:limit]
        print(f"Processing first {limit} files")

    # Skip existing if requested
    if skip_existing:
        existing = set(f.stem for f in output_path.glob("*.json"))
        mp3_files = [f for f in mp3_files if f.stem not in existing]
        print(f"Skipping {len(existing)} already transcribed files")

    print(f"Will transcribe {len(mp3_files)} files")

    if not mp3_files:
        print("No files to process!")
        return

    # Estimate cost
    total_duration = sum(
        metadata_by_filename.get(f.name, {}).get("duration_seconds", 0)
        for f in mp3_files
    )
    estimated_cost = (total_duration / 60) * 0.006
    print(f"Estimated duration: {total_duration/60:.1f} minutes")
    print(f"Estimated cost: ${estimated_cost:.2f}")

    # Confirm
    response = input("\nProceed with transcription? (y/n): ")
    if response.lower() != "y":
        print("Aborted.")
        return

    # Process files
    successful = 0
    failed = []

    for mp3_file in tqdm(mp3_files, desc="Transcribing"):
        metadata = metadata_by_filename[mp3_file.name]

        try:
            result = transcribe_audio(client, str(mp3_file), metadata)

            output_file = output_path / f"{mp3_file.stem}.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)

            successful += 1

        except Exception as e:
            print(f"\nError transcribing {mp3_file.name}: {e}")
            failed.append(mp3_file.name)

    print(f"\n\nCompleted!")
    print(f"Successful: {successful}/{len(mp3_files)}")
    if failed:
        print(f"Failed: {len(failed)}")
        print("Failed files:", failed)


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Transcribe MP3 files using OpenAI Whisper"
    )
    parser.add_argument(
        "--mp3-dir",
        default="./mp3",
        help="Directory containing MP3 files (default: ./mp3)"
    )
    parser.add_argument(
        "--metadata",
        default="./content_metadata.json",
        help="Metadata JSON file (default: ./content_metadata.json)"
    )
    parser.add_argument(
        "--output",
        default="./content/transcripts",
        help="Output directory for transcripts (default: ./content/transcripts)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of files to process"
    )
    parser.add_argument(
        "--no-skip",
        action="store_true",
        help="Don't skip already transcribed files"
    )

    args = parser.parse_args()

    process_batch(
        mp3_dir=args.mp3_dir,
        metadata_file=args.metadata,
        output_dir=args.output,
        limit=args.limit,
        skip_existing=not args.no_skip
    )


if __name__ == "__main__":
    main()
