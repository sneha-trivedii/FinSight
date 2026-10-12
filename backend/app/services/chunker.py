import hashlib
from typing import Any
import tiktoken
from backend.app.services.parser import ParsedDocument, ParsedSection

class DocumentChunker:
    def __init__(self, target_tokens: int = 600, overlap_tokens: int = 100):
        self.target_tokens = target_tokens
        self.overlap_tokens = overlap_tokens
        try:
            self.tokenizer = tiktoken.get_encoding("cl100k_base")
        except Exception:
            self.tokenizer = None

    def count_tokens(self, text: str) -> int:
        if self.tokenizer:
            return len(self.tokenizer.encode(text))
        return len(text.split())

    def split_text_with_overlap(self, text: str, max_tokens: int, overlap: int) -> list[str]:
        if self.tokenizer:
            tokens = self.tokenizer.encode(text)
            if len(tokens) <= max_tokens:
                return [text]
            chunks = []
            start = 0
            while start < len(tokens):
                end = min(start + max_tokens, len(tokens))
                chunk_tokens = tokens[start:end]
                chunks.append(self.tokenizer.decode(chunk_tokens))
                if end == len(tokens):
                    break
                start += max_tokens - overlap
            return chunks
        else:
            # Word-based fallback
            words = text.split()
            if len(words) <= max_tokens:
                return [text]
            chunks = []
            start = 0
            while start < len(words):
                end = min(start + max_tokens, len(words))
                chunks.append(" ".join(words[start:end]))
                if end == len(words):
                    break
                start += max_tokens - overlap
            return chunks

    def chunk_document(self, doc_id: str, parsed_doc: ParsedDocument) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = []
        chunk_index = 0

        for page in parsed_doc.pages:
            page_num = page.page_number
            
            for section in page.sections:
                section_title = section.title or f"Page {page_num}"
                section_path = f"{parsed_doc.company_name} > {parsed_doc.document_type} > {section_title}"
                section_text = section.content.strip()
                
                if not section_text:
                    continue

                token_count = self.count_tokens(section_text)
                
                # If section fits within target chunk size, keep it as a clean single chunk
                if token_count <= self.target_tokens + 150:
                    chunk_text_parts = [section_text]
                else:
                    # Split paragraphs cleanly if possible
                    paragraphs = section_text.split("\n\n")
                    chunk_text_parts = []
                    current_para_group = []
                    current_tokens = 0

                    for para in paragraphs:
                        para = para.strip()
                        if not para:
                            continue
                        para_tokens = self.count_tokens(para)
                        
                        # If a single paragraph/table is huge, sub-split it with overlap
                        if para_tokens > self.target_tokens:
                            if current_para_group:
                                chunk_text_parts.append("\n\n".join(current_para_group))
                                current_para_group = []
                                current_tokens = 0
                            sub_chunks = self.split_text_with_overlap(para, self.target_tokens, self.overlap_tokens)
                            chunk_text_parts.extend(sub_chunks)
                        elif current_tokens + para_tokens > self.target_tokens:
                            if current_para_group:
                                chunk_text_parts.append("\n\n".join(current_para_group))
                            current_para_group = [para]
                            current_tokens = para_tokens
                        else:
                            current_para_group.append(para)
                            current_tokens += para_tokens
                            
                    if current_para_group:
                        chunk_text_parts.append("\n\n".join(current_para_group))

                for part in chunk_text_parts:
                    content = part.strip()
                    if len(content) < 30:  # Skip trivial fragments
                        continue

                    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
                    chunk_id = f"{doc_id}_c{chunk_index:04d}"
                    has_table = "[Financial Table]" in content or "|" in content

                    chunk_record = {
                        "chunk_id": chunk_id,
                        "document_id": doc_id,
                        "document_name": parsed_doc.filename,
                        "chunk_index": chunk_index,
                        "page_number": page_num,
                        "start_page": page_num,
                        "end_page": page_num,
                        "section_title": section_title,
                        "section_path": section_path,
                        "company_name": parsed_doc.company_name,
                        "document_type": parsed_doc.document_type,
                        "reporting_period": parsed_doc.reporting_period,
                        "content": content,
                        "content_hash": content_hash,
                        "has_table": has_table,
                        "metadata": {
                            "token_count": self.count_tokens(content),
                            "char_count": len(content),
                            "has_table": has_table,
                            "section_level": section.level
                        }
                    }
                    chunks.append(chunk_record)
                    chunk_index += 1

        return chunks
