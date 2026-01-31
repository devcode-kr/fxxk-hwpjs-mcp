import { z } from 'zod';
import type { DocumentId } from '../types.js';
import { DOCUMENTS } from '../types.js';
import { getIndexManager } from '../cache/index-manager.js';

export const searchSpecSchema = z.object({
  query: z.string().describe('검색어'),
  document: z
    .enum(['hwp5', 'hwp3', 'formula', 'chart', 'dist'])
    .optional()
    .describe('대상 문서 (생략시 전체)'),
});

export type SearchSpecInput = z.infer<typeof searchSpecSchema>;

export async function searchSpec(input: SearchSpecInput): Promise<string> {
  const indexManager = getIndexManager();
  const docId = input.document as DocumentId | undefined;

  const matches = await indexManager.search(input.query, docId);

  if (matches.length === 0) {
    return `검색 결과가 없습니다: "${input.query}"`;
  }

  const lines: string[] = [];
  lines.push(`검색 결과: "${input.query}" (${matches.length}건)`);
  lines.push('');

  // Group by document
  const byDocument = new Map<DocumentId, typeof matches>();
  for (const match of matches) {
    const existing = byDocument.get(match.document) || [];
    existing.push(match);
    byDocument.set(match.document, existing);
  }

  for (const [docId, docMatches] of byDocument) {
    const docInfo = DOCUMENTS[docId];
    lines.push(`## ${docInfo.description} (${docInfo.filename})`);
    lines.push('');

    for (const match of docMatches.slice(0, 5)) {
      // Limit to 5 matches per document
      const sectionInfo = match.section
        ? `${match.section.id} ${match.section.title}`
        : '(섹션 미확인)';

      lines.push(`- **페이지 ${match.page}** - ${sectionInfo}`);
      lines.push(`  > ${match.context}`);
      lines.push('');
    }

    if (docMatches.length > 5) {
      lines.push(`  ... 외 ${docMatches.length - 5}건`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
