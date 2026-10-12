import json
import logging
import pickle
import re
from pathlib import Path
from typing import Optional
from rank_bm25 import BM25Okapi
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class BM25Retriever:
    def __init__(self):
        self.index_file = settings.INDEX_DIR / "bm25_index.pkl"
        self.data_file = settings.INDEX_DIR / "bm25_corpus.json"
        self.chunk_ids: list[str] = []
        self.corpus_tokens: list[list[str]] = []
        self.bm25: Optional[BM25Okapi] = None
        self.load()

    @staticmethod
    def tokenize(text: str) -> list[str]:
        # Preserve financial numbers, percentages, dates, acronyms, e.g. 15.4%, FY25, Q1-FY26
        # Convert to lower for search match, but keep alphanumeric sequences with decimals and %
        text = text.lower()
        tokens = re.findall(r'[a-z0-9]+(?:[\.\,\-\/][a-z0-9]+)*%?', text)
        return [t for t in tokens if len(t) > 1 or t.isdigit()]

    def load(self):
        if self.index_file.exists() and self.data_file.exists():
            try:
                with open(self.index_file, "rb") as f:
                    self.bm25 = pickle.load(f)
                with open(self.data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.chunk_ids = data["chunk_ids"]
                    self.corpus_tokens = data["corpus_tokens"]
                logger.info(f"Loaded BM25 index with {len(self.chunk_ids)} documents.")
            except Exception as e:
                logger.error(f"Error loading BM25 index: {e}")
                self.bm25 = None
                self.chunk_ids = []
                self.corpus_tokens = []
        else:
            self.bm25 = None
            self.chunk_ids = []
            self.corpus_tokens = []

    def save(self):
        try:
            if self.bm25 is not None:
                with open(self.index_file, "wb") as f:
                    pickle.dump(self.bm25, f)
                with open(self.data_file, "w", encoding="utf-8") as f:
                    json.dump({
                        "chunk_ids": self.chunk_ids,
                        "corpus_tokens": self.corpus_tokens
                    }, f)
                logger.info("Saved BM25 index successfully.")
        except Exception as e:
            logger.error(f"Failed to save BM25 index: {e}")

    def add_chunks(self, new_chunk_ids: list[str], texts: list[str]):
        if not new_chunk_ids or not texts:
            return
        
        existing_set = set(self.chunk_ids)
        filtered_ids = []
        filtered_texts = []
        for cid, txt in zip(new_chunk_ids, texts):
            if cid not in existing_set:
                filtered_ids.append(cid)
                filtered_texts.append(txt)

        if not filtered_ids:
            return

        new_tokens = [self.tokenize(t) for t in filtered_texts]
        self.chunk_ids.extend(filtered_ids)
        self.corpus_tokens.extend(new_tokens)
        
        # Rebuild BM25 with updated corpus
        if self.corpus_tokens:
            self.bm25 = BM25Okapi(self.corpus_tokens)
            self.save()

    def search(self, query: str, top_k: int = 10) -> list[tuple[str, float]]:
        if not self.bm25 or not self.chunk_ids:
            return []

        query_tokens = self.tokenize(query)
        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)
        scored_pairs = list(zip(self.chunk_ids, scores))
        # Filter out 0 scores and sort descending
        non_zero = [p for p in scored_pairs if p[1] > 0]
        non_zero.sort(key=lambda x: x[1], reverse=True)
        return [(cid, float(score)) for cid, score in non_zero[:top_k]]

    def reset(self):
        self.bm25 = None
        self.chunk_ids = []
        self.corpus_tokens = []
        if self.index_file.exists():
            self.index_file.unlink()
        if self.data_file.exists():
            self.data_file.unlink()
