from typing import Any, Optional
from pydantic import BaseModel, Field

class DashboardSummary(BaseModel):
    discovered_documents_count: int
    processed_documents_count: int
    failed_documents_count: int
    total_chunks_count: int
    questions_asked_count: int
    recent_documents: list[dict[str, Any]] = Field(default_factory=list)
    latest_evaluation_run: Optional[dict[str, Any]] = None
    system_health: dict[str, Any] = Field(default_factory=dict)
