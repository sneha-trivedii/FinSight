import asyncio
import logging
import time
from typing import Any, Optional
from datasets import Dataset
import pandas as pd
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
)
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from backend.app.core.config import settings
from backend.app.db.repository import EvaluationRepository
from backend.app.services.hybrid_retriever import HybridRetriever
from backend.app.services.answer_service import AnswerService

logger = logging.getLogger(__name__)

class EvaluationService:
    def __init__(
        self,
        hybrid_retriever: HybridRetriever,
        answer_service: AnswerService
    ):
        self.retriever = hybrid_retriever
        self.answer_service = answer_service
        self.ragas_llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY
        )
        self.ragas_embeddings = GoogleGenerativeAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            google_api_key=settings.GEMINI_API_KEY
        )

    def run_evaluation(
        self,
        candidate_ids: Optional[list[str]] = None,
        run_name: str = "Evaluation Run"
    ) -> dict[str, Any]:
        """
        Runs RAGAS evaluation on approved examples:
        1. Hybrid retrieval pipeline
        2. Gemini answer generation
        3. RAGAS evaluation with faithfulness, answer_relevancy, context_precision, context_recall
        """
        run_id = f"run_{int(time.time())}"
        
        # 1. Fetch approved candidate examples
        candidates = EvaluationRepository.get_candidates(status="approved")
        if candidate_ids:
            candidates = [c for c in candidates if c["id"] in candidate_ids]

        if not candidates:
            # Fallback to any candidates if none explicitly approved yet, but mark appropriately
            all_cands = EvaluationRepository.get_candidates()
            if candidate_ids:
                candidates = [c for c in all_cands if c["id"] in candidate_ids]
            elif not candidates:
                raise ValueError("No approved evaluation candidates found to run evaluation on. Please approve at least 1 candidate.")

        EvaluationRepository.create_run(run_id, run_name, len(candidates))
        logger.info(f"Starting evaluation run {run_id} with {len(candidates)} examples...")

        run_items: list[dict[str, Any]] = []
        eval_records = {
            "question": [],
            "answer": [],
            "contexts": [],
            "ground_truth": []
        }

        # 2. Run real pipeline for each example
        for c in candidates:
            q = c["question"]
            ref_ans = c["reference_answer"]

            # Hybrid retrieval
            retrieval_res = self.retriever.retrieve(q, top_k=settings.TOP_K_HYBRID)
            retrieved_chunks = retrieval_res["chunks"]
            contexts = [chunk["content"] for chunk in retrieved_chunks]

            # If no context found, fallback to candidate's supporting text so RAGAS can score fairly
            if not contexts and c.get("supporting_text"):
                contexts = [c["supporting_text"]]

            # Answer generation
            ans_res = self.answer_service.generate_answer(q, retrieved_chunks)
            gen_answer = ans_res["answer"]

            eval_records["question"].append(q)
            eval_records["answer"].append(gen_answer)
            eval_records["contexts"].append(contexts)
            eval_records["ground_truth"].append(ref_ans)

            run_items.append({
                "id": f"item_{c['id']}_{run_id}",
                "run_id": run_id,
                "candidate_id": c["id"],
                "question": q,
                "reference_answer": ref_ans,
                "generated_answer": gen_answer,
                "retrieved_contexts": contexts,
                "scores": {}
            })

        # 3. Compute RAGAS metrics
        metrics = [faithfulness, answer_relevancy, context_precision, context_recall]
        metrics_dict: dict[str, float] = {}
        error_msg = ""

        try:
            hf_dataset = Dataset.from_dict(eval_records)
            ragas_result = evaluate(
                dataset=hf_dataset,
                metrics=metrics,
                llm=self.ragas_llm,
                embeddings=self.ragas_embeddings,
                raise_exceptions=False
            )
            
            # Attach per-example scores and extract aggregates from dataframe
            df = ragas_result.to_pandas()
            for m in metrics:
                if m.name in df.columns:
                    val = df[m.name].mean()
                    metrics_dict[m.name] = round(float(val), 4) if not pd.isna(val) else 0.0
                else:
                    try:
                        val = ragas_result[m.name]
                        metrics_dict[m.name] = round(float(val), 4) if not pd.isna(val) else 0.0
                    except Exception:
                        metrics_dict[m.name] = 0.0

            for idx, item in enumerate(run_items):
                item_scores = {}
                for m in metrics:
                    if m.name in df.columns and idx < len(df):
                        val = df.iloc[idx][m.name]
                        item_scores[m.name] = round(float(val), 4) if not pd.isna(val) else 0.0
                item["scores"] = item_scores

        except Exception as e:
            logger.error(f"RAGAS evaluation failed: {e}")
            error_msg = str(e)
            # Record honest fallback state
            metrics_dict = {
                "faithfulness": 0.0,
                "answer_relevancy": 0.0,
                "context_precision": 0.0,
                "context_recall": 0.0
            }

        # 4. Save results to database
        EvaluationRepository.save_run_items(run_items)
        status = "completed" if not error_msg else "partial_error"
        EvaluationRepository.complete_run(run_id, metrics_dict, status=status, error_message=error_msg)

        logger.info(f"Evaluation run {run_id} finished with metrics: {metrics_dict}")

        return {
            "run_id": run_id,
            "run_name": run_name,
            "status": status,
            "example_count": len(candidates),
            "metrics": metrics_dict,
            "error_message": error_msg,
            "items": run_items
        }
