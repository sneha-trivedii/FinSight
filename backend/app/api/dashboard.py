from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.db.database import get_connection
from backend.app.db.repository import DocumentRepository, EvaluationRepository
from backend.app.schemas.dashboard import DashboardSummary
from backend.app.services.ingestion_service import IngestionService
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.dense_retriever import DenseRetriever
from backend.app.services.bm25_retriever import BM25Retriever

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("", response_model=DashboardSummary)
def get_dashboard():
    # 1. Discovered documents count from disk
    emb = EmbeddingService()
    dense = DenseRetriever(dimension=emb.dimension)
    bm25 = BM25Retriever()
    ingestion_svc = IngestionService(emb, dense, bm25)
    discovered_pdfs = ingestion_svc.discover_pdfs()
    discovered_count = len(discovered_pdfs)

    # 2. Database statistics
    all_docs = DocumentRepository.get_all()
    processed_count = sum(1 for d in all_docs if d["status"] == "indexed")
    failed_count = sum(1 for d in all_docs if d["status"] == "failed")
    total_chunks = sum(d["chunk_count"] for d in all_docs if d["status"] == "indexed")

    # 3. Questions asked count
    questions_count = 0
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM messages WHERE role = 'user'")
        row = cursor.fetchone()
        if row:
            questions_count = row[0]

    # 4. Recent documents
    recent_docs = all_docs[:5]

    # 5. Latest evaluation run
    latest_eval = None
    all_runs = EvaluationRepository.get_all_runs()
    if all_runs:
        latest_eval = all_runs[0]

    # 6. System health
    has_api_key = bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10)
    faiss_present = (settings.INDEX_DIR / "faiss.index").exists()
    bm25_present = (settings.INDEX_DIR / "bm25_index.pkl").exists()

    last_indexing_time = all_docs[0]["updated_at"] if all_docs else "Never"

    system_health = {
        "gemini_api_status": "Connected" if has_api_key else "Missing API Key",
        "embedding_index_status": "Ready" if faiss_present else "Not Indexed",
        "keyword_index_status": "Ready" if bm25_present else "Not Indexed",
        "last_indexing_time": last_indexing_time,
        "active_gemini_model": settings.GEMINI_MODEL,
        "active_embedding_model": settings.EMBEDDING_MODEL
    }

    return DashboardSummary(
        discovered_documents_count=discovered_count,
        processed_documents_count=processed_count,
        failed_documents_count=failed_count,
        total_chunks_count=total_chunks,
        questions_asked_count=questions_count,
        recent_documents=recent_docs,
        latest_evaluation_run=latest_eval,
        system_health=system_health
    )
