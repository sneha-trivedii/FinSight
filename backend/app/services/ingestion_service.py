import logging
from pathlib import Path
from typing import Any, Optional
from backend.app.core.config import settings
from backend.app.db.repository import DocumentRepository, ChunkRepository
from backend.app.services.parser import PDFParser
from backend.app.services.chunker import DocumentChunker
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.dense_retriever import DenseRetriever
from backend.app.services.bm25_retriever import BM25Retriever

logger = logging.getLogger(__name__)

class IngestionService:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        dense_retriever: DenseRetriever,
        bm25_retriever: BM25Retriever
    ):
        self.parser = PDFParser()
        self.chunker = DocumentChunker(
            target_tokens=settings.CHUNK_SIZE,
            overlap_tokens=settings.CHUNK_OVERLAP
        )
        self.embedding_service = embedding_service
        self.dense_retriever = dense_retriever
        self.bm25_retriever = bm25_retriever

    def discover_pdfs(self) -> list[Path]:
        pdf_paths: list[Path] = []
        # Main data directory
        if settings.DATA_DIR.exists():
            for p in settings.DATA_DIR.glob("**/*.pdf"):
                if p.is_file():
                    pdf_paths.append(p)
        # Uploads directory
        if settings.UPLOAD_DIR.exists():
                if p.is_file() and p not in pdf_paths:
                    pdf_paths.append(p)
        return sorted(pdf_paths, key=lambda x: x.name)

    def register_all_discovered(self) -> None:
        discovered = self.discover_pdfs()
        for filepath in discovered:
            try:
                file_hash = self.parser.calculate_file_hash(filepath)
                doc_id = file_hash[:16]
                existing = DocumentRepository.get_by_id(doc_id)
                if not existing:
                    page_count = 0
                    first_text = ""
                    try:
                        import fitz
                        doc = fitz.open(filepath)
                        page_count = doc.page_count
                        for p in range(min(3, page_count)):
                            first_text += doc[p].get_text() + "\n"
                        doc.close()
                    except Exception as e:
                        logger.warning(f"Failed to read page count for {filepath.name}: {e}")

                    company, doc_type, period = self.parser.infer_metadata_from_name(filepath.name, first_text)
                    doc_data = {
                        "id": doc_id,
                        "filename": filepath.name,
                        "original_path": str(filepath),
                        "file_size": filepath.stat().st_size,
                        "file_hash": file_hash,
                        "page_count": page_count,
                        "company_name": company,
                        "document_type": doc_type,
                        "reporting_period": period,
                        "status": "discovered",
                        "chunk_count": 0,
                        "error_message": ""
                    }
                    DocumentRepository.upsert(doc_data)
            except Exception as e:
                logger.error(f"Error registering discovered PDF {filepath}: {e}")

    def process_document(self, filepath: Path, force: bool = False) -> dict[str, Any]:
        file_hash = self.parser.calculate_file_hash(filepath)
        doc_id = file_hash[:16]
        
        # Check existing record
        existing = DocumentRepository.get_by_id(doc_id)
        if existing and existing["status"] == "indexed" and not force:
            logger.info(f"Document {filepath.name} is already indexed. Skipping.")
            return {
                "document_id": doc_id,
                "filename": filepath.name,
                "status": "already_indexed",
                "chunk_count": existing["chunk_count"]
            }

        logger.info(f"Processing PDF: {filepath.name}...")
        try:
            # 1. Parse PDF
            parsed_doc = self.parser.parse_pdf(filepath)
            
            # Record in DB
            doc_data = {
                "id": doc_id,
                "filename": filepath.name,
                "original_path": str(filepath),
                "file_size": filepath.stat().st_size,
                "file_hash": file_hash,
                "page_count": parsed_doc.page_count,
                "company_name": parsed_doc.company_name,
                "document_type": parsed_doc.document_type,
                "reporting_period": parsed_doc.reporting_period,
                "status": "parsing",
                "chunk_count": 0,
                "error_message": ""
            }
            DocumentRepository.upsert(doc_data)

            # 2. Chunk Document
            chunks = self.chunker.chunk_document(doc_id, parsed_doc)
            if not chunks:
                DocumentRepository.update_status(doc_id, "indexed", 0)
                return {
                    "document_id": doc_id,
                    "filename": filepath.name,
                    "status": "indexed",
                    "chunk_count": 0
                }

            # Save chunks to DB
            ChunkRepository.save_chunks(chunks)

            # 3. Dense Embeddings
            chunk_ids = [c["chunk_id"] for c in chunks]
            chunk_texts = [
                f"{c['company_name']} {c['document_type']} {c['section_title']}\n{c['content']}"
                for c in chunks
            ]
            embeddings = self.embedding_service.get_document_embeddings_batch(chunk_texts, batch_size=20)
            self.dense_retriever.add_embeddings(chunk_ids, embeddings)

            # 4. BM25 Keywords
            self.bm25_retriever.add_chunks(chunk_ids, chunk_texts)

            # Update Document status to indexed
            DocumentRepository.update_status(doc_id, "indexed", len(chunks))
            logger.info(f"Successfully processed {filepath.name}: {len(chunks)} chunks.")

            return {
                "document_id": doc_id,
                "filename": filepath.name,
                "status": "indexed",
                "chunk_count": len(chunks),
                "company_name": parsed_doc.company_name,
                "document_type": parsed_doc.document_type
            }

        except Exception as e:
            logger.error(f"Error processing {filepath.name}: {e}")
            DocumentRepository.update_status(doc_id, "failed", 0, str(e))
            return {
                "document_id": doc_id,
                "filename": filepath.name,
                "status": "failed",
                "error": str(e)
            }

    def sync_all_documents(self, force: bool = False, max_docs: Optional[int] = None) -> dict[str, Any]:
        discovered = self.discover_pdfs()
        if max_docs:
            discovered = discovered[:max_docs]

        results = []
        indexed_count = 0
        failed_count = 0
        skipped_count = 0

        for path in discovered:
            res = self.process_document(path, force=force)
            results.append(res)
            if res["status"] == "indexed":
                indexed_count += 1
            elif res["status"] == "already_indexed":
                skipped_count += 1
            elif res["status"] == "failed":
                failed_count += 1

        return {
            "total_discovered": len(discovered),
            "indexed_count": indexed_count,
            "skipped_count": skipped_count,
            "failed_count": failed_count,
            "results": results
        }
