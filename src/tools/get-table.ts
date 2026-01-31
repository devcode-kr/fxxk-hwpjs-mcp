import { z } from 'zod';
import type { DocumentId } from '../types.js';
import { DOCUMENTS } from '../types.js';
import { getIndexManager } from '../cache/index-manager.js';
import { findTableByNameOrId, formatTable } from '../indexer/table-extractor.js';

export const getTableSchema = z.object({
  document: z
    .enum(['hwp5', 'hwp3', 'formula', 'chart', 'dist'])
    .describe('대상 문서'),
  table_name: z.string().describe('테이블 이름 또는 번호'),
});

export type GetTableInput = z.infer<typeof getTableSchema>;

export async function getTable(input: GetTableInput): Promise<string> {
  const indexManager = getIndexManager();
  const docId = input.document as DocumentId;
  const docInfo = DOCUMENTS[docId];

  const index = await indexManager.getIndex(docId);
  const table = findTableByNameOrId(index.tables, input.table_name);

  if (!table) {
    if (index.tables.length === 0) {
      return `${docInfo.description}에서 테이블을 찾을 수 없습니다.`;
    }

    const availableTables = index.tables
      .slice(0, 10)
      .map((t) => `${t.id}: ${t.name}`)
      .join('\n  ');

    return `테이블을 찾을 수 없습니다: "${input.table_name}"\n\n사용 가능한 테이블:\n  ${availableTables}`;
  }

  const lines: string[] = [];
  lines.push(`문서: ${docInfo.description}`);
  lines.push('');
  lines.push(formatTable(table));

  return lines.join('\n');
}
