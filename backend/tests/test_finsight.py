import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
import numpy as np

from backend.app.services.parser import PDFParser, ParsedDocument, ParsedPage, ParsedSection
from backend.app.services.chunker import DocumentChunker
from backend.app.services.bm25_retriever import BM25Retriever
from backend.app.services.citation_validator import CitationValidator
from backend.app.services.hybrid_retriever import HybridRetriever

class TestFinSightCore(unittest.TestCase):

    def test_metadata_inference(self):
        """Test metadata inference for company, document type, and period."""
        comp, doc_type, period = PDFParser.infer_metadata_from_name(
            "ANGELONEAnnualReport2025-26.pdf",
            "Angel One Limited Annual Report for financial year 2025-26"
        )
        self.assertEqual(comp, "Angel One Limited")
        self.assertEqual(doc_type, "Annual Report")
        self.assertIn("2025-26", period)

        comp2, doc_type2, _ = PDFParser.infer_metadata_from_name(
            "HDFCBANKCreditRating.pdf",
            "Credit rating assessment by CRISIL Ratings"
        )
        self.assertEqual(comp2, "HDFC Bank Limited")
        self.assertEqual(doc_type2, "Credit Rating Report")

    def test_chunker_structure_and_metadata(self):
        """Test that chunks preserve sections, page numbers, and required metadata."""
        chunker = DocumentChunker(target_tokens=100, overlap_tokens=20)
        
        parsed_doc = ParsedDocument(
            filename="TestDoc.pdf",
            filepath="/tmp/TestDoc.pdf",
            file_hash="abc123hash",
            file_size=1024,
            page_count=2,
            company_name="Test Fin Corp",
            document_type="Press Release",
            reporting_period="Q1 FY26",
            pages=[
                ParsedPage(
                    page_number=1,
                    width=612.0,
                    height=792.0,
                    sections=[
                        ParsedSection(
                            title="Quarterly Highlights",
                            level=1,
                            content="Revenue grew by 35% year-on-year reaching 500 crore rupees. Client base reached 10 million.",
                            page_number=1
                        )
                    ]
                )
            ]
        )

        chunks = chunker.chunk_document("doc_test_1", parsed_doc)
        self.assertGreater(len(chunks), 0)
        first_chunk = chunks[0]
        self.assertEqual(first_chunk["document_id"], "doc_test_1")
        self.assertEqual(first_chunk["document_name"], "TestDoc.pdf")
        self.assertEqual(first_chunk["page_number"], 1)
        self.assertEqual(first_chunk["section_title"], "Quarterly Highlights")
        self.assertEqual(first_chunk["company_name"], "Test Fin Corp")
        self.assertIn("content_hash", first_chunk)
        self.assertIn("35%", first_chunk["content"])

    def test_bm25_financial_tokenization(self):
        """Test that financial symbols, percentages, and amounts are preserved."""
        text = "Total revenue grew by 24.5% to Rs. 1,405.8 crore in Q1-FY26."
        tokens = BM25Retriever.tokenize(text)
        self.assertTrue(any("24.5%" in t or "24.5" in t for t in tokens))
        self.assertTrue(any("q1-fy26" in t or "fy26" in t for t in tokens))
        self.assertTrue(any("1,405.8" in t or "1405" in t for t in tokens))

    def test_citation_validator_valid_and_invalid(self):
        """Test citation extraction and validation against retrieved chunks."""
        chunks = [
            {"document_id": "doc1", "document_name": "Report1.pdf", "page_number": 4, "content": "EBITDA was 300 Cr."},
            {"document_id": "doc2", "document_name": "Report2.pdf", "page_number": 8, "content": "Net profit margin was 18%."}
        ]

        answer = "EBITDA was reported at 300 Cr [1], while profit margin was 18% [2], with extra [99]."
        cleaned_text, valid_sources, diag = CitationValidator.validate_citations(answer, chunks)

        self.assertEqual(len(valid_sources), 2)
        self.assertEqual(valid_sources[0]["citation_id"], 1)
        self.assertEqual(valid_sources[0]["document_name"], "Report1.pdf")
        self.assertEqual(valid_sources[1]["citation_id"], 2)
        self.assertEqual(valid_sources[1]["document_name"], "Report2.pdf")
        self.assertIn(99, diag["invalid_citations"])
        self.assertFalse(diag["is_valid"])  # because citation [99] does not exist

    def test_rrf_rank_fusion_math(self):
        """Test Reciprocal Rank Fusion calculation."""
        # RRF score = w_dense / (k + rank_dense) + w_bm25 / (k + rank_bm25)
        k = 60
        w_dense = 0.6
        w_bm25 = 0.4
        
        # Doc A is rank 1 in dense, rank 2 in bm25
        score_a = (w_dense / (k + 1)) + (w_bm25 / (k + 2))
        # Doc B is rank 2 in dense, rank 1 in bm25
        score_b = (w_dense / (k + 2)) + (w_bm25 / (k + 1))
        
        self.assertGreater(score_a, score_b) # since dense has weight 0.6 > 0.4

if __name__ == "__main__":
    unittest.main()
