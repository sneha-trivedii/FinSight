from typing import Any, Optional
from pydantic import BaseModel, Field

class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_path: str
    file_size: int
    file_hash: str
    page_count: int
    company_name: str
    document_type: str
    reporting_period: str
    status: str
    chunk_count: int
    error_message: Optional[str] = ""
    created_at: str

class ChunkResponse(BaseModel):
    chunk_id: str
    document_id: str
    chunk_index: int
    page_number: int
    start_page: int
    end_page: int
    section_title: str
    section_path: str
    content: str
    content_hash: str
    metadata: dict[str, Any] = Field(default_factory=dict)
