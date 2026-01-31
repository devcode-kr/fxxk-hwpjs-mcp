import { z } from 'zod';
import type { DocumentId } from '../types.js';
import { DOCUMENTS } from '../types.js';
import { getIndexManager } from '../cache/index-manager.js';
import { buildTOC } from '../indexer/section-extractor.js';

export const listSectionsSchema = z.object({
  document: z
    .enum(['hwp5', 'hwp3', 'formula', 'chart', 'dist'])
    .describe('대상 문서'),
  depth: z.number().optional().default(2).describe('목차 깊이 (기본값: 2)'),
});

export type ListSectionsInput = z.infer<typeof listSectionsSchema>;

export async function listSections(input: ListSectionsInput): Promise<string> {
  const indexManager = getIndexManager();
  const docId = input.document as DocumentId;
  const docInfo = DOCUMENTS[docId];
  const depth = input.depth ?? 2;

  const index = await indexManager.getIndex(docId);
  const toc = buildTOC(index.sections, depth);

  const lines: string[] = [];
  lines.push(`# ${docInfo.description} 목차`);
  lines.push(`파일: ${docInfo.filename}`);
  lines.push(`페이지 수: ${index.metadata.pageCount}`);
  lines.push(`섹션 수: ${index.sections.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(toc || '(섹션을 찾을 수 없습니다)');

  return lines.join('\n');
}
