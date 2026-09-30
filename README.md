# AI Document Summarizer

React (Vite) + Node/Express + OpenAI API. Upload a PDF, DOCX, TXT or MD file, get a summary and key points.

## Setup

```bash
# 1. Backend
cd server
npm install
cp .env.example .env      # add your OPENAI_API_KEY
npm start                 # http://localhost:5000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173
```

## How it works

1. The client sends the file and options to `POST /api/summarize` (multipart form).
2. The server extracts text (`pdf-parse` for PDF, `mammoth` for DOCX, UTF-8 for TXT/MD).
3. Long texts are split into chunks, each chunk is summarized, then the partial summaries are merged (map-reduce).
4. OpenAI returns JSON: `{ summary, keyPoints }`, which the UI displays.

## Configuration (`server/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | required | Your OpenAI key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model to use |
| `PORT` | `5000` | API port |

Files are processed in memory and never written to disk. Limit: 10 MB.
Scanned PDFs (images only) have no extractable text; add OCR if you need them.
