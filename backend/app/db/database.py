import sqlite3
from pathlib import Path
from backend.app.core.config import settings

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(settings.DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Documents table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_hash TEXT NOT NULL,
        page_count INTEGER DEFAULT 0,
        company_name TEXT DEFAULT '',
        document_type TEXT DEFAULT '',
        reporting_period TEXT DEFAULT '',
        status TEXT DEFAULT 'unprocessed',
        chunk_count INTEGER DEFAULT 0,
        error_message TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Chunks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chunks (
        chunk_id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        page_number INTEGER NOT NULL,
        start_page INTEGER NOT NULL,
        end_page INTEGER NOT NULL,
        section_title TEXT DEFAULT '',
        section_path TEXT DEFAULT '',
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        metadata_json TEXT DEFAULT '{}',
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    )
    """)
    
    # Conversations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        citations_json TEXT DEFAULT '[]',
        diagnostics_json TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    )
    """)
    
    # Evaluation candidate examples
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluation_candidates (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        reference_answer TEXT NOT NULL,
        source_document TEXT NOT NULL,
        source_pages TEXT NOT NULL,
        supporting_text TEXT NOT NULL,
        question_type TEXT DEFAULT 'factual_lookup',
        status TEXT DEFAULT 'pending_review',
        reviewer_notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Evaluation runs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluation_runs (
        id TEXT PRIMARY KEY,
        run_name TEXT NOT NULL,
        example_count INTEGER DEFAULT 0,
        metrics_json TEXT DEFAULT '{}',
        status TEXT DEFAULT 'completed',
        error_message TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Evaluation run items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluation_run_items (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        candidate_id TEXT,
        question TEXT NOT NULL,
        reference_answer TEXT NOT NULL,
        generated_answer TEXT NOT NULL,
        retrieved_contexts_json TEXT DEFAULT '[]',
        scores_json TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES evaluation_runs (id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()
