#!/usr/bin/env python3
"""
Build vector index from transcripts and content files.
Uploads embeddings to Pinecone for querying from the web app.
"""

import os
import json
from pathlib import Path
from dotenv import load_dotenv
from tqdm import tqdm
from openai import OpenAI
from pinecone import Pinecone, ServerlessSpec

# Load environment variables
load_dotenv()


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """
    Split text into overlapping chunks.

    Args:
        text: Text to chunk
        chunk_size: Target chunk size in words (approximate tokens)
        overlap: Number of words to overlap between chunks

    Returns:
        List of text chunks
    """
    words = text.split()
    chunks = []

    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start = end - overlap

        if end >= len(words):
            break

    return chunks


def load_transcripts(transcript_dir: str) -> list[dict]:
    """Load transcript JSONs as documents."""
    documents = []
    transcript_path = Path(transcript_dir)

    if not transcript_path.exists():
        print(f"Warning: Transcript directory {transcript_dir} does not exist")
        return documents

    for json_file in transcript_path.glob("*.json"):
        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        documents.append({
            "id": json_file.stem,
            "text": data["transcript_text"],
            "metadata": {
                "source_type": "transcript",
                "title": data.get("title", "Unknown"),
                "speaker": data.get("speaker", "Unknown"),
                "source_url": data.get("source_url", ""),
                "video_id": data.get("video_id", ""),
                "duration_minutes": round(data.get("duration_seconds", 0) / 60, 1)
            }
        })

    return documents


def load_markdown_files(directory: str, source_type: str) -> list[dict]:
    """Load markdown files as documents."""
    documents = []
    dir_path = Path(directory)

    if not dir_path.exists():
        print(f"Warning: Directory {directory} does not exist")
        return documents

    for md_file in dir_path.glob("*.md"):
        with open(md_file, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract title from first heading
        lines = content.split("\n")
        title = md_file.stem.replace("_", " ").title()
        for line in lines:
            if line.startswith("# "):
                title = line[2:].strip()
                break

        documents.append({
            "id": f"{source_type}_{md_file.stem}",
            "text": content,
            "metadata": {
                "source_type": source_type,
                "title": title,
                "filename": md_file.name
            }
        })

    return documents


def create_embeddings(client: OpenAI, texts: list[str], batch_size: int = 100) -> list[list[float]]:
    """
    Create embeddings for a list of texts.

    Args:
        client: OpenAI client
        texts: List of texts to embed
        batch_size: Number of texts to embed at once

    Returns:
        List of embedding vectors
    """
    embeddings = []

    for i in tqdm(range(0, len(texts), batch_size), desc="Creating embeddings"):
        batch = texts[i:i + batch_size]

        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=batch
        )

        for item in response.data:
            embeddings.append(item.embedding)

    return embeddings


def build_and_upload_index(
    transcript_dir: str,
    resources_dir: str,
    frameworks_dir: str,
    index_name: str
):
    """
    Build index from all content and upload to Pinecone.

    Args:
        transcript_dir: Directory with transcript JSONs
        resources_dir: Directory with ASU resource markdown files
        frameworks_dir: Directory with framework markdown files
        index_name: Name of Pinecone index
    """
    # Initialize clients
    openai_client = OpenAI()
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

    # Load all documents
    print("Loading documents...")
    all_docs = []
    all_docs.extend(load_transcripts(transcript_dir))
    all_docs.extend(load_markdown_files(resources_dir, "asu_resource"))
    all_docs.extend(load_markdown_files(frameworks_dir, "framework"))

    print(f"Loaded {len(all_docs)} documents")

    if not all_docs:
        print("No documents to index!")
        return

    # Chunk documents
    print("Chunking documents...")
    chunks = []

    for doc in all_docs:
        doc_chunks = chunk_text(doc["text"])

        for i, chunk_text_content in enumerate(doc_chunks):
            chunks.append({
                "id": f"{doc['id']}_chunk_{i}",
                "text": chunk_text_content,
                "metadata": {
                    **doc["metadata"],
                    "chunk_index": i,
                    "total_chunks": len(doc_chunks)
                }
            })

    print(f"Created {len(chunks)} chunks")

    # Create embeddings
    print("Creating embeddings...")
    texts = [c["text"] for c in chunks]
    embeddings = create_embeddings(openai_client, texts)

    # Create or connect to Pinecone index
    print(f"Connecting to Pinecone index: {index_name}")

    # Check if index exists
    existing_indexes = [idx.name for idx in pc.list_indexes()]

    if index_name not in existing_indexes:
        print(f"Creating new index: {index_name}")
        pc.create_index(
            name=index_name,
            dimension=1536,  # text-embedding-3-small dimension
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )

    index = pc.Index(index_name)

    # Upsert vectors
    print("Uploading to Pinecone...")
    batch_size = 100

    for i in tqdm(range(0, len(chunks), batch_size), desc="Uploading"):
        batch_chunks = chunks[i:i + batch_size]
        batch_embeddings = embeddings[i:i + batch_size]

        vectors = [
            {
                "id": chunk["id"],
                "values": embedding,
                "metadata": {
                    **chunk["metadata"],
                    "text": chunk["text"][:1000]  # Store truncated text for retrieval
                }
            }
            for chunk, embedding in zip(batch_chunks, batch_embeddings)
        ]

        index.upsert(vectors=vectors)

    # Get index stats
    stats = index.describe_index_stats()
    print(f"\nIndex stats: {stats}")
    print(f"\nSuccessfully indexed {len(chunks)} chunks to Pinecone!")


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Build and upload vector index to Pinecone"
    )
    parser.add_argument(
        "--transcripts",
        default="./content/transcripts",
        help="Directory with transcript JSONs"
    )
    parser.add_argument(
        "--resources",
        default="./content/asu_resources",
        help="Directory with ASU resource markdown files"
    )
    parser.add_argument(
        "--frameworks",
        default="./content/frameworks",
        help="Directory with framework markdown files"
    )
    parser.add_argument(
        "--index-name",
        default=os.getenv("PINECONE_INDEX_NAME", "asu-mentor"),
        help="Pinecone index name"
    )

    args = parser.parse_args()

    build_and_upload_index(
        transcript_dir=args.transcripts,
        resources_dir=args.resources,
        frameworks_dir=args.frameworks,
        index_name=args.index_name
    )


if __name__ == "__main__":
    main()
