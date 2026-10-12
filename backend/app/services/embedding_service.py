import time
import logging
from typing import Optional
import google.generativeai as genai
import numpy as np
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self):
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model_name = settings.EMBEDDING_MODEL
        self.dimension = 3072

    def get_query_embedding(self, query: str) -> np.ndarray:
        try:
            res = genai.embed_content(
                model=self.model_name,
                content=query,
                task_type="retrieval_query"
            )
            emb = np.array(res["embedding"], dtype=np.float32)
            # Normalize for cosine similarity
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm
            return emb
        except Exception as e:
            logger.error(f"Error generating query embedding: {e}")
            raise e

    def get_document_embeddings_batch(self, texts: list[str], batch_size: int = 20) -> list[np.ndarray]:
        all_embeddings: list[np.ndarray] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            retries = 5
            success = False
            last_err = None

            while retries > 0 and not success:
                try:
                    res = genai.embed_content(
                        model=self.model_name,
                        content=batch,
                        task_type="retrieval_document"
                    )
                    raw_embs = res.get("embedding", [])
                    for emb_list in raw_embs:
                        arr = np.array(emb_list, dtype=np.float32)
                        norm = np.linalg.norm(arr)
                        if norm > 0:
                            arr = arr / norm
                        all_embeddings.append(arr)
                    success = True
                    time.sleep(1.0)  # Safe rate pacing between batches
                except Exception as e:
                    last_err = e
                    retries -= 1
                    err_str = str(e).lower()
                    if "429" in err_str or "quota" in err_str:
                        logger.warning(
                            f"Gemini API rate limit encountered on batch ({len(batch)} texts). "
                            f"Waiting 60s for quota window to reset ({retries} retries left)..."
                        )
                        time.sleep(60.0)
                    else:
                        time.sleep(2.0)

            if not success:
                logger.error(f"Failed to embed batch of size {len(batch)}: {last_err}")
                raise RuntimeError(f"Embedding failed: {last_err}")

        return all_embeddings
