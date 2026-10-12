from typing import Any, Optional
from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Financial research query")
    conversation_id: Optional[str] = Field(None, description="Existing conversation ID if any")
    doc_filter: Optional[str] = Field(None, description="Optional document filter")

class SourceCitation(BaseModel):
    citation_id: int
    document_id: str
    document_name: str
    company_name: str
    document_type: str
    page_number: int
    section_title: str
    section_path: Optional[str] = ""
    chunk_id: str
    excerpt: str
    rrf_score: Optional[float] = None
    dense_rank: Optional[int] = None
    bm25_rank: Optional[int] = None

class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    sources: list[SourceCitation] = Field(default_factory=list)
    diagnostics: dict[str, Any] = Field(default_factory=dict)
