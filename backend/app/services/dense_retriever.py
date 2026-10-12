import json
import logging
from pathlib import Path
from typing import Optional
import faiss
import numpy as np
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class DenseRetriever:
    def __init__(self, dimension: int = 3072):
        self.dimension = dimension
        self.index_file = settings.INDEX_DIR / "faiss.index"
        self.mapping_file = settings.INDEX_DIR / "faiss_chunk_ids.json"
        self.chunk_ids: list[str] = []
        self.index: Optional[faiss.IndexFlatIP] = None
        self.load()

    def load(self):
        if self.index_file.exists() and self.mapping_file.exists():
            try:
                self.index = faiss.read_index(str(self.index_file))
                with open(self.mapping_file, "r", encoding="utf-8") as f:
                    self.chunk_ids = json.load(f)
                logger.info(f"Loaded FAISS index with {self.index.ntotal} vectors.")
            except Exception as e:
                logger.error(f"Error loading FAISS index: {e}")
                self.index = faiss.IndexFlatIP(self.dimension)
                self.chunk_ids = []
        else:
            self.index = faiss.IndexFlatIP(self.dimension)
            self.chunk_ids = []

    def save(self):
        try:
            if self.index is not None:
                faiss.write_index(self.index, str(self.index_file))
                with open(self.mapping_file, "w", encoding="utf-8") as f:
                    json.dump(self.chunk_ids, f)
                logger.info("Saved FAISS index and chunk mappings successfully.")
        except Exception as e:
            logger.error(f"Failed to save FAISS index: {e}")

    def add_embeddings(self, new_chunk_ids: list[str], embeddings: list[np.ndarray]):
        if not new_chunk_ids or not embeddings:
            return
        
        # Check for duplicates or existing chunk ids
        existing_set = set(self.chunk_ids)
        filtered_ids = []
        filtered_embs = []
        for cid, emb in zip(new_chunk_ids, embeddings):
            if cid not in existing_set:
                filtered_ids.append(cid)
                filtered_embs.append(emb)

        if not filtered_ids:
            return

        matrix = np.vstack(filtered_embs).astype(np.float32)
        if self.index is None:
            self.index = faiss.IndexFlatIP(self.dimension)
        
        self.index.add(matrix)
        self.chunk_ids.extend(filtered_ids)
        self.save()

    def search(self, query_embedding: np.ndarray, top_k: int = 10) -> list[tuple[str, float]]:
        if self.index is None or self.index.ntotal == 0 or not self.chunk_ids:
            return []
        
        k = min(top_k, self.index.ntotal)
        query_vec = np.expand_dims(query_embedding.astype(np.float32), axis=0)
        distances, indices = self.index.search(query_vec, k)
        
        results: list[tuple[str, float]] = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1 and idx < len(self.chunk_ids):
                results.append((self.chunk_ids[idx], float(dist)))
                
        return results

    def reset(self):
        self.index = faiss.IndexFlatIP(self.dimension)
        self.chunk_ids = []
        if self.index_file.exists():
            self.index_file.unlink()
        if self.mapping_file.exists():
            self.mapping_file.unlink()
