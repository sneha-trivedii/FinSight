from typing import Any, Optional
from pydantic import BaseModel, Field

class CandidateExampleResponse(BaseModel):
    id: str
    question: str
    reference_answer: str
    source_document: str
    source_pages: str
    supporting_text: str
    question_type: str
    status: str
    reviewer_notes: Optional[str] = ""
    created_at: str

class GenerateDatasetRequest(BaseModel):
    count: int = Field(default=5, ge=1, le=20)
    target_doc_id: Optional[str] = None

class UpdateCandidateRequest(BaseModel):
    question: Optional[str] = None
    reference_answer: Optional[str] = None
    status: Optional[str] = None
    reviewer_notes: Optional[str] = None
    question_type: Optional[str] = None

class BatchApproveRequest(BaseModel):
    example_ids: list[str]

class RunEvaluationRequest(BaseModel):
    candidate_ids: Optional[list[str]] = None
    run_name: str = "FinSight RAGAS Evaluation"
