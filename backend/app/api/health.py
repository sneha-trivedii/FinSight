from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.db.database import get_connection

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("")
def get_health():
    # Check SQLite connection
    db_ok = False
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            db_ok = bool(cursor.fetchone())
    except Exception:
        db_ok = False

    # Check FAISS index
    faiss_file = settings.INDEX_DIR / "faiss.index"
    faiss_ok = faiss_file.exists()

    # Check BM25 index
    bm25_file = settings.INDEX_DIR / "bm25_index.pkl"
    bm25_ok = bm25_file.exists()

    # Never expose key itself
    has_api_key = bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10)

    return {
        "status": "healthy" if db_ok and has_api_key else "degraded",
        "gemini_api_configured": has_api_key,
        "database_connected": db_ok,
        "vector_index_present": faiss_ok,
        "bm25_index_present": bm25_ok,
        "gemini_model": settings.GEMINI_MODEL,
        "embedding_model": settings.EMBEDDING_MODEL,
        "version": settings.VERSION
    }
