import json
import sqlite3
from datetime import datetime
from typing import Any, Optional
from backend.app.db.database import get_connection

class DocumentRepository:
    @staticmethod
    def get_all() -> list[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents ORDER BY created_at DESC")
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_by_id(doc_id: str) -> Optional[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def upsert(doc_data: dict) -> None:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO documents (
                id, filename, original_path, file_size, file_hash,
                page_count, company_name, document_type, reporting_period,
                status, chunk_count, error_message, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                page_count=excluded.page_count,
                company_name=excluded.company_name,
                document_type=excluded.document_type,
                reporting_period=excluded.reporting_period,
                status=excluded.status,
                chunk_count=excluded.chunk_count,
                error_message=excluded.error_message,
                updated_at=CURRENT_TIMESTAMP
            """, (
                doc_data["id"],
                doc_data["filename"],
                doc_data["original_path"],
                doc_data["file_size"],
                doc_data["file_hash"],
                doc_data.get("page_count", 0),
                doc_data.get("company_name", ""),
                doc_data.get("document_type", ""),
                doc_data.get("reporting_period", ""),
                doc_data.get("status", "unprocessed"),
                doc_data.get("chunk_count", 0),
                doc_data.get("error_message", "")
            ))
            conn.commit()

    @staticmethod
    def update_status(doc_id: str, status: str, chunk_count: int = 0, error_message: str = ""):
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE documents 
            SET status = ?, chunk_count = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, (status, chunk_count, error_message, doc_id))
            conn.commit()

class ChunkRepository:
    @staticmethod
    def save_chunks(chunks: list[dict]):
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany("""
            INSERT OR REPLACE INTO chunks (
                chunk_id, document_id, chunk_index, page_number,
                start_page, end_page, section_title, section_path,
                content, content_hash, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                (
                    c["chunk_id"],
                    c["document_id"],
                    c["chunk_index"],
                    c["page_number"],
                    c["start_page"],
                    c["end_page"],
                    c.get("section_title", ""),
                    c.get("section_path", ""),
                    c["content"],
                    c["content_hash"],
                    json.dumps(c.get("metadata", {}))
                )
                for c in chunks
            ])
            conn.commit()

    @staticmethod
    def get_by_document(doc_id: str) -> list[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT chunks.*, documents.filename as document_name, documents.company_name, documents.document_type, documents.reporting_period 
            FROM chunks 
            JOIN documents ON chunks.document_id = documents.id 
            WHERE chunks.document_id = ? 
            ORDER BY chunks.chunk_index ASC
            """, (doc_id,))
            rows = cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["metadata"] = json.loads(d.pop("metadata_json", "{}"))
                result.append(d)
            return result

    @staticmethod
    def get_all() -> list[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT chunks.*, documents.filename as document_name, documents.company_name, documents.document_type, documents.reporting_period 
            FROM chunks 
            JOIN documents ON chunks.document_id = documents.id 
            ORDER BY chunks.document_id, chunks.chunk_index ASC
            """)
            rows = cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["metadata"] = json.loads(d.pop("metadata_json", "{}"))
                result.append(d)
            return result

    @staticmethod
    def get_by_ids(chunk_ids: list[str]) -> list[dict]:
        if not chunk_ids:
            return []
        with get_connection() as conn:
            cursor = conn.cursor()
            placeholders = ",".join("?" for _ in chunk_ids)
            cursor.execute(f"""
            SELECT chunks.*, documents.filename as document_name, documents.company_name, documents.document_type, documents.reporting_period 
            FROM chunks 
            JOIN documents ON chunks.document_id = documents.id 
            WHERE chunks.chunk_id IN ({placeholders})
            """, chunk_ids)
            rows = cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["metadata"] = json.loads(d.pop("metadata_json", "{}"))
                result.append(d)
            return result

class ConversationRepository:
    @staticmethod
    def get_all() -> list[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM conversations ORDER BY updated_at DESC")
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_by_id(conv_id: str) -> Optional[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def create(conv_id: str, title: str) -> dict:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO conversations (id, title, created_at, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (conv_id, title))
            conn.commit()
            return {"id": conv_id, "title": title}

    @staticmethod
    def add_message(msg_id: str, conv_id: str, role: str, content: str, citations: list = None, diagnostics: dict = None):
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO messages (id, conversation_id, role, content, citations_json, diagnostics_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (
                msg_id,
                conv_id,
                role,
                content,
                json.dumps(citations or []),
                json.dumps(diagnostics or {})
            ))
            cursor.execute("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (conv_id,))
            conn.commit()

    @staticmethod
    def get_messages(conv_id: str) -> list[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC", (conv_id,))
            rows = cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["citations"] = json.loads(d.pop("citations_json", "[]"))
                d["diagnostics"] = json.loads(d.pop("diagnostics_json", "{}"))
                result.append(d)
            return result

class EvaluationRepository:
    @staticmethod
    def save_candidates(candidates: list[dict]):
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany("""
            INSERT OR IGNORE INTO evaluation_candidates (
                id, question, reference_answer, source_document,
                source_pages, supporting_text, question_type, status, reviewer_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                (
                    c["id"],
                    c["question"],
                    c["reference_answer"],
                    c["source_document"],
                    str(c.get("source_pages", "")),
                    c.get("supporting_text", ""),
                    c.get("question_type", "factual_lookup"),
                    c.get("status", "pending_review"),
                    c.get("reviewer_notes", "")
                )
                for c in candidates
            ])
            conn.commit()

    @staticmethod
    def get_candidates(status: Optional[str] = None, doc_name: Optional[str] = None) -> list[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM evaluation_candidates WHERE 1=1"
            params = []
            if status:
                query += " AND status = ?"
                params.append(status)
            if doc_name:
                query += " AND source_document = ?"
                params.append(doc_name)
            query += " ORDER BY created_at DESC"
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def update_candidate(example_id: str, updates: dict) -> Optional[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            fields = []
            params = []
            for k, v in updates.items():
                if k in ["question", "reference_answer", "status", "reviewer_notes", "question_type"]:
                    fields.append(f"{k} = ?")
                    params.append(v)
            if not fields:
                return None
            fields.append("updated_at = CURRENT_TIMESTAMP")
            params.append(example_id)
            cursor.execute(f"UPDATE evaluation_candidates SET {', '.join(fields)} WHERE id = ?", params)
            conn.commit()
            cursor.execute("SELECT * FROM evaluation_candidates WHERE id = ?", (example_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def batch_update_status(example_ids: list[str], status: str):
        if not example_ids:
            return
        with get_connection() as conn:
            cursor = conn.cursor()
            placeholders = ",".join("?" for _ in example_ids)
            cursor.execute(f"""
            UPDATE evaluation_candidates 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id IN ({placeholders})
            """, [status, *example_ids])
            conn.commit()

    @staticmethod
    def create_run(run_id: str, run_name: str, example_count: int) -> dict:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO evaluation_runs (id, run_name, example_count, status)
            VALUES (?, ?, ?, 'running')
            """, (run_id, run_name, example_count))
            conn.commit()
            return {"id": run_id, "run_name": run_name, "example_count": example_count, "status": "running"}

    @staticmethod
    def complete_run(run_id: str, metrics: dict, status: str = "completed", error_message: str = ""):
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE evaluation_runs
            SET metrics_json = ?, status = ?, error_message = ?
            WHERE id = ?
            """, (json.dumps(metrics), status, error_message, run_id))
            conn.commit()

    @staticmethod
    def save_run_items(items: list[dict]):
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany("""
            INSERT INTO evaluation_run_items (
                id, run_id, candidate_id, question, reference_answer,
                generated_answer, retrieved_contexts_json, scores_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                (
                    it["id"],
                    it["run_id"],
                    it.get("candidate_id"),
                    it["question"],
                    it["reference_answer"],
                    it["generated_answer"],
                    json.dumps(it.get("retrieved_contexts", [])),
                    json.dumps(it.get("scores", {}))
                )
                for it in items
            ])
            conn.commit()

    @staticmethod
    def get_all_runs() -> list[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM evaluation_runs ORDER BY created_at DESC")
            rows = cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["metrics"] = json.loads(d.pop("metrics_json", "{}"))
                result.append(d)
            return result

    @staticmethod
    def get_run_details(run_id: str) -> Optional[dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM evaluation_runs WHERE id = ?", (run_id,))
            run_row = cursor.fetchone()
            if not run_row:
                return None
            run_dict = dict(run_row)
            run_dict["metrics"] = json.loads(run_dict.pop("metrics_json", "{}"))
            
            cursor.execute("SELECT * FROM evaluation_run_items WHERE run_id = ? ORDER BY created_at ASC", (run_id,))
            items = []
            for r in cursor.fetchall():
                it = dict(r)
                it["retrieved_contexts"] = json.loads(it.pop("retrieved_contexts_json", "[]"))
                it["scores"] = json.loads(it.pop("scores_json", "{}"))
                items.append(it)
            run_dict["items"] = items
            return run_dict
