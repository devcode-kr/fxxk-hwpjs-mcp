/**
 * PDF → 청크 분할 → Gemini 임베딩 → Qdrant 저장
 */

import type { DocumentId } from '../types.js';
import { DOCUMENTS } from '../types.js';
import { getIndexManager } from '../cache/index-manager.js';
import { embedBatch } from '../embeddings/gemini-embedder.js';
import { ensureCollection, isDocIndexed, upsertChunks } from './qdrant-store.js';

const CHUNK_SIZE = 400;       // 글자 수 기준 청크 크기
const CHUNK_OVERLAP = 80;     // 청크 간 중복 글자 수

// TOC 페이지 감지: 점선(·····, .....) 라인이 이 수 이상이면 TOC로 판단
const DOTLEADER_PATTERN = /[·.]{4,}/;
const TOC_DENSITY_THRESHOLD = 5;

function isTocPageText(pageText: string): boolean {
  const lines = pageText.split('\n');
  const dotCount = lines.filter((l) => DOTLEADER_PATTERN.test(l)).length;
  return dotCount >= TOC_DENSITY_THRESHOLD;
}

// -------------------------------------------------------------------
// Text chunking
// -------------------------------------------------------------------

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 10) chunks.push(chunk);
    start += size - overlap;
  }

  return chunks;
}

// -------------------------------------------------------------------
// Page-level chunks with metadata
// -------------------------------------------------------------------

interface PageChunk {
  text: string;
  page: number;
  sectionId?: string;
  sectionTitle?: string;
}

function buildPageChunks(index: { sections: Array<{ id: string; title: string; startPage: number; endPage: number }>; pageTexts: string[] }): PageChunk[] {
  const allChunks: PageChunk[] = [];

  for (let pageIdx = 0; pageIdx < index.pageTexts.length; pageIdx++) {
    const pageNum = pageIdx + 1;
    const pageText = index.pageTexts[pageIdx];
    if (!pageText || pageText.trim().length < 10) continue;

    // TOC 페이지 제외 — 점선 목차 내용이 시맨틱 검색 품질을 낮춤
    if (isTocPageText(pageText)) continue;

    // Find which section this page belongs to
    const section = index.sections
      .filter((s) => s.startPage <= pageNum && s.endPage >= pageNum)
      .sort((a, b) => b.id.split('.').length - a.id.split('.').length)[0];

    const textChunks = chunkText(pageText);
    for (const text of textChunks) {
      allChunks.push({
        text,
        page: pageNum,
        sectionId: section?.id,
        sectionTitle: section?.title,
      });
    }
  }

  return allChunks;
}

// -------------------------------------------------------------------
// Index a single document
// -------------------------------------------------------------------

export async function indexDocument(docId: DocumentId, force = false): Promise<void> {
  await ensureCollection();

  if (!force && (await isDocIndexed(docId))) {
    console.error(`[vector] '${docId}' already indexed, skipping.`);
    return;
  }

  console.error(`[vector] Indexing '${docId}' (${DOCUMENTS[docId].description})...`);

  const indexManager = getIndexManager();
  const index = await indexManager.getIndex(docId);

  if (!index.pageTexts || index.pageTexts.length === 0) {
    throw new Error(`'${docId}' 문서에서 텍스트를 추출하지 못했습니다.`);
  }

  const pageChunks = buildPageChunks(index as Parameters<typeof buildPageChunks>[0]);
  console.error(`[vector] ${pageChunks.length}개 청크 생성됨, 임베딩 중...`);

  const embeddings = await embedBatch(pageChunks.map((c) => c.text));

  await upsertChunks(
    docId,
    pageChunks.map((chunk, i) => ({
      text: chunk.text,
      embedding: embeddings[i],
      payload: {
        page: chunk.page,
        sectionId: chunk.sectionId,
        sectionTitle: chunk.sectionTitle,
      },
    }))
  );

  console.error(`[vector] '${docId}' 인덱싱 완료.`);
}

// -------------------------------------------------------------------
// Index all documents
// -------------------------------------------------------------------

export async function indexAllDocuments(force = false): Promise<void> {
  const docIds = Object.keys(DOCUMENTS) as DocumentId[];
  for (const docId of docIds) {
    await indexDocument(docId, force);
  }
}
