import hashlib
import re
from pathlib import Path
from typing import Any, Optional
import pymupdf
from pydantic import BaseModel, Field

class ParsedTable(BaseModel):
    headers: list[str] = Field(default_factory=list)
    rows: list[list[str]] = Field(default_factory=list)
    markdown: str = ""
    bbox: Optional[list[float]] = None

class ParsedSection(BaseModel):
    title: str = "General"
    level: int = 1
    content: str = ""
    tables: list[ParsedTable] = Field(default_factory=list)
    page_number: int = 1

class ParsedPage(BaseModel):
    page_number: int
    width: float
    height: float
    sections: list[ParsedSection] = Field(default_factory=list)
    raw_text: str = ""
    tables: list[ParsedTable] = Field(default_factory=list)
    diagnostics: dict[str, Any] = Field(default_factory=dict)

class ParsedDocument(BaseModel):
    filename: str
    filepath: str
    file_hash: str
    file_size: int
    page_count: int
    company_name: str = ""
    document_type: str = ""
    reporting_period: str = ""
    pages: list[ParsedPage] = Field(default_factory=list)
    diagnostics: dict[str, Any] = Field(default_factory=dict)

class PDFParser:
    @staticmethod
    def calculate_file_hash(filepath: Path) -> str:
        hasher = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    @staticmethod
    def infer_metadata_from_name(filename: str, first_pages_text: str) -> tuple[str, str, str]:
        fn = filename.lower()
        text = first_pages_text.lower()
        
        # Company Inference
        company = "Unknown Entity"
        if "angel" in fn or "angel one" in text:
            company = "Angel One Limited"
        elif "apollo" in fn or "apollo hospital" in text:
            company = "Apollo Hospitals Enterprise Limited"
        elif "hdfc" in fn or "hdfc bank" in text:
            company = "HDFC Bank Limited"
        elif "mastercircular" in fn or "masterdirections" in fn or "reserve bank of india" in text:
            company = "Reserve Bank of India (RBI)"
            
        # Document Type Inference
        doc_type = "Financial Disclosure"
        if "investorpresentation" in fn or "investor presentation" in text:
            doc_type = "Investor Presentation"
        elif "annualreport" in fn or "annual report" in text:
            doc_type = "Annual Report"
        elif "outcomeofboardmeeting" in fn or "board meeting" in text or "outcome of the board" in text:
            doc_type = "Board Meeting Outcome"
        elif "press_release" in fn or "press release" in text:
            doc_type = "Press Release"
        elif "creditrating" in fn or "credit rating" in text or "crisil" in text or "care" in text:
            doc_type = "Credit Rating Report"
        elif "shareholder" in fn or "shareholders meeting" in text or "postal ballot" in text:
            doc_type = "Shareholder Meeting Notice"
        elif "mastercircular" in fn or "master circular" in text:
            doc_type = "RBI Master Circular"
        elif "masterdirections" in fn or "master directions" in text:
            doc_type = "RBI Master Directions"

        # Reporting Period Inference
        period = ""
        period_match = re.search(r'(202\d[-–]\d{2,4}|202\d|q[1-4]\s*(?:fy)?\s*202\d|fy\s*202\d|apr(?:il)?\s*202\d)', (fn + " " + text[:2000]).lower())
        if period_match:
            period = period_match.group(1).upper()
            
        return company, doc_type, period

    @classmethod
    def parse_pdf(cls, filepath: Path) -> ParsedDocument:
        file_hash = cls.calculate_file_hash(filepath)
        file_size = filepath.stat().st_size
        doc = pymupdf.open(str(filepath))
        page_count = len(doc)

        all_pages: list[ParsedPage] = []
        full_text_sample = ""
        
        # Determine average font size across document
        font_sizes: list[float] = []
        for pno in range(min(5, page_count)):
            p = doc[pno]
            blocks = p.get_text("dict").get("blocks", [])
            for b in blocks:
                if b.get("type") == 0:
                    for line in b.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "").strip()
                            if text:
                                font_sizes.append(span.get("size", 10.0))
        avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 10.0

        for pno in range(page_count):
            page = doc[pno]
            page_num = pno + 1
            rect = page.rect
            width, height = rect.width, rect.height

            # 1. Detect Tables using PyMuPDF TableFinder
            page_tables: list[ParsedTable] = []
            try:
                found_tables = list(page.find_tables())
                for t in found_tables:
                    extracted = t.extract()
                    if extracted and len(extracted) > 1:
                        # First non-empty row as header
                        header_row = [str(cell).strip() if cell is not None else "" for cell in extracted[0]]
                        data_rows = [
                            [str(cell).strip() if cell is not None else "" for cell in r]
                            for r in extracted[1:]
                        ]
                        # Build clean markdown
                        md_lines = []
                        md_lines.append("| " + " | ".join(header_row) + " |")
                        md_lines.append("| " + " | ".join(["---"] * len(header_row)) + " |")
                        for row in data_rows:
                            md_lines.append("| " + " | ".join(row) + " |")
                        table_md = "\n".join(md_lines)
                        page_tables.append(ParsedTable(
                            headers=header_row,
                            rows=data_rows,
                            markdown=table_md,
                            bbox=list(t.bbox) if hasattr(t, "bbox") else None
                        ))
            except Exception:
                pass

            # 2. Extract Text Blocks & Spans
            blocks = page.get_text("dict").get("blocks", [])
            current_sections: list[ParsedSection] = []
            current_section_title = f"Page {page_num} Overview" if pno == 0 else "Content"
            current_section_level = 1
            current_paragraphs: list[str] = []

            for b in blocks:
                if b.get("type") == 0:  # Text block
                    block_lines = b.get("lines", [])
                    block_text_lines = []
                    is_candidate_heading = False
                    heading_text = ""
                    heading_level = 2

                    for line in block_lines:
                        line_spans = line.get("spans", [])
                        line_str = "".join([s.get("text", "") for s in line_spans]).strip()
                        if not line_str:
                            continue
                        
                        # Check heading heuristics on line
                        first_span = line_spans[0]
                        span_size = first_span.get("size", 10.0)
                        span_flags = first_span.get("flags", 0)
                        is_bold = bool(span_flags & (2 | 16)) or ("bold" in first_span.get("font", "").lower())
                        
                        # Heading rule: noticeably larger font OR bold and short with title/upper casing
                        if (span_size >= avg_font_size * 1.25) or (is_bold and span_size >= avg_font_size and len(line_str) < 90):
                            if not line_str.endswith(".") and not line_str.endswith(","):
                                is_candidate_heading = True
                                heading_text = line_str
                                heading_level = 1 if span_size >= avg_font_size * 1.4 else 2
                                break
                        
                        block_text_lines.append(line_str)

                    if is_candidate_heading and heading_text:
                        # Flush previous section
                        if current_paragraphs:
                            content_str = "\n\n".join(current_paragraphs).strip()
                            if content_str:
                                current_sections.append(ParsedSection(
                                    title=current_section_title,
                                    level=current_section_level,
                                    content=content_str,
                                    page_number=page_num
                                ))
                            current_paragraphs = []
                        current_section_title = heading_text
                        current_section_level = heading_level
                    else:
                        paragraph = " ".join(block_text_lines).strip()
                        # Avoid standalone header/footer page numbers like "Page 1 of 5"
                        if paragraph and not re.match(r'^(page\s+\d+(\s+of\s+\d+)?|\d+)$', paragraph, re.IGNORECASE):
                            current_paragraphs.append(paragraph)

            # Flush final section on page
            if current_paragraphs:
                content_str = "\n\n".join(current_paragraphs).strip()
                if content_str:
                    current_sections.append(ParsedSection(
                        title=current_section_title,
                        level=current_section_level,
                        content=content_str,
                        page_number=page_num
                    ))

            # If no sections reconstructed, fallback to page.get_text()
            raw_text = page.get_text().strip()
            if not current_sections and raw_text:
                current_sections.append(ParsedSection(
                    title=f"Page {page_num}",
                    level=1,
                    content=raw_text,
                    page_number=page_num
                ))

            # Attach tables to the most relevant section or page
            if page_tables:
                if current_sections:
                    current_sections[-1].tables.extend(page_tables)
                    # Append markdown representation to section content for indexing
                    table_content = "\n\n".join([t.markdown for t in page_tables])
                    current_sections[-1].content += f"\n\n[Financial Table]:\n{table_content}"

            if pno < 3:
                full_text_sample += " " + raw_text

            parsed_page = ParsedPage(
                page_number=page_num,
                width=width,
                height=height,
                sections=current_sections,
                raw_text=raw_text,
                tables=page_tables,
                diagnostics={
                    "char_count": len(raw_text),
                    "word_count": len(raw_text.split()),
                    "section_count": len(current_sections),
                    "table_count": len(page_tables)
                }
            )
            all_pages.append(parsed_page)

        company, doc_type, period = cls.infer_metadata_from_name(filepath.name, full_text_sample)
        
        parsed_doc = ParsedDocument(
            filename=filepath.name,
            filepath=str(filepath),
            file_hash=file_hash,
            file_size=file_size,
            page_count=page_count,
            company_name=company,
            document_type=doc_type,
            reporting_period=period,
            pages=all_pages,
            diagnostics={
                "total_pages": page_count,
                "total_sections": sum(len(p.sections) for p in all_pages),
                "total_tables": sum(len(p.tables) for p in all_pages)
            }
        )
        return parsed_doc
