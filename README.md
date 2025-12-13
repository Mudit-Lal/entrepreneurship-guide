# ASU Entrepreneurship Mentor Bot

An AI-powered mentorship tool for ASU student entrepreneurs. The bot combines ASU-specific entrepreneurship content with realistic, honest business guidance.

## Features

- **Chat Interface**: Conversational AI mentor powered by Claude
- **RAG-based Knowledge**: Retrieves relevant content from transcribed lectures, ASU resources, and business frameworks
- **Financial Calculators**: Unit economics, TAM/SAM/SOM, break-even, and runway calculations
- **User Context**: Personalized advice based on stage, visa status, timeline, and more
- **Source Citations**: Links back to original content

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes
- **LLM**: Claude API (claude-sonnet-4-20250514)
- **Vector Database**: Pinecone Serverless
- **Embeddings**: OpenAI text-embedding-3-small
- **Transcription**: OpenAI Whisper API

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- API Keys for:
  - Anthropic (Claude)
  - OpenAI (Whisper + Embeddings)
  - Pinecone

### Installation

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your API keys
   ```

3. **Set up Python environment (for content processing)**
   ```bash
   python -m venv venv
   source venv/bin/activate  # or `venv\Scripts\activate` on Windows
   pip install -r requirements.txt
   ```

### Content Processing Pipeline

1. **Fetch YouTube metadata** (if MP3 files are named with video IDs)
   ```bash
   python scripts/fetch-metadata.py --mp3-dir ./mp3 --output ./content_metadata.json
   ```

2. **Transcribe audio files**
   ```bash
   python scripts/transcribe.py --limit 10  # Start with 10 files for testing
   ```

3. **Build and upload index to Pinecone**
   ```bash
   python scripts/build-index.py
   ```

### Running the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── page.tsx              # Main chat page
│   ├── layout.tsx            # App layout
│   ├── globals.css           # Global styles
│   └── api/
│       ├── chat/route.ts     # Chat endpoint
│       └── calculate/route.ts # Calculator endpoint
├── components/
│   ├── ChatInterface.tsx     # Main chat UI
│   ├── OnboardingModal.tsx   # User context collection
│   ├── Message.tsx           # Message display
│   └── SourceCard.tsx        # Source citation display
├── lib/
│   ├── pinecone.ts           # Vector search
│   ├── calculator.ts         # Financial calculations
│   └── prompts.ts            # System prompt builder
├── scripts/
│   ├── fetch-metadata.py     # YouTube metadata extraction
│   ├── transcribe.py         # Whisper transcription
│   └── build-index.py        # Pinecone indexing
├── content/
│   ├── transcripts/          # Generated transcripts
│   ├── asu_resources/        # ASU program info
│   └── frameworks/           # Business frameworks
├── types/
│   └── index.ts              # TypeScript types
└── mp3/                      # Audio files (not in git)
```

## Content

### ASU Resources
- Venture Devils program
- E+I Institute programs
- Funding opportunities
- SkySong Innovations
- TEM/MOT program
- Pitch competitions

### Business Frameworks
- Unit economics
- TAM/SAM/SOM market sizing
- Customer validation
- Competitive analysis
- Founder-market fit

## API Endpoints

### POST /api/chat
Send chat messages and receive AI responses with source citations.

### POST /api/calculate
Execute financial calculations:
- `unit_economics`: CAC, LTV, LTV:CAC ratio
- `tam_sam_som`: Market size estimates
- `break_even`: Break-even analysis
- `runway`: Runway calculations

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=asu-mentor
```

## Cost Estimates

| Item | Cost |
|------|------|
| Whisper transcription (5 hrs) | ~$1.80 |
| OpenAI embeddings | <$1 |
| Pinecone | Free tier |
| Vercel hosting | Free tier |
| Claude API (usage) | ~$20-30/month |

## License

MIT
