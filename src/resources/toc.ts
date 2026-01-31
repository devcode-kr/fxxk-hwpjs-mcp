import type { DocumentId } from '../types.js';
import { DOCUMENTS } from '../types.js';
import { getIndexManager } from '../cache/index-manager.js';
import { buildTOC } from '../indexer/section-extractor.js';

export const TOC_RESOURCES = Object.keys(DOCUMENTS).map((id) => ({
  uri: `spec://${id}/toc`,
  name: `${DOCUMENTS[id as DocumentId].description} 목차`,
  description: `${DOCUMENTS[id as DocumentId].filename}의 목차`,
  mimeType: 'text/plain',
}));

export async function getTocResource(uri: string): Promise<string | null> {
  // Parse URI: spec://{docId}/toc
  const match = uri.match(/^spec:\/\/([^/]+)\/toc$/);
  if (!match) return null;

  const docId = match[1] as DocumentId;
  if (!DOCUMENTS[docId]) return null;

  const indexManager = getIndexManager();
  const index = await indexManager.getIndex(docId);
  const docInfo = DOCUMENTS[docId];

  const lines: string[] = [];
  lines.push(`# ${docInfo.description}`);
  lines.push(`파일: ${docInfo.filename}`);
  lines.push(`페이지 수: ${index.metadata.pageCount}`);
  lines.push(`인덱싱 시간: ${index.metadata.indexedAt}`);
  lines.push('');
  lines.push('## 목차');
  lines.push('');
  lines.push(buildTOC(index.sections, 3));

  return lines.join('\n');
}
