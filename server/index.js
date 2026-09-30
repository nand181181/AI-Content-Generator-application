require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse/lib/pdf-parse.js"); // avoids pdf-parse's debug-mode bug
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 5000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const CHUNK_SIZE = 12000; // characters per chunk
const MAX_CHUNKS = 12;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());

const LENGTHS = {
  short: "about 3 sentences",
  medium: "one or two paragraphs",
  detailed: "three to four paragraphs covering all major sections",
};

async function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".pdf") return (await pdfParse(file.buffer)).text;
  if (ext === ".docx") return (await mammoth.extractRawText({ buffer: file.buffer })).value;
  if (ext === ".txt" || ext === ".md") return file.buffer.toString("utf-8");
  const err = new Error("Unsupported file type. Use PDF, DOCX, TXT or MD.");
  err.status = 400;
  throw err;
}

function chunkText(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) chunks.push(text.slice(i, i + CHUNK_SIZE));
  return chunks.slice(0, MAX_CHUNKS);
}

async function chat(system, user, json = false) {
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    ...(json && { response_format: { type: "json_object" } }),
  });
  return res.choices[0].message.content;
}

async function summarize(text, length) {
  const chunks = chunkText(text);
  let source = text;

  // Map step: summarize each chunk of a long document
  if (chunks.length > 1) {
    const partials = await Promise.all(
      chunks.map((c) => chat("Summarize this part of a longer document faithfully and concisely.", c))
    );
    source = partials.join("\n\n");
  }

  // Reduce step: final structured summary
  const raw = await chat(
    `You summarize documents. Respond only with JSON: {"summary": string, "keyPoints": string[]}.
The summary must be ${LENGTHS[length] || LENGTHS.medium}. Provide 4-7 key points. Use only information from the document.`,
    source,
    true
  );
  const parsed = JSON.parse(raw);
  return { summary: parsed.summary, keyPoints: parsed.keyPoints || [] };
}

app.post("/api/summarize", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY." });

    const text = (await extractText(req.file)).replace(/\s+\n/g, "\n").trim();
    if (text.length < 50) {
      return res.status(422).json({ error: "Couldn't find readable text. Scanned PDFs need OCR." });
    }

    const result = await summarize(text, req.body.length);
    res.json({
      ...result,
      stats: { fileName: req.file.originalname, characters: text.length, words: text.split(/\s+/).length },
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Summarization failed. Try again." });
  }
});

app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File is larger than 10 MB." });
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
