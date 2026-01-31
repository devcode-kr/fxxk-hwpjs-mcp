import { z } from 'zod';
import type { DocumentId } from '../types.js';
import { DOCUMENTS } from '../types.js';
import { getIndexManager } from '../cache/index-manager.js';
import { findSectionByIdOrTitle } from '../indexer/section-extractor.js';

export const getSectionSchema = z.object({
  document: z
    .enum(['hwp5', 'hwp3', 'formula', 'chart', 'dist'])
    .describe('대상 문서'),
  section: z.string().describe('섹션 번호 또는 제목 (예: "2.1.3" 또는 "FileHeader")'),
});

export type GetSectionInput = z.infer<typeof getSectionSchema>;

export async function getSection(input: GetSectionInput): Promise<string> {
  const indexManager = getIndexManager();
  const docId = input.document as DocumentId;
  const docInfo = DOCUMENTS[docId];

  const index = await indexManager.getIndex(docId);
  const section = findSectionByIdOrTitle(index.sections, input.section);

  if (!section) {
    const availableSections = index.sections
      .slice(0, 10)
      .map((s) => `${s.id} ${s.title}`)
      .join('\n  ');

    return `섹션을 찾을 수 없습니다: "${input.section}"\n\n사용 가능한 섹션 예시:\n  ${availableSections}`;
  }

  const content = await indexManager.getSectionContent(docId, section);

  const lines: string[] = [];
  lines.push(`# ${section.id} ${section.title}`);
  lines.push(`문서: ${docInfo.description}`);
  lines.push(`페이지: ${section.startPage} - ${section.endPage}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(content);

  return lines.join('\n');
}
