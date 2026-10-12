import time
import logging
from typing import Any
from backend.app.core.config import settings
from backend.app.db.repository import ChunkRepository
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.dense_retriever import DenseRetriever
from backend.app.services.bm25_retriever import BM25Retriever

logger = logging.getLogger(__name__)

class HybridRetriever:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        dense_retriever: DenseRetriever,
        bm25_retriever: BM25Retriever
    ):
        self.embedding_service = embedding_service
        self.dense_retriever = dense_retriever
        self.bm25_retriever = bm25_retriever
        self.k_rrf = settings.RRF_K
        self.w_dense = settings.DENSE_WEIGHT
        self.w_bm25 = settings.BM25_WEIGHT

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        doc_filter: str = None
    ) -> dict[str, Any]:
        start_time = time.time()
        
        # 1. Dense retrieval
        dense_results: list[tuple[str, float]] = []
        try:
            query_emb = self.embedding_service.get_query_embedding(query)
            dense_results = self.dense_retriever.search(query_emb, top_k=settings.TOP_K_DENSE)
        except Exception as e:
            logger.warning(f"Dense search encountered error: {e}")

        # 2. BM25 retrieval
        bm25_results: list[tuple[str, float]] = []
        try:
            bm25_results = self.bm25_retriever.search(query, top_k=settings.TOP_K_BM25)
        except Exception as e:
            logger.warning(f"BM25 search encountered error: {e}")

        # 3. Reciprocal Rank Fusion (RRF)
        # RRF_score = (w_dense / (k + rank_dense)) + (w_bm25 / (k + rank_bm25))
        rrf_scores: dict[str, float] = {}
        dense_ranks: dict[str, int] = {}
        bm25_ranks: dict[str, int] = {}
        dense_raw_scores: dict[str, float] = {}
        bm25_raw_scores: dict[str, float] = {}

        for rank, (cid, score) in enumerate(dense_results, start=1):
            dense_ranks[cid] = rank
            dense_raw_scores[cid] = score
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (self.w_dense / (self.k_rrf + rank))

        for rank, (cid, score) in enumerate(bm25_results, start=1):
            bm25_ranks[cid] = rank
            bm25_raw_scores[cid] = score
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (self.w_bm25 / (self.k_rrf + rank))

        # Sort chunk IDs by fused RRF score descending
        sorted_chunk_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)

        # 4. Fetch full chunk data from repository
        candidate_chunks = ChunkRepository.get_by_ids(sorted_chunk_ids)
        chunk_map = {c["chunk_id"]: c for c in candidate_chunks}

        fused_chunks: list[dict[str, Any]] = []
        for cid in sorted_chunk_ids:
            chunk = chunk_map.get(cid)
            if not chunk:
                continue

            # Optional document filter
            if doc_filter and chunk["document_id"] != doc_filter and chunk["document_name"] != doc_filter:
                continue

            chunk_info = {
                **chunk,
                "rrf_score": round(rrf_scores[cid], 5),
                "dense_rank": dense_ranks.get(cid),
                "dense_score": round(dense_raw_scores.get(cid, 0.0), 4) if cid in dense_raw_scores else None,
                "bm25_rank": bm25_ranks.get(cid),
                "bm25_score": round(bm25_raw_scores.get(cid, 0.0), 4) if cid in bm25_raw_scores else None,
            }
            fused_chunks.append(chunk_info)

        selected_chunks = fused_chunks[:top_k]
        latency_ms = round((time.time() - start_time) * 1000, 2)

        diagnostics = {
            "query": query,
            "dense_count": len(dense_results),
            "bm25_count": len(bm25_results),
            "total_fused_candidates": len(fused_chunks),
            "selected_count": len(selected_chunks),
            "retrieval_latency_ms": latency_ms,
            "fusion_method": "Reciprocal Rank Fusion (RRF)",
            "rrf_k": self.k_rrf,
            "weights": {"dense": self.w_dense, "bm25": self.w_bm25}
        }

        return {
            "chunks": selected_chunks,
            "all_fused": fused_chunks[:15],
            "diagnostics": diagnostics
        }
