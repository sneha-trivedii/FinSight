import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from backend.app.core.config import settings
from backend.app.db.repository import DocumentRepository, ChunkRepository
from backend.app.schemas.documents import DocumentResponse, ChunkResponse
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.dense_retriever import DenseRetriever
from backend.app.services.bm25_retriever import BM25Retriever
from backend.app.services.ingestion_service import IngestionService

router = APIRouter(prefix="/documents", tags=["Documents"])

def get_ingestion_service() -> IngestionService:
    emb_service = EmbeddingService()
    dense = DenseRetriever(dimension=emb_service.dimension)
    bm25 = BM25Retriever()
    return IngestionService(emb_service, dense, bm25)

@router.get("", response_model=list[DocumentResponse])
def list_documents():
    svc = get_ingestion_service()
    svc.register_all_discovered()
    return DocumentRepository.get_all()

@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: str):
    doc = DocumentRepository.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.get("/{doc_id}/chunks", response_model=list[ChunkResponse])
def get_document_chunks(doc_id: str):
    chunks = ChunkRepository.get_by_document(doc_id)
    return chunks

@router.post("/sync")
def sync_documents(force: bool = False, max_docs: Optional[int] = None):
    svc = get_ingestion_service()
    res = svc.sync_all_documents(force=force, max_docs=max_docs)
    return res

@router.post("/{doc_id}/process")
def process_document(doc_id: str):
    doc = DocumentRepository.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    filepath = Path(doc["original_path"])
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Underlying document file not found on disk")

    svc = get_ingestion_service()
    res = svc.process_document(filepath, force=True)
    return res

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    # Restrict to PDF files
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are permitted.")

    # Sanitize filename to avoid path traversal
    safe_name = Path(file.filename).name
    save_path = settings.UPLOAD_DIR / safe_name

    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {e}")

    # Immediately process the uploaded PDF
    svc = get_ingestion_service()
    res = svc.process_document(save_path, force=True)
    return {
        "message": "File uploaded and processed successfully",
        "result": res
    }
