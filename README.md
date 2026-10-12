# FinSight: Financial Document Intelligence Platform

**FinSight** is an enterprise-grade financial-document intelligence web application. It features structure-aware PDF parsing (PyMuPDF), hybrid retrieval combining dense semantic vectors (FAISS) and keyword matching (BM25) via Reciprocal Rank Fusion (RRF), grounded question answering using Google Gemini, interactive inline source citations, and an end-to-end RAGAS evaluation workflow with human approval.

---

## 1. Architecture Overview

```
                            ┌─────────────────────────────────────────┐
                            │    FinSight Frontend (React + Vite)     │
                            │   Angel One Blue Theme (#1976D2)        │
                            └────────────────────┬────────────────────┘
                                                 │ HTTP / REST
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FastAPI Backend Engine                                      │
├───────────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│    PDF Ingestion & Parser     │      Hybrid Retrieval       │      RAGAS Evaluation         │
│  - PyMuPDF Block & Line Spans │  - FAISS (Cosine FlatIP)    │  - Candidate QA Generator     │
│  - Heading & Section Detection│  - BM25 (Financial Tokens)  │  - Human Review & Approval UI │
│  - Table Markdown Formatting  │  - Reciprocal Rank Fusion   │  - Faithfulness & Relevancy   │
│  - Token-Aware Chunker (600t) │  - Citation Validator       │  - Context Precision & Recall │
└───────────────┬───────────────┴──────────────┬──────────────┴───────────────┬───────────────┘
                │                              │                              │
                ▼                              ▼                              ▼
      ┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
      │   storage/       │           │ storage/indexes/ │           │ storage/         │
      │   finsight.db    │           │ - faiss.index    │           │ - candidate QAs  │
      │   (SQLite)       │           │ - bm25_index.pkl │           │ - RAGAS runs     │
      └──────────────────┘           └──────────────────┘           └──────────────────┘
```

---

## 2. Prerequisites & Technology Stack

- **Operating System:** Windows, macOS, or Linux
- **Python:** 3.10+
- **Node.js:** v18+ or v20+ (Node.js v20.18.0 standalone included)
- **Backend Framework:** FastAPI, Uvicorn, Pydantic v2
- **PDF Extraction:** PyMuPDF (`pymupdf`)
- **Retrieval:** FAISS-CPU, `rank-bm25` (BM25Okapi)
- **LLM & Embeddings:** Google Generative AI (`gemini-flash-latest`, `models/gemini-embedding-001`)
- **Evaluation:** RAGAS (`ragas`), LangChain Google GenAI, Datasets
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons

---

## 3. Environment Configuration

The application loads environment variables from `.env` in the project root:

```env
GEMINI_API_KEY=your_actual_gemini_api_key
GEMINI_MODEL=gemini-flash-latest
EMBEDDING_MODEL=models/gemini-embedding-001
STORAGE_DIR=storage
DATA_DIR=data
```

> **Security Note:** The `.env` file is excluded in `.gitignore` and is never exposed to browser requests, JavaScript, or public logs. A `.env.example` file is provided for reference.

---

## 4. How to Launch FinSight

### Step 1: Start the Backend Server

Run the Python backend entrypoint:
```powershell
python run_backend.py
```
*Alternatively on Windows, double-click `start_backend.bat`.*

The backend will start at:
- **API Base:** `http://127.0.0.1:8000`
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`
- **Health Endpoint:** `http://127.0.0.1:8000/api/health`

### Step 2: Start the React Frontend

In a second terminal:
```powershell
cd frontend
npm run dev
```
*Alternatively on Windows, double-click `start_frontend.bat`.*

The web application opens at:
- **Frontend URL:** `http://localhost:5173`

---

## 5. End-to-End Workflow & Demo Walkthrough

### 1. Dashboard Overview
- Navigate to `http://localhost:5173/dashboard`.
- Review real-time metrics: Discovered PDFs, Indexed Documents, Indexed Chunks, Questions Asked, and System Readiness.
- Click **"Sync & Index PDFs"** to automatically discover and index any new files from `data/` or `storage/uploads/`.

### 2. Document Library & Chunk Inspection
- Navigate to **Documents** (`/documents`).
- Inspect discovered filings across Angel One, HDFC Bank, Apollo Hospitals, and RBI circulars.
- Click **"Inspect Chunks"** on any document to view reconstructed sections, page numbers, financial tables, and token diagnostics.
- Test PDF uploading via the **"Upload PDF"** button.

### 3. Grounded Financial Research Chat
- Navigate to **Research Chat** (`/`).
- Click one of the grounded prompt suggestions or ask your own question:
  - *"What was Angel One's client base and quarterly client additions in Q1 '25?"*
  - *"What credit ratings were assigned to HDFC Bank and what was the outlook?"*
  - *"Summarize the key decisions from the board meetings."*
- Notice the answer includes inline citation markers like `[1]` and `[2]`.
- Click on **"Verified Sources"** or any citation card to view the exact document name, page number, section, and verbatim excerpt.
- Click the latency badge to inspect **Retrieval Diagnostics** (Dense candidates, BM25 candidates, fused RRF score, generation latency).

### 4. RAGAS Evaluation Workflow
- Navigate to **RAGAS Evaluation** (`/evaluation`).
- **Stage A (Generation):** Click **"Generate Candidate QA"** to extract grounded questions from actual document passages.
- **Stage B (Human Review & Approval):**
  - Review candidate QA pairs in the **Pending Review** tab.
  - Inspect the underlying source excerpt and page number.
  - Click **Approve** or **Edit** to modify questions/answers.
  - Notice only `approved` examples can enter the RAGAS evaluation run.
- **Stage C (Benchmark Run):**
  - Click **"Run RAGAS on Approved"**.
  - FinSight runs the real hybrid retrieval + Gemini answer generation pipeline, then evaluates `Faithfulness`, `Answer Relevancy`, `Context Precision`, and `Context Recall`.
  - View the scorecard and inspect the **Per-Question Breakdown** comparing Reference vs. Generated Answers.
  - Click **"Export CSV"** to download the evaluation results.

---

## 6. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Diagnostic status (DB, Gemini key, FAISS, BM25) |
| `GET` | `/api/dashboard` | Corpus summary statistics and latest benchmark |
| `GET` | `/api/documents` | List discovered and processed documents |
| `POST` | `/api/documents/sync` | Discover and index new PDF files |
| `POST` | `/api/documents/upload` | Upload and index new PDF file |
| `GET` | `/api/documents/{id}/chunks` | Inspect chunked passages and metadata |
| `POST` | `/api/chat` | Hybrid retrieval + Gemini answer generation |
| `GET` | `/api/chat/conversations` | List conversation histories |
| `POST` | `/api/evaluation/datasets/generate` | Generate grounded candidate QA pairs |
| `GET` | `/api/evaluation/datasets` | List candidate examples with filter |
| `POST` | `/api/evaluation/datasets/{id}/approve` | Approve QA example for benchmark |
| `POST` | `/api/evaluation/datasets/{id}/reject` | Reject QA example |
| `POST` | `/api/evaluation/runs` | Execute RAGAS evaluation run |
| `GET` | `/api/evaluation/runs` | List past evaluation benchmark runs |
| `GET` | `/api/evaluation/runs/{id}` | Inspect per-question evaluation breakdown |
| `GET` | `/api/evaluation/runs/{id}/export` | Export evaluation results as CSV |

---

## 7. Automated Test Suite

Run the unit tests:
```powershell
python -m unittest backend/tests/test_finsight.py
```
Output:
```
.....
----------------------------------------------------------------------
Ran 5 tests in 0.337s

OK
```
Tests verify:
- Metadata inference (company name, document type, fiscal period)
- Structure-aware chunking and metadata preservation
- Financial tokenization for BM25
- Citation extraction and validation logic
- Reciprocal Rank Fusion (RRF) math

---

## 8. Current Limitations & Considerations

- **Gemini Free-Tier Rate Limits:** On Google AI Studio free tier keys, request limits (15 RPM / 100 requests per minute for embeddings) apply. The application includes adaptive backoff retry pacing.
- **Large PDF Ingestion:** Highly voluminous annual reports (100+ pages) are chunked in batches. When indexing the full corpus at once, use the "Sync All" button which processes documents sequentially.
- **Evaluations:** RAGAS metrics execute multiple LLM calls. For live demonstrations, evaluating 1 to 3 approved examples is recommended for near-instant completion.
