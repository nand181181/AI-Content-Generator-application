import { useRef, useState } from "react";

const ACCEPTED = [".pdf", ".docx", ".txt", ".md"];
const LENGTHS = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "detailed", label: "Detailed" },
];

const formatSize = (b) =>
  b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;

export default function App() {
  const [file, setFile] = useState(null);
  const [length, setLength] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  const pick = (f) => {
    if (!f) return;
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) return setError("Unsupported file. Use PDF, DOCX, TXT or MD.");
    if (f.size > 10 * 1024 * 1024) return setError("File is larger than 10 MB.");
    setError("");
    setResult(null);
    setFile(f);
  };

  const summarize = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("length", length);
      const res = await fetch("/api/summarize", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    const text = `${result.summary}\n\nKey points:\n${result.keyPoints.map((p) => `- ${p}`).join("\n")}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <nav className="navbar navbar-dark bg-primary shadow-sm">
        <div className="container">
          <span className="navbar-brand fw-semibold mb-0">Document Summarizer</span>
          <span className="navbar-text small text-white-50 d-none d-sm-inline">
            PDF, DOCX, TXT, MD
          </span>
        </div>
      </nav>

      <main className="container py-4 py-md-5" style={{ maxWidth: 820 }}>
        <div className="text-center mb-4">
          <h1 className="display-6 fw-bold">Read less. Know more.</h1>
          <p className="text-body-secondary mb-0">
            Upload a document and get a summary with the key points pulled out.
          </p>
        </div>

        <div className="card shadow-sm border-0">
          <div className="card-body p-4">
            <div
              className={`dropzone rounded-3 p-4 p-md-5 text-center ${dragging ? "dragging" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
            >
              <input
                ref={inputRef}
                type="file"
                hidden
                accept={ACCEPTED.join(",")}
                onChange={(e) => pick(e.target.files[0])}
              />
              {file ? (
                <>
                  <div className="fw-semibold text-break">{file.name}</div>
                  <div className="small text-body-secondary">
                    {formatSize(file.size)}. Click to choose a different file.
                  </div>
                </>
              ) : (
                <>
                  <div className="fw-semibold">Drop a file here, or click to browse</div>
                  <div className="small text-body-secondary">PDF, DOCX, TXT or MD, up to 10 MB</div>
                </>
              )}
            </div>

            <div className="d-flex flex-column flex-sm-row gap-3 justify-content-between align-items-stretch align-items-sm-center mt-4">
              <div className="btn-group" role="group" aria-label="Summary length">
                {LENGTHS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`btn ${length === l.id ? "btn-primary" : "btn-outline-primary"}`}
                    aria-pressed={length === l.id}
                    onClick={() => setLength(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <button className="btn btn-success px-4" disabled={!file || loading} onClick={summarize}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                    Summarizing…
                  </>
                ) : (
                  "Summarize"
                )}
              </button>
            </div>

            {error && (
              <div className="alert alert-danger mt-4 mb-0" role="alert">
                {error}
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className="card shadow-sm border-0 mt-4">
            <div className="card-header bg-white d-flex justify-content-between align-items-start gap-3 py-3">
              <div className="min-w-0">
                <h2 className="h5 mb-1">Summary</h2>
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge text-bg-light text-break">{result.stats.fileName}</span>
                  <span className="badge text-bg-secondary">
                    {result.stats.words.toLocaleString()} words
                  </span>
                </div>
              </div>
              <button className="btn btn-outline-secondary btn-sm flex-shrink-0" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="card-body p-4">
              <p className="summary-text">{result.summary}</p>
              <h3 className="h6 text-uppercase text-body-secondary mt-4">Key points</h3>
              <ul className="list-group list-group-flush">
                {result.keyPoints.map((p, i) => (
                  <li key={i} className="list-group-item px-0">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </>
  );
}