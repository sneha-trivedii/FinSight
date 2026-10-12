import hashlib
import json
import logging
import random
from typing import Any
import google.generativeai as genai
from backend.app.core.config import settings
from backend.app.db.repository import ChunkRepository, EvaluationRepository

logger = logging.getLogger(__name__)

DATASET_GEN_PROMPT = """You are an expert financial QA dataset engineer. Your task is to generate high-quality, precise question-answer pairs strictly grounded in the provided financial document passage.

Passage Information:
Document: {doc_name}
Company: {company}
Page: {page}
Section: {section}

Passage Content:
{content}

Generate {num_examples} distinct question-answer pairs based ONLY on facts stated in this passage.
Question types to focus on:
- 'factual_lookup': Specific financial facts, definitions, or statements.
- 'dates_and_numbers': Exact figures, revenues, margins, growth rates, dates, or percentages.
- 'credit_rating': Ratings assigned (e.g., AAA, AA+), outlooks (Stable, Positive), rating agencies (CRISIL, CARE, ICRA).
- 'board_decision': Resolutions, dividend recommendations, fund-raising, appointment of directors.
- 'summary': Core takeaway or summary of the disclosure.

Return the result as a VALID JSON array of objects with the exact schema:
[
  {{
    "question": "Clear and specific question mentioning the company or context",
    "reference_answer": "Complete, accurate answer grounded directly in the text",
    "question_type": "factual_lookup" | "dates_and_numbers" | "credit_rating" | "board_decision" | "summary",
    "supporting_text": "Exact sentence or excerpt from the passage supporting the answer"
  }}
]
Do NOT include markdown formatting or backticks around the JSON. Return only the raw JSON array.
"""

class EvaluationDatasetGenerator:
    def __init__(self):
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel(model_name=settings.GEMINI_MODEL)

    def generate_candidate_pairs(
        self,
        count: int = 5,
        target_doc_id: str = None
    ) -> list[dict[str, Any]]:
        # Fetch chunks
        if target_doc_id:
            chunks = ChunkRepository.get_by_document(target_doc_id)
        else:
            chunks = ChunkRepository.get_all()

        if not chunks:
            logger.warning("No chunks available to generate evaluation pairs from.")
            return []

        # Select diverse chunks (prioritize chunks with financial content, tables, or boards)
        selected_chunks = []
        for c in chunks:
            text = c.get("content", "")
            if len(text) > 150:
                selected_chunks.append(c)

        if not selected_chunks:
            selected_chunks = chunks

        # Shuffle to get variety
        random.shuffle(selected_chunks)
        sample_chunks = selected_chunks[: min(len(selected_chunks), max(3, count))]

        generated_candidates: list[dict[str, Any]] = []

        for chunk in sample_chunks:
            if len(generated_candidates) >= count:
                break

            needed = min(2, count - len(generated_candidates))
            prompt = DATASET_GEN_PROMPT.format(
                doc_name=chunk.get("document_name", ""),
                company=chunk.get("company_name", ""),
                page=chunk.get("page_number", 1),
                section=chunk.get("section_title", "General"),
                content=chunk.get("content", "")[:2000],
                num_examples=needed
            )

            try:
                response = self.model.generate_content(prompt)
                raw_text = response.text.strip()
                # Clean markdown json fences if any
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                raw_text = raw_text.strip()

                items = json.loads(raw_text)
                if isinstance(items, list):
                    for item in items:
                        q = item.get("question", "").strip()
                        ans = item.get("reference_answer", "").strip()
                        if not q or not ans:
                            continue
                        
                        cand_id = "eval_" + hashlib.sha256(f"{q}_{chunk['chunk_id']}".encode()).hexdigest()[:12]
                        candidate = {
                            "id": cand_id,
                            "question": q,
                            "reference_answer": ans,
                            "source_document": chunk.get("document_name", ""),
                            "source_pages": str(chunk.get("page_number", 1)),
                            "supporting_text": item.get("supporting_text", chunk.get("content", "")[:300]),
                            "question_type": item.get("question_type", "factual_lookup"),
                            "status": "pending_review",
                            "reviewer_notes": ""
                        }
                        generated_candidates.append(candidate)
                        if len(generated_candidates) >= count:
                            break
            except Exception as e:
                logger.error(f"Error generating QA pair from chunk {chunk['chunk_id']}: {e}")

        # Save to database
        if generated_candidates:
            EvaluationRepository.save_candidates(generated_candidates)
            logger.info(f"Saved {len(generated_candidates)} candidate evaluation examples.")

        return generated_candidates
