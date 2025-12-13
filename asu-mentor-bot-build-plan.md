# ASU Entrepreneurship Mentor Bot - Build Specification

## Project Overview

**Project Name:** ASU Entrepreneurship Mentor Bot (working title - suggest alternatives during build)

**Purpose:** An AI-powered mentorship tool that combines ASU-specific entrepreneurship content with realistic, honest business guidance. The bot serves as a first-line advisor for student entrepreneurs—surfacing relevant ASU resources, asking hard questions, and providing grounded feedback that existing mentorship programs may be too polite to give.

**Core Philosophy:**
- Warm but honest—a tough mentor who genuinely cares
- Less talk, more resourcefulness—surface specific resources, don't lecture
- Realistic over optimistic—show the mirror, but also show possible paths forward
- Bootstrapping is valid—don't default to "raise VC money" as the only path
- Action-oriented—every session should end with something concrete the student can do

**Target Users:** Student entrepreneurs at Arizona State University who are serious about building real businesses.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Web App)                        │
│                    React/Next.js + Tailwind CSS                  │
│         localStorage for user context persistence                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend API Layer                         │
│                     Python FastAPI or Node.js                    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Chat Handler │  │ Code Executor│  │ Context Manager       │  │
│  │              │  │ (Calculations)│  │ (User questionnaire)  │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LlamaIndex RAG Layer                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Vector Store Index                      │   │
│  │          (Transcripts + ASU Resources + Frameworks)       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        External Services                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Claude API   │  │ Web Search   │  │ OpenAI Whisper API   │   │
│  │ (Generation) │  │ (Real-time)  │  │ (Transcription)      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Content Transcription Pipeline

### Objective
Convert existing MP3 files of ASU entrepreneurship content into searchable transcripts.

### Input
- MP3 files already downloaded (1-5 hours of content for v1)
- Excel sheet with source metadata (video titles, speakers, URLs, topics)

### Technical Implementation

```python
# transcription_pipeline.py

import os
from openai import OpenAI
from pathlib import Path
import json

client = OpenAI()  # Uses OPENAI_API_KEY env variable

def transcribe_audio(audio_path: str, metadata: dict) -> dict:
    """
    Transcribe a single audio file using Whisper API.
    
    Args:
        audio_path: Path to MP3 file
        metadata: Dict containing title, speaker, source_url, topic_tags
    
    Returns:
        Dict with transcript and metadata
    """
    with open(audio_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",  # Includes timestamps
            timestamp_granularities=["segment"]
        )
    
    return {
        "source_file": audio_path,
        "title": metadata.get("title", "Unknown"),
        "speaker": metadata.get("speaker", "Unknown"),
        "source_url": metadata.get("source_url", ""),
        "topic_tags": metadata.get("topic_tags", []),
        "transcript_text": transcript.text,
        "segments": transcript.segments,  # With timestamps for potential future use
        "duration_seconds": transcript.duration
    }

def process_all_audio(audio_dir: str, metadata_file: str, output_dir: str):
    """
    Process all audio files in directory.
    
    Args:
        audio_dir: Directory containing MP3 files
        metadata_file: Path to Excel/CSV with metadata
        output_dir: Where to save transcript JSONs
    """
    import pandas as pd
    
    metadata_df = pd.read_excel(metadata_file)  # or pd.read_csv()
    os.makedirs(output_dir, exist_ok=True)
    
    for idx, row in metadata_df.iterrows():
        audio_path = os.path.join(audio_dir, row['filename'])
        if not os.path.exists(audio_path):
            print(f"Warning: {audio_path} not found, skipping")
            continue
        
        print(f"Transcribing: {row['title']}")
        
        result = transcribe_audio(
            audio_path,
            metadata={
                "title": row['title'],
                "speaker": row.get('speaker', 'Unknown'),
                "source_url": row.get('url', ''),
                "topic_tags": row.get('tags', '').split(',') if row.get('tags') else []
            }
        )
        
        output_path = os.path.join(output_dir, f"{Path(audio_path).stem}.json")
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"Saved: {output_path}")

if __name__ == "__main__":
    process_all_audio(
        audio_dir="./audio_files",
        metadata_file="./content_metadata.xlsx",
        output_dir="./transcripts"
    )
```

### Expected Output
- Directory of JSON files, each containing:
  - Full transcript text
  - Timestamped segments
  - Source metadata (title, speaker, URL, tags)

### Cost Estimate
- Whisper API: $0.006 per minute
- 5 hours of content = 300 minutes = ~$1.80

---

## Phase 2: Indexing with LlamaIndex

### Objective
Create a searchable vector index from transcripts and additional ASU resources.

### Content to Index
1. **Transcripts** (from Phase 1)
2. **ASU Resource Pages** (manual addition for v1):
   - Venture Devils program info
   - E+I Institute programs and deadlines
   - Startup funding competitions (dates, amounts, requirements)
   - Skysong Innovations process
   - TEM/MOT program details
3. **Evaluation Frameworks** (embedded as retrievable documents):
   - TAM/SAM/SOM calculation templates
   - Unit economics framework
   - Customer validation checklist
   - Competitive analysis template

### Technical Implementation

```python
# indexing_pipeline.py

from llama_index.core import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    Document,
    StorageContext,
    load_index_from_storage
)
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
import json
import os

def load_transcripts(transcript_dir: str) -> list[Document]:
    """Load transcript JSONs as LlamaIndex Documents."""
    documents = []
    
    for filename in os.listdir(transcript_dir):
        if not filename.endswith('.json'):
            continue
        
        with open(os.path.join(transcript_dir, filename)) as f:
            data = json.load(f)
        
        # Create document with rich metadata
        doc = Document(
            text=data['transcript_text'],
            metadata={
                "source_type": "transcript",
                "title": data['title'],
                "speaker": data['speaker'],
                "source_url": data['source_url'],
                "topic_tags": ", ".join(data['topic_tags']),
                "duration_minutes": round(data['duration_seconds'] / 60, 1)
            }
        )
        documents.append(doc)
    
    return documents

def load_resource_documents(resources_dir: str) -> list[Document]:
    """Load manually curated ASU resource documents."""
    # These can be markdown files with structured info about ASU programs
    reader = SimpleDirectoryReader(resources_dir)
    docs = reader.load_data()
    
    # Add metadata indicating these are resource docs
    for doc in docs:
        doc.metadata["source_type"] = "asu_resource"
    
    return docs

def load_framework_documents(frameworks_dir: str) -> list[Document]:
    """Load evaluation framework documents."""
    reader = SimpleDirectoryReader(frameworks_dir)
    docs = reader.load_data()
    
    for doc in docs:
        doc.metadata["source_type"] = "framework"
    
    return docs

def build_index(
    transcript_dir: str,
    resources_dir: str,
    frameworks_dir: str,
    persist_dir: str
):
    """Build and persist the vector index."""
    
    # Load all documents
    all_docs = []
    all_docs.extend(load_transcripts(transcript_dir))
    all_docs.extend(load_resource_documents(resources_dir))
    all_docs.extend(load_framework_documents(frameworks_dir))
    
    print(f"Loaded {len(all_docs)} documents")
    
    # Configure chunking
    splitter = SentenceSplitter(
        chunk_size=512,
        chunk_overlap=50
    )
    
    # Build index
    index = VectorStoreIndex.from_documents(
        all_docs,
        transformations=[splitter],
        embed_model=OpenAIEmbedding(model="text-embedding-3-small"),
        show_progress=True
    )
    
    # Persist to disk
    index.storage_context.persist(persist_dir=persist_dir)
    print(f"Index persisted to {persist_dir}")
    
    return index

def load_index(persist_dir: str) -> VectorStoreIndex:
    """Load existing index from disk."""
    storage_context = StorageContext.from_defaults(persist_dir=persist_dir)
    return load_index_from_storage(storage_context)

if __name__ == "__main__":
    build_index(
        transcript_dir="./transcripts",
        resources_dir="./asu_resources",
        frameworks_dir="./frameworks",
        persist_dir="./index_storage"
    )
```

### Directory Structure for Content

```
content/
├── transcripts/           # Output from Phase 1
│   ├── lecture_01.json
│   └── podcast_01.json
├── asu_resources/         # Manually created markdown files
│   ├── venture_devils.md
│   ├── ei_institute.md
│   ├── funding_competitions.md
│   ├── skysong_innovations.md
│   └── tem_program.md
├── frameworks/            # Evaluation frameworks as markdown
│   ├── tam_sam_som.md
│   ├── unit_economics.md
│   ├── customer_validation.md
│   ├── competitive_analysis.md
│   └── founder_market_fit.md
└── index_storage/         # Persisted vector index
```

### Cost Estimate
- OpenAI Embeddings (text-embedding-3-small): $0.00002 per 1K tokens
- ~50,000 tokens of content = ~$1.00

---

## Phase 3: Web Application

### Objective
Build a clean, simple chat interface where students can interact with the mentor bot.

### Tech Stack
- **Frontend:** Next.js 14 with App Router + Tailwind CSS
- **State Management:** React hooks + localStorage for persistence
- **API:** Next.js API routes (serverless functions)

### User Flow

```
1. First Visit:
   ┌─────────────────────────────────────────┐
   │  Welcome! I'm here to help you build    │
   │  something real.                         │
   │                                          │
   │  Before we start, tell me about yourself │
   │  (optional, but helps me help you):      │
   │                                          │
   │  [ ] I'm just exploring ideas            │
   │  [ ] I have an idea I'm validating       │
   │  [ ] I have a prototype/MVP              │
   │  [ ] I have paying customers             │
   │                                          │
   │  [Skip for now]  [Continue →]            │
   └─────────────────────────────────────────┘

2. Extended Questionnaire (if Continue):
   - What's your major/program?
   - Are you on F-1 visa? (affects advice on incorporation, employment)
   - What industry/problem area?
   - Do you have co-founders?
   - What's your timeline? (graduating soon, have years, etc.)
   - Do you have savings/runway, or need to generate income immediately?

3. Main Chat Interface:
   ┌─────────────────────────────────────────┐
   │  [ASU Mentor Bot]                        │
   │                                          │
   │  ┌─────────────────────────────────────┐ │
   │  │ Chat history scrollable area        │ │
   │  │                                     │ │
   │  │ Bot: What are you working on?       │ │
   │  │                                     │ │
   │  │ User: I want to build an app for... │ │
   │  │                                     │ │
   │  │ Bot: Interesting. Before I respond, │ │
   │  │ a few questions...                  │ │
   │  └─────────────────────────────────────┘ │
   │                                          │
   │  ┌─────────────────────────────────────┐ │
   │  │ Type your message...          [Send]│ │
   │  └─────────────────────────────────────┘ │
   │                                          │
   │  [Clear Chat]  [Update My Info]          │
   └─────────────────────────────────────────┘
```

### Frontend Implementation

```typescript
// app/page.tsx (simplified)

'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/ChatInterface';
import { OnboardingModal } from '@/components/OnboardingModal';
import { UserContext } from '@/types';

export default function Home() {
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  useEffect(() => {
    // Check localStorage for existing user context
    const stored = localStorage.getItem('userContext');
    if (stored) {
      setUserContext(JSON.parse(stored));
    } else {
      setShowOnboarding(true);
    }
  }, []);
  
  const handleOnboardingComplete = (context: UserContext) => {
    localStorage.setItem('userContext', JSON.stringify(context));
    setUserContext(context);
    setShowOnboarding(false);
  };
  
  const handleSkipOnboarding = () => {
    setShowOnboarding(false);
  };
  
  return (
    <main className="min-h-screen bg-gray-50">
      {showOnboarding && (
        <OnboardingModal 
          onComplete={handleOnboardingComplete}
          onSkip={handleSkipOnboarding}
        />
      )}
      <ChatInterface userContext={userContext} />
    </main>
  );
}
```

```typescript
// types/index.ts

export interface UserContext {
  stage: 'exploring' | 'validating' | 'prototype' | 'revenue';
  major?: string;
  isF1Visa?: boolean;
  industry?: string;
  hasCoFounders?: boolean;
  timeline?: string;
  hasRunway?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
}

export interface Source {
  title: string;
  speaker?: string;
  url?: string;
  relevance_snippet: string;
}
```

### API Route Implementation

```typescript
// app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { queryIndex, formatSourcesForResponse } from '@/lib/llamaindex';
import { executeCalculation } from '@/lib/calculator';
import { buildSystemPrompt } from '@/lib/prompts';
import { UserContext, Message } from '@/types';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const { messages, userContext }: { messages: Message[], userContext: UserContext | null } = await request.json();
  
  // Get the latest user message
  const latestMessage = messages[messages.length - 1].content;
  
  // Query the index for relevant context
  const retrievedContext = await queryIndex(latestMessage, {
    topK: 5,
    filters: {} // Can add filters based on user stage/industry later
  });
  
  // Build system prompt with user context and retrieved documents
  const systemPrompt = buildSystemPrompt(userContext, retrievedContext);
  
  // Call Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    })),
    tools: [
      {
        name: 'calculate',
        description: 'Execute financial calculations like unit economics, TAM/SAM/SOM, break-even analysis, etc.',
        input_schema: {
          type: 'object',
          properties: {
            calculation_type: {
              type: 'string',
              enum: ['unit_economics', 'tam_sam_som', 'break_even', 'runway', 'custom']
            },
            inputs: {
              type: 'object',
              description: 'Key-value pairs of inputs for the calculation'
            },
            formula: {
              type: 'string',
              description: 'For custom calculations, the formula to execute'
            }
          },
          required: ['calculation_type', 'inputs']
        }
      },
      {
        name: 'web_search',
        description: 'Search the web for current market data, competitor information, or recent news relevant to the student\'s industry.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string' }
          },
          required: ['query']
        }
      }
    ]
  });
  
  // Handle tool calls if any
  // ... (tool handling logic)
  
  // Format response with sources
  const formattedResponse = formatSourcesForResponse(
    response.content[0].text,
    retrievedContext
  );
  
  return NextResponse.json({
    message: formattedResponse.text,
    sources: formattedResponse.sources
  });
}
```

---

## Phase 4: Mentorship Logic & Evaluation Frameworks

### System Prompt (Core Personality)

```markdown
# ASU Entrepreneurship Mentor Bot - System Prompt

You are an entrepreneurship mentor for students at Arizona State University. Your role is to help students build real, sustainable businesses—not chase vanity metrics or burn VC money.

## Your Personality
- **Warm but honest**: You care about the student's success, which means telling them hard truths when needed. You're not mean—you're direct because you respect them.
- **Less talk, more resourcefulness**: Don't lecture. Surface specific resources, ask targeted questions, provide concrete next steps. Every response should be actionable.
- **Realistic over optimistic**: The startup failure rate is high. Your job isn't to be a cheerleader—it's to help students see clearly so they can make good decisions.
- **Bootstrapping-friendly**: Not every good business needs VC funding. Many great businesses are built with customers, not investors. Don't default to "you should raise money."

## How You Operate

### When a student shares an idea:
1. **Acknowledge genuinely** - Find something specific that's interesting about their thinking
2. **Ask clarifying questions** - But not too many at once. 2-3 max per response.
3. **Surface relevant context** - Reference specific ASU resources, past lectures, or frameworks when relevant
4. **Be honest about concerns** - If you see red flags (saturated market, unclear differentiation, unit economics that don't work), say so—but also ask "what am I missing?" because sometimes they have insights you don't
5. **End with a concrete next step** - What should they do THIS WEEK?

### When evaluating viability:
Use these frameworks, but don't overwhelm students with all of them at once:
- **Market Size (TAM/SAM/SOM)**: Is this a big enough opportunity?
- **Unit Economics**: Can they actually make money on each customer?
- **Competitive Landscape**: Who else is doing this? What's their edge?
- **Customer Validation**: Have they talked to real potential customers?
- **Founder-Market Fit**: Why are THEY the right people to solve this?
- **Timeline & Resources**: Given their constraints (visa status, graduation timing, capital), is this achievable?

### When a student is struggling:
- Don't just validate their frustration—help them see the path forward
- Sometimes the answer is "this isn't working, here's how to know when to pivot"
- Sometimes the answer is "you're in the hard middle, this is normal, here's what to focus on"
- Always: "What would need to be true for this to work? Let's test that assumption."

### What you DON'T do:
- Give legal advice (say "talk to a lawyer about this")
- Give specific tax advice (say "talk to an accountant")
- Promise outcomes ("this will definitely work")
- Encourage students to take on significant debt or risk they can't afford
- Validate bad ideas just to be nice

## User Context
{user_context_block}

## Retrieved Knowledge
The following content was retrieved from ASU entrepreneurship lectures, resources, and frameworks based on the student's question:

{retrieved_context_block}

When referencing this content:
- Quote specific advice if it's directly relevant
- Cite the source (speaker name, lecture title) when quoting
- Don't make up citations—only reference what's actually in the retrieved content
- If the retrieved content doesn't address the question, say so and use your general knowledge

## Tools Available
- **calculate**: For unit economics, TAM/SAM/SOM, break-even analysis. Use this when numbers matter—don't guess at math.
- **web_search**: For current market data, competitor research, recent industry news. Use this when the student needs current information.

Remember: Your goal is to help this student build something real that creates value. That requires honesty, resourcefulness, and genuine care for their success.
```

### Evaluation Framework Documents

These will be indexed and retrievable. Example:

```markdown
# Unit Economics Framework

## What This Is
Unit economics measures the direct revenues and costs associated with a single "unit" of your business—usually one customer or one transaction. If your unit economics don't work, scaling just means losing money faster.

## Key Metrics

### For Subscription/SaaS Businesses:
- **Customer Acquisition Cost (CAC)**: Total sales & marketing spend ÷ Number of new customers acquired
- **Lifetime Value (LTV)**: Average revenue per customer × Average customer lifespan (in months/years)
- **LTV:CAC Ratio**: Should be at least 3:1 for a healthy business. Below 1:1 means you're paying more to acquire customers than they're worth.
- **Payback Period**: How many months until a customer's revenue covers their acquisition cost. Under 12 months is generally good.

### For Transactional Businesses:
- **Gross Margin per Transaction**: (Revenue - COGS) ÷ Revenue
- **Contribution Margin**: Revenue - Variable Costs (COGS + transaction fees + variable fulfillment costs)
- **Break-even Volume**: Fixed Costs ÷ Contribution Margin per Unit

## Red Flags
- Assuming CAC will decrease "once we have brand awareness" (it often increases as you exhaust easy channels)
- Ignoring churn in LTV calculations
- Counting revenue that requires ongoing costs as pure profit
- "We'll make it up in volume" without the numbers to back it up

## Questions to Ask Yourself
1. What does it cost to acquire ONE customer through EACH channel you're considering?
2. How much does ONE customer pay you over their lifetime?
3. What are ALL the costs associated with serving ONE customer?
4. At what volume do you break even on monthly fixed costs?
5. Do these numbers get better or worse at scale?

## ASU Resources
- E+I Institute has mentors who can help you build financial models
- Venture Devils Demo Day requires unit economics in your pitch
```

---

## Phase 5: Calculator/Code Execution Tool

### Objective
Allow the bot to perform accurate financial calculations instead of estimating.

### Implementation

```python
# lib/calculator.py

from typing import Any
import math

def calculate_unit_economics(inputs: dict) -> dict:
    """
    Calculate key unit economics metrics.
    
    Expected inputs:
    - monthly_revenue_per_customer: float
    - average_customer_lifespan_months: float
    - customer_acquisition_cost: float
    - monthly_variable_cost_per_customer: float (optional, default 0)
    """
    mrpc = inputs.get('monthly_revenue_per_customer', 0)
    lifespan = inputs.get('average_customer_lifespan_months', 12)
    cac = inputs.get('customer_acquisition_cost', 0)
    variable_cost = inputs.get('monthly_variable_cost_per_customer', 0)
    
    gross_revenue_ltv = mrpc * lifespan
    total_variable_cost = variable_cost * lifespan
    ltv = gross_revenue_ltv - total_variable_cost
    
    ltv_cac_ratio = ltv / cac if cac > 0 else float('inf')
    
    monthly_profit = mrpc - variable_cost
    payback_months = cac / monthly_profit if monthly_profit > 0 else float('inf')
    
    return {
        'lifetime_value': round(ltv, 2),
        'ltv_cac_ratio': round(ltv_cac_ratio, 2),
        'payback_period_months': round(payback_months, 1),
        'monthly_profit_per_customer': round(monthly_profit, 2),
        'assessment': assess_unit_economics(ltv_cac_ratio, payback_months)
    }

def assess_unit_economics(ltv_cac: float, payback: float) -> str:
    if ltv_cac < 1:
        return "Critical: You're losing money on every customer. This model doesn't work without significant changes."
    elif ltv_cac < 3:
        return "Concerning: Your LTV:CAC ratio is below the healthy threshold of 3:1. Look for ways to increase customer value or reduce acquisition costs."
    elif payback > 18:
        return "Warning: Long payback period means you'll need significant capital to grow. Consider ways to accelerate revenue or reduce CAC."
    elif ltv_cac >= 3 and payback <= 12:
        return "Healthy: Your unit economics look solid. Focus on validating these assumptions with real customer data."
    else:
        return "Moderate: Numbers are workable but not exceptional. Continue refining as you get more data."

def calculate_tam_sam_som(inputs: dict) -> dict:
    """
    Calculate market size estimates.
    
    Expected inputs:
    - total_addressable_market: float (TAM - total market value)
    - serviceable_addressable_market_pct: float (what % of TAM you can serve)
    - realistic_market_share_pct: float (what % you can realistically capture in 3-5 years)
    """
    tam = inputs.get('total_addressable_market', 0)
    sam_pct = inputs.get('serviceable_addressable_market_pct', 100) / 100
    som_pct = inputs.get('realistic_market_share_pct', 1) / 100
    
    sam = tam * sam_pct
    som = sam * som_pct
    
    return {
        'tam': tam,
        'sam': round(sam, 2),
        'som': round(som, 2),
        'som_assessment': assess_market_size(som)
    }

def assess_market_size(som: float) -> str:
    if som < 1_000_000:
        return "Small market: This might be a lifestyle business rather than a venture-scale opportunity. That's okay if that's your goal."
    elif som < 10_000_000:
        return "Moderate market: Could support a solid business. May be challenging to raise VC but could bootstrap or raise from angels."
    elif som < 100_000_000:
        return "Good market size: Large enough for venture interest if other factors align."
    else:
        return "Large market: Market size isn't your constraint. Focus on differentiation and execution."

def calculate_break_even(inputs: dict) -> dict:
    """
    Calculate break-even point.
    
    Expected inputs:
    - monthly_fixed_costs: float
    - price_per_unit: float
    - variable_cost_per_unit: float
    """
    fixed = inputs.get('monthly_fixed_costs', 0)
    price = inputs.get('price_per_unit', 0)
    variable = inputs.get('variable_cost_per_unit', 0)
    
    contribution_margin = price - variable
    
    if contribution_margin <= 0:
        return {
            'error': "Your price doesn't cover variable costs. You lose money on every sale.",
            'contribution_margin': contribution_margin
        }
    
    break_even_units = math.ceil(fixed / contribution_margin)
    break_even_revenue = break_even_units * price
    
    return {
        'contribution_margin_per_unit': round(contribution_margin, 2),
        'break_even_units_per_month': break_even_units,
        'break_even_revenue_per_month': round(break_even_revenue, 2)
    }

def calculate_runway(inputs: dict) -> dict:
    """
    Calculate runway based on current resources and burn rate.
    
    Expected inputs:
    - current_cash: float
    - monthly_burn_rate: float
    - monthly_revenue: float (optional, default 0)
    """
    cash = inputs.get('current_cash', 0)
    burn = inputs.get('monthly_burn_rate', 0)
    revenue = inputs.get('monthly_revenue', 0)
    
    net_burn = burn - revenue
    
    if net_burn <= 0:
        return {
            'runway_months': float('inf'),
            'assessment': "You're profitable or break-even. Runway isn't your constraint."
        }
    
    runway = cash / net_burn
    
    return {
        'net_monthly_burn': round(net_burn, 2),
        'runway_months': round(runway, 1),
        'assessment': assess_runway(runway)
    }

def assess_runway(months: float) -> str:
    if months < 3:
        return "Critical: Less than 3 months of runway. You need to either generate revenue, cut costs, or raise money immediately."
    elif months < 6:
        return "Urgent: 6 months or less. Start fundraising or revenue push now—these things take longer than you think."
    elif months < 12:
        return "Moderate: You have some time but should be actively working on extending runway."
    else:
        return "Comfortable: 12+ months gives you room to experiment. Don't waste it."

def execute_calculation(calculation_type: str, inputs: dict, formula: str = None) -> dict:
    """Main entry point for the calculation tool."""
    
    calculators = {
        'unit_economics': calculate_unit_economics,
        'tam_sam_som': calculate_tam_sam_som,
        'break_even': calculate_break_even,
        'runway': calculate_runway
    }
    
    if calculation_type == 'custom' and formula:
        # For custom calculations, safely evaluate the formula
        # This is a simplified version—production would need sandboxing
        try:
            result = eval(formula, {"__builtins__": {}, "math": math}, inputs)
            return {'result': result}
        except Exception as e:
            return {'error': f"Calculation failed: {str(e)}"}
    
    if calculation_type in calculators:
        return calculators[calculation_type](inputs)
    
    return {'error': f"Unknown calculation type: {calculation_type}"}
```

---

## Phase 6: Deployment

### Option A: Vercel (Recommended for v1)
- **Pros**: Free tier, automatic deployments from GitHub, serverless, handles scaling
- **Cons**: API routes have cold starts, may need to optimize for long conversations
- **Cost**: Free tier likely sufficient for v1

### Option B: Railway
- **Pros**: Easy deployment, persistent processes, reasonable free tier
- **Cons**: More setup than Vercel
- **Cost**: ~$5/month after free tier

### Option C: Render
- **Pros**: Good free tier, supports both static and backend
- **Cons**: Free tier instances sleep after inactivity
- **Cost**: Free tier or ~$7/month for always-on

### Environment Variables Needed
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...  # For Whisper and embeddings
INDEX_PATH=/path/to/index_storage
```

### Cost Summary (Monthly, After Setup)
- **Claude API**: ~$20-30 depending on usage (claude-sonnet-4-20250514 at ~$3/1M input, $15/1M output tokens)
- **OpenAI Embeddings**: <$1 for query embeddings
- **Hosting**: $0-7 depending on option
- **Total**: ~$25-40/month

Initial setup costs (one-time):
- Whisper transcription: ~$2
- Initial embedding: ~$1

---

## Phase 7: Documentation for Handoff

### Required Documentation

1. **README.md**
   - Project overview and purpose
   - Quick start guide
   - Architecture diagram
   - Environment setup

2. **CONTENT_GUIDE.md**
   - How to add new transcripts
   - How to add new ASU resources
   - How to update frameworks
   - How to rebuild the index

3. **DEPLOYMENT_GUIDE.md**
   - Step-by-step deployment instructions
   - Environment variables reference
   - Common issues and solutions

4. **MAINTENANCE_GUIDE.md**
   - How to update the system prompt
   - How to modify evaluation frameworks
   - How to monitor costs and usage
   - How to handle user feedback

5. **FUTURE_ROADMAP.md**
   - Planned features not in v1
   - Ideas for improvement
   - Integration possibilities (Ahmedabad, other programs)

---

## Build Sequence for Claude Code

### Step 1: Project Setup
```
Create a Next.js 14 project with:
- TypeScript
- Tailwind CSS
- App Router
- API routes

Install dependencies:
- @anthropic-ai/sdk
- llama-index (Python, run via API or subprocess)
- openai (for Whisper)
```

### Step 2: Transcription Pipeline
```
Create Python scripts for:
1. Processing MP3 files with Whisper API
2. Saving transcripts as structured JSON with metadata
3. Batch processing from metadata Excel file
```

### Step 3: Indexing Pipeline
```
Create Python scripts for:
1. Loading transcript JSONs
2. Loading resource markdown files
3. Loading framework markdown files
4. Building LlamaIndex vector index
5. Persisting index to disk
6. Loading index for queries
```

### Step 4: Backend API
```
Create Next.js API routes:
1. /api/chat - Main conversation endpoint
2. /api/calculate - Financial calculation tool

Implement:
- LlamaIndex query integration
- Claude API integration
- Tool handling (calculate, web_search)
- Source formatting in responses
```

### Step 5: Frontend
```
Create React components:
1. OnboardingModal - Questionnaire flow
2. ChatInterface - Main chat UI
3. Message - Individual message display
4. SourceCard - Display retrieved sources
5. CalculationResult - Display calculation outputs

Implement:
- localStorage persistence for user context
- Chat history management
- Streaming responses (optional for v1)
```

### Step 6: Content Files
```
Create initial content:
1. ASU resource markdown files (Venture Devils, E+I, etc.)
2. Framework markdown files (unit economics, etc.)
3. Process existing MP3 files through transcription pipeline
4. Build initial index
```

### Step 7: System Prompt & Testing
```
1. Finalize system prompt
2. Test with sample conversations
3. Iterate on prompt based on response quality
4. Add edge case handling
```

### Step 8: Deployment & Documentation
```
1. Deploy to Vercel/Railway/Render
2. Write all documentation files
3. Create contribution guide for future maintainers
```

---

## Success Criteria

### v1 Launch (Before Graduation)
- [ ] Working chat interface deployed and accessible
- [ ] 1-5 hours of content indexed and retrievable
- [ ] Unit economics calculator functional
- [ ] System prompt producing honest, resourceful responses
- [ ] Documentation complete enough for handoff

### 6-Month Goals
- [ ] 25+ students have had meaningful sessions
- [ ] 5+ students report taking action based on feedback
- [ ] 1+ ASU stakeholder expresses adoption interest
- [ ] Someone other than Mudit can maintain and update content

---

## Open Questions for Future Versions

1. **Authentication**: Should students log in with ASU credentials? Would enable usage tracking and personalization.
2. **Conversation History**: Should the bot remember past conversations with the same student? Requires database.
3. **Mentor Handoff**: Could the bot facilitate introductions to human mentors for specific needs?
4. **Ahmedabad Integration**: Shared knowledge base for the 2+2 program students?
5. **Feedback Loop**: How do we learn which advice actually helped? Outcome tracking?

---

*Document prepared for Claude Code implementation. Start with Phase 1 (transcription) and work sequentially.*
