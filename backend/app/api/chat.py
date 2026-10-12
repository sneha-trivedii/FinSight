import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException
from backend.app.core.config import settings
from backend.app.db.repository import ConversationRepository
from backend.app.schemas.chat import ChatRequest, ChatResponse
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.dense_retriever import DenseRetriever
from backend.app.services.bm25_retriever import BM25Retriever
from backend.app.services.hybrid_retriever import HybridRetriever
from backend.app.services.answer_service import AnswerService

router = APIRouter(prefix="/chat", tags=["Chat"])

def get_hybrid_retriever() -> HybridRetriever:
    emb = EmbeddingService()
    dense = DenseRetriever(dimension=emb.dimension)
    bm25 = BM25Retriever()
    return HybridRetriever(emb, dense, bm25)

def get_answer_service() -> AnswerService:
    return AnswerService()

@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest):
    # 1. Manage Conversation ID
    conv_id = request.conversation_id
    if not conv_id:
        conv_id = f"conv_{uuid.uuid4().hex[:10]}"
        # Generate title from first 6 words of query
        title = " ".join(request.query.split()[:6])
        ConversationRepository.create(conv_id, title)
    else:
        existing = ConversationRepository.get_by_id(conv_id)
        if not existing:
            ConversationRepository.create(conv_id, " ".join(request.query.split()[:6]))

    # Save user message
    user_msg_id = f"msg_{uuid.uuid4().hex[:10]}"
    ConversationRepository.add_message(
        msg_id=user_msg_id,
        conv_id=conv_id,
        role="user",
        content=request.query
    )

    # 2. Get past conversation history for contextual grounding
    history = ConversationRepository.get_messages(conv_id)
    history_tuples = [{"role": m["role"], "content": m["content"]} for m in history[:-1]]

    # 3. Hybrid Retrieval
    retriever = get_hybrid_retriever()
    retrieval_res = retriever.retrieve(
        query=request.query,
        top_k=settings.TOP_K_HYBRID,
        doc_filter=request.doc_filter
    )
    selected_chunks = retrieval_res["chunks"]

    # 4. Generate Answer with Gemini
    answer_svc = get_answer_service()
    ans_data = answer_svc.generate_answer(
        query=request.query,
        retrieved_chunks=selected_chunks,
        conversation_history=history_tuples
    )

    # Combine diagnostics
    diagnostics = {
        **retrieval_res["diagnostics"],
        **ans_data["diagnostics"]
    }

    # Save assistant message
    asst_msg_id = f"msg_{uuid.uuid4().hex[:10]}"
    ConversationRepository.add_message(
        msg_id=asst_msg_id,
        conv_id=conv_id,
        role="assistant",
        content=ans_data["answer"],
        citations=ans_data["sources"],
        diagnostics=diagnostics
    )

    return ChatResponse(
        conversation_id=conv_id,
        answer=ans_data["answer"],
        sources=ans_data["sources"],
        diagnostics=diagnostics
    )

@router.get("/conversations")
def list_conversations():
    return ConversationRepository.get_all()

@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    conv = ConversationRepository.get_by_id(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = ConversationRepository.get_messages(conversation_id)
    return {
        "conversation": conv,
        "messages": messages
    }
