import io
import csv
from typing import Optional
from fastapi import APIRouter, HTTPException, Response
from backend.app.db.repository import EvaluationRepository
from backend.app.schemas.evaluation import (
    CandidateExampleResponse,
    GenerateDatasetRequest,
    UpdateCandidateRequest,
    BatchApproveRequest,
    RunEvaluationRequest
)
from backend.app.services.dataset_generator import EvaluationDatasetGenerator
from backend.app.services.evaluation_service import EvaluationService
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.dense_retriever import DenseRetriever
from backend.app.services.bm25_retriever import BM25Retriever
from backend.app.services.hybrid_retriever import HybridRetriever
from backend.app.services.answer_service import AnswerService

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])

def get_evaluation_service() -> EvaluationService:
    emb = EmbeddingService()
    dense = DenseRetriever(dimension=emb.dimension)
    bm25 = BM25Retriever()
    hybrid = HybridRetriever(emb, dense, bm25)
    ans = AnswerService()
    return EvaluationService(hybrid, ans)

@router.post("/datasets/generate")
def generate_dataset(req: GenerateDatasetRequest):
    gen = EvaluationDatasetGenerator()
    results = gen.generate_candidate_pairs(count=req.count, target_doc_id=req.target_doc_id)
    return {
        "message": f"Generated {len(results)} candidate QA evaluation pairs",
        "candidates": results
    }

@router.get("/datasets", response_model=list[CandidateExampleResponse])
def get_dataset(status: Optional[str] = None, doc_name: Optional[str] = None):
    return EvaluationRepository.get_candidates(status=status, doc_name=doc_name)

@router.patch("/datasets/{example_id}", response_model=CandidateExampleResponse)
def update_candidate(example_id: str, req: UpdateCandidateRequest):
    updates = req.model_dump(exclude_unset=True)
    updated = EvaluationRepository.update_candidate(example_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return updated

@router.post("/datasets/{example_id}/approve", response_model=CandidateExampleResponse)
def approve_candidate(example_id: str):
    updated = EvaluationRepository.update_candidate(example_id, {"status": "approved"})
    if not updated:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return updated

@router.post("/datasets/{example_id}/reject", response_model=CandidateExampleResponse)
def reject_candidate(example_id: str):
    updated = EvaluationRepository.update_candidate(example_id, {"status": "rejected"})
    if not updated:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return updated

@router.post("/datasets/approve-batch")
def batch_approve(req: BatchApproveRequest):
    EvaluationRepository.batch_update_status(req.example_ids, "approved")
    return {"message": f"Successfully approved {len(req.example_ids)} examples"}

@router.post("/runs")
def run_evaluation(req: RunEvaluationRequest):
    svc = get_evaluation_service()
    try:
        res = svc.run_evaluation(candidate_ids=req.candidate_ids, run_name=req.run_name)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation execution failed: {e}")

@router.get("/runs")
def list_runs():
    return EvaluationRepository.get_all_runs()

@router.get("/runs/{run_id}")
def get_run(run_id: str):
    run_data = EvaluationRepository.get_run_details(run_id)
    if not run_data:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    return run_data

@router.get("/runs/{run_id}/export")
def export_run(run_id: str, format: str = "json"):
    run_data = EvaluationRepository.get_run_details(run_id)
    if not run_data:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    
    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "item_id", "question", "reference_answer", "generated_answer",
            "faithfulness", "answer_relevancy", "context_precision", "context_recall"
        ])
        for it in run_data.get("items", []):
            scores = it.get("scores", {})
            writer.writerow([
                it.get("id"),
                it.get("question"),
                it.get("reference_answer"),
                it.get("generated_answer"),
                scores.get("faithfulness", ""),
                scores.get("answer_relevancy", ""),
                scores.get("context_precision", ""),
                scores.get("context_recall", "")
            ])
        csv_bytes = output.getvalue().encode("utf-8")
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=evaluation_{run_id}.csv"}
        )
    else:
        return run_data
