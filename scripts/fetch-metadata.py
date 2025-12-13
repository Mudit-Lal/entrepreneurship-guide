#!/usr/bin/env python3
"""
Fetch metadata for YouTube videos from MP3 filenames.
MP3 files are named with YouTube video IDs (e.g., _9rlYITqtuE.mp3).
Uses yt-dlp to extract video metadata without downloading.
"""

import os
import json
import subprocess
from pathlib import Path
from tqdm import tqdm


def get_video_metadata(video_id: str) -> dict:
    """
    Fetch metadata for a YouTube video using yt-dlp.

    Args:
        video_id: YouTube video ID

    Returns:
        Dict with video metadata
    """
    url = f"https://www.youtube.com/watch?v={video_id}"

    try:
        # Use yt-dlp to get video info as JSON
        result = subprocess.run(
            [
                "yt-dlp",
                "--dump-json",
                "--no-download",
                "--no-playlist",
                url
            ],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            print(f"Warning: Failed to fetch metadata for {video_id}: {result.stderr}")
            return None

        data = json.loads(result.stdout)

        return {
            "video_id": video_id,
            "title": data.get("title", "Unknown Title"),
            "channel": data.get("channel", data.get("uploader", "Unknown")),
            "url": url,
            "description": data.get("description", ""),
            "duration_seconds": data.get("duration", 0),
            "upload_date": data.get("upload_date", ""),
            "tags": data.get("tags", []),
            "categories": data.get("categories", [])
        }

    except subprocess.TimeoutExpired:
        print(f"Warning: Timeout fetching metadata for {video_id}")
        return None
    except json.JSONDecodeError:
        print(f"Warning: Invalid JSON response for {video_id}")
        return None
    except Exception as e:
        print(f"Warning: Error fetching metadata for {video_id}: {e}")
        return None


def process_mp3_directory(mp3_dir: str, output_file: str):
    """
    Process all MP3 files in directory and fetch their metadata.

    Args:
        mp3_dir: Directory containing MP3 files named with YouTube video IDs
        output_file: Path to output JSON file
    """
    mp3_path = Path(mp3_dir)

    if not mp3_path.exists():
        print(f"Error: Directory {mp3_dir} does not exist")
        return

    # Get all MP3 files
    mp3_files = list(mp3_path.glob("*.mp3"))
    print(f"Found {len(mp3_files)} MP3 files")

    metadata_list = []
    failed = []

    for mp3_file in tqdm(mp3_files, desc="Fetching metadata"):
        # Extract video ID from filename
        video_id = mp3_file.stem  # filename without extension

        metadata = get_video_metadata(video_id)

        if metadata:
            metadata["filename"] = mp3_file.name
            metadata_list.append(metadata)
        else:
            failed.append(video_id)

    # Save results
    output_data = {
        "total_files": len(mp3_files),
        "successful": len(metadata_list),
        "failed": len(failed),
        "failed_ids": failed,
        "videos": metadata_list
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"\nResults saved to {output_file}")
    print(f"Successfully fetched: {len(metadata_list)}/{len(mp3_files)}")

    if failed:
        print(f"Failed to fetch: {len(failed)} videos")
        print("Failed IDs:", failed[:10], "..." if len(failed) > 10 else "")


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Fetch YouTube metadata for MP3 files"
    )
    parser.add_argument(
        "--mp3-dir",
        default="./mp3",
        help="Directory containing MP3 files (default: ./mp3)"
    )
    parser.add_argument(
        "--output",
        default="./content_metadata.json",
        help="Output JSON file (default: ./content_metadata.json)"
    )

    args = parser.parse_args()

    process_mp3_directory(args.mp3_dir, args.output)


if __name__ == "__main__":
    main()
