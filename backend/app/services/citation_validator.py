import re
from typing import Any

class CitationValidator:
    @staticmethod
    def validate_citations(
        answer_text: str,
        retrieved_chunks: list[dict[str, Any]]
    ) -> tuple[str, list[dict[str, Any]], dict[str, Any]]:
        """
        Extracts [1], [2], etc. from answer_text.
        Validates against the retrieved_chunks (1-indexed based on chunks order).
        Returns:
            - cleaned answer_text
            - list of valid sources corresponding to citations
            - diagnostic information
        """
        # Find all citation patterns like [1], [2], [1, 2], [1],[2]
        raw_citations = re.findall(r'\[(\d+)\]', answer_text)
        cited_indices = sorted(list(set(int(c) for c in raw_citations)))

        valid_sources: list[dict[str, Any]] = []
        invalid_citations: list[int] = []

        chunk_count = len(retrieved_chunks)

        for cite_idx in cited_indices:
            # 1-indexed to 0-indexed
            array_idx = cite_idx - 1
            if 0 <= array_idx < chunk_count:
                chunk = retrieved_chunks[array_idx]
                source_entry = {
                    "citation_id": cite_idx,
                    "document_id": chunk.get("document_id", ""),
                    "document_name": chunk.get("document_name", ""),
                    "company_name": chunk.get("company_name", ""),
                    "document_type": chunk.get("document_type", ""),
                    "page_number": chunk.get("page_number", 1),
                    "section_title": chunk.get("section_title", ""),
                    "section_path": chunk.get("section_path", ""),
                    "chunk_id": chunk.get("chunk_id", ""),
                    "excerpt": chunk.get("content", "")[:350] + "..." if len(chunk.get("content", "")) > 350 else chunk.get("content", ""),
                    "rrf_score": chunk.get("rrf_score", 0.0),
                    "dense_rank": chunk.get("dense_rank"),
                    "bm25_rank": chunk.get("bm25_rank")
                }
                valid_sources.append(source_entry)
            else:
                invalid_citations.append(cite_idx)

        # If answer has no citations, but we retrieved chunks, we can optionally provide top retrieved chunks as reference sources
        if not valid_sources and retrieved_chunks:
            for i, chunk in enumerate(retrieved_chunks[:2], start=1):
                valid_sources.append({
                    "citation_id": i,
                    "document_id": chunk.get("document_id", ""),
                    "document_name": chunk.get("document_name", ""),
                    "company_name": chunk.get("company_name", ""),
                    "document_type": chunk.get("document_type", ""),
                    "page_number": chunk.get("page_number", 1),
                    "section_title": chunk.get("section_title", ""),
                    "section_path": chunk.get("section_path", ""),
                    "chunk_id": chunk.get("chunk_id", ""),
                    "excerpt": chunk.get("content", "")[:350] + "...",
                    "rrf_score": chunk.get("rrf_score", 0.0),
                    "dense_rank": chunk.get("dense_rank"),
                    "bm25_rank": chunk.get("bm25_rank")
                })

        diagnostics = {
            "total_cited": len(cited_indices),
            "valid_citations_count": len(valid_sources),
            "invalid_citations": invalid_citations,
            "is_valid": len(invalid_citations) == 0
        }

        return answer_text, valid_sources, diagnostics
