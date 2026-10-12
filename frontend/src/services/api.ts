import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface SystemHealth {
  status: string;
  gemini_api_configured: boolean;
  database_connected: boolean;
  vector_index_present: boolean;
  bm25_index_present: boolean;
  gemini_model: string;
  embedding_model: string;
  version: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  original_path: string;
  file_size: number;
  file_hash: string;
  page_count: number;
  company_name: string;
  document_type: string;
  reporting_period: string;
  status: string;
  chunk_count: number;
  error_message: string;
  created_at: string;
}

export interface ChunkItem {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  page_number: number;
  start_page: number;
  end_page: number;
  section_title: string;
  section_path: string;
  content: string;
  metadata: {
    token_count?: number;
    char_count?: number;
    has_table?: boolean;
    section_level?: number;
  };
}

export interface SourceCitation {
  citation_id: number;
  document_id: string;
  document_name: string;
  company_name: string;
  document_type: string;
  page_number: number;
  section_title: string;
  section_path?: string;
  chunk_id: string;
  excerpt: string;
  rrf_score?: number;
  dense_rank?: number;
  bm25_rank?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: SourceCitation[];
  diagnostics?: any;
  created_at?: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateExample {
  id: string;
  question: string;
  reference_answer: string;
  source_document: string;
  source_pages: string;
  supporting_text: string;
  question_type: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'edited';
  reviewer_notes: string;
  created_at: string;
}

export interface EvaluationRunItem {
  id: string;
  run_id: string;
  candidate_id?: string;
  question: string;
  reference_answer: string;
  generated_answer: string;
  retrieved_contexts: string[];
  scores: {
    faithfulness?: number;
    answer_relevancy?: number;
    context_precision?: number;
    context_recall?: number;
  };
}

export interface EvaluationRun {
  id: string;
  run_name: string;
  example_count: number;
  status: string;
  metrics: {
    faithfulness?: number;
    answer_relevancy?: number;
    context_precision?: number;
    context_recall?: number;
  };
  error_message?: string;
  created_at: string;
  items?: EvaluationRunItem[];
}

export interface DashboardData {
  discovered_documents_count: number;
  processed_documents_count: number;
  failed_documents_count: number;
  total_chunks_count: number;
  questions_asked_count: number;
  recent_documents: DocumentItem[];
  latest_evaluation_run?: EvaluationRun;
  system_health: {
    gemini_api_status: string;
    embedding_index_status: string;
    keyword_index_status: string;
    last_indexing_time: string;
    active_gemini_model: string;
    active_embedding_model: string;
  };
}

// API Functions
export const fetchHealth = async (): Promise<SystemHealth> => {
  const res = await api.get('/health');
  return res.data;
};

export const fetchDashboard = async (): Promise<DashboardData> => {
  const res = await api.get('/dashboard');
  return res.data;
};

export const fetchDocuments = async (): Promise<DocumentItem[]> => {
  const res = await api.get('/documents');
  return res.data;
};

export const fetchDocumentChunks = async (docId: string): Promise<ChunkItem[]> => {
  const res = await api.get(`/documents/${docId}/chunks`);
  return res.data;
};

export const syncAllDocuments = async (force: boolean = false, maxDocs?: number) => {
  const res = await api.post('/documents/sync', null, { params: { force, max_docs: maxDocs } });
  return res.data;
};

export const reprocessDocument = async (docId: string) => {
  const res = await api.post(`/documents/${docId}/process`);
  return res.data;
};

export const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const sendMessage = async (query: string, conversationId?: string, docFilter?: string) => {
  const res = await api.post('/chat', {
    query,
    conversation_id: conversationId,
    doc_filter: docFilter,
  });
  return res.data;
};

export const fetchConversations = async (): Promise<ConversationItem[]> => {
  const res = await api.get('/chat/conversations');
  return res.data;
};

export const fetchConversation = async (convId: string) => {
  const res = await api.get(`/chat/conversations/${convId}`);
  return res.data;
};

export const generateEvaluationDataset = async (count: number = 5, targetDocId?: string) => {
  const res = await api.post('/evaluation/datasets/generate', {
    count,
    target_doc_id: targetDocId,
  });
  return res.data;
};

export const fetchEvaluationDataset = async (status?: string, docName?: string): Promise<CandidateExample[]> => {
  const res = await api.get('/evaluation/datasets', { params: { status, doc_name: docName } });
  return res.data;
};

export const updateCandidate = async (exampleId: string, updates: Partial<CandidateExample>) => {
  const res = await api.patch(`/evaluation/datasets/${exampleId}`, updates);
  return res.data;
};

export const approveCandidate = async (exampleId: string) => {
  const res = await api.post(`/evaluation/datasets/${exampleId}/approve`);
  return res.data;
};

export const rejectCandidate = async (exampleId: string) => {
  const res = await api.post(`/evaluation/datasets/${exampleId}/reject`);
  return res.data;
};

export const batchApproveCandidates = async (exampleIds: string[]) => {
  const res = await api.post('/evaluation/datasets/approve-batch', { example_ids: exampleIds });
  return res.data;
};

export const runEvaluation = async (candidateIds?: string[], runName?: string) => {
  const res = await api.post('/evaluation/runs', {
    candidate_ids: candidateIds,
    run_name: runName || 'FinSight RAGAS Run',
  });
  return res.data;
};

export const fetchEvaluationRuns = async (): Promise<EvaluationRun[]> => {
  const res = await api.get('/evaluation/runs');
  return res.data;
};

export const fetchEvaluationRunDetails = async (runId: string): Promise<EvaluationRun> => {
  const res = await api.get(`/evaluation/runs/${runId}`);
  return res.data;
};
