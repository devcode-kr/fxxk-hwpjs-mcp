import { z } from 'zod';
import type { DocumentId } from '../types.js';
import { embedText } from '../embeddings/gemini-embedder.js';
import { semanticSearch, collectionExists } from '../vector/qdrant-store.js';

export const semanticSearchSchema = z.object({
  query: z.string().describe('자연어 검색어 (예: "문단 배경색 설정 방법")'),
  document: z
    .enum(['hwp3', 'hwp5', 'formula', 'chart', 'dist'])
    .optional()
    .describe('대상 문서 (생략시 전체)'),
  limit: z.number().int().min(1).max(20).default(5).describe('결과 개수 (기본 5)'),
});

export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;

export async function semanticSearchSpec(input: SemanticSearchInput): Promise<string> {
  // Check if vector index is available
  if (!(await collectionExists())) {
    return [
      '⚠️ 벡터 인덱스가 없습니다.',
      '',
      'Qdrant가 실행 중인지 확인하고, 먼저 인덱싱을 실행하세요:',
      '  node dist/cli.js index [--doc hwp5] [--force]',
    ].join('\n');
  }

  const queryEmbedding = await embedText(input.query);
  const hits = await semanticSearch(queryEmbedding, {
    docId: input.document as DocumentId | undefined,
    limit: input.limit,
    scoreThreshold: 0.45,
  });

  if (hits.length === 0) {
    return `"${input.query}"에 대한 시맨틱 검색 결과가 없습니다.\n키워드 검색(search)을 시도해보세요.`;
  }

  const lines: string[] = [`# 시맨틱 검색 결과: "${input.query}" (${hits.length}건)`, ''];

  for (const hit of hits) {
    lines.push(`## [${hit.docId}] ${hit.sectionTitle ?? '(섹션 미확인)'} — p.${hit.page} (유사도: ${(hit.score * 100).toFixed(1)}%)`);
    if (hit.sectionId) lines.push(`섹션: ${hit.sectionId}`);
    lines.push('');
    lines.push(hit.text.slice(0, 400) + (hit.text.length > 400 ? '...' : ''));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
