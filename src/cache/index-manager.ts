import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { parsePDF, getPageText } from '../indexer/pdf-parser.js';
import { extractSections, getSectionContent } from '../indexer/section-extractor.js';
import { extractTables } from '../indexer/table-extractor.js';
import type { DocumentId, DocumentIndex, Section } from '../types.js';
import { DOCUMENTS } from '../types.js';

// -------------------------------------------------------------------
// Paths
// -------------------------------------------------------------------

function getSpecsDir(): string {
  return process.env.HWP_SPECS_DIR ?? path.resolve(process.cwd(), 'specs');
}

function getCacheDir(): string {
  return process.env.HWP_CACHE_DIR ?? path.resolve(process.cwd(), 'cache');
}

function getDocFilePath(docId: DocumentId): string {
  const specsDir = getSpecsDir();
  const doc = DOCUMENTS[docId];
  return path.join(specsDir, doc.filename);
}

function getCacheFilePath(docId: DocumentId): string {
  return path.join(getCacheDir(), `${docId}.json`);
}

// -------------------------------------------------------------------
// Search result type (flat, as expected by search-spec.ts)
// -------------------------------------------------------------------

export interface FlatSearchMatch {
  document: DocumentId;
  section: Section;
  page: number;
  context: string;
}

// -------------------------------------------------------------------
// Index Manager
// -------------------------------------------------------------------

class IndexManager {
  private cache = new Map<DocumentId, DocumentIndex>();

  /**
   * Get (or build) the DocumentIndex for a given document.
   */
  async getIndex(docId: DocumentId): Promise<DocumentIndex> {
    // Memory cache hit
    if (this.cache.has(docId)) {
      return this.cache.get(docId)!;
    }

    const docPath = getDocFilePath(docId);
    const cachePath = getCacheFilePath(docId);

    if (!existsSync(docPath)) {
      throw new Error(
        `스펙 파일을 찾을 수 없습니다: ${docPath}\n` +
          `HWP_SPECS_DIR 환경변수를 설정하거나 specs 폴더에 PDF를 넣어주세요.`
      );
    }

    // Check whether disk cache is still valid
    const fileBuffer = await readFile(docPath);
    const currentHash = createHash('md5').update(fileBuffer).digest('hex');

    let index: DocumentIndex | null = null;

    if (existsSync(cachePath)) {
      try {
        const cached: DocumentIndex = JSON.parse(await readFile(cachePath, 'utf-8'));
        if (cached.metadata?.hash === currentHash) {
          index = cached;
        }
      } catch {
        // Corrupt cache — rebuild
      }
    }

    if (!index) {
      index = await this.buildIndex(docId, docPath, currentHash);
      await this.saveCache(cachePath, index);
    }

    this.cache.set(docId, index);
    return index;
  }

  /**
   * Get the text content for a specific section.
   */
  async getSectionContent(docId: DocumentId, section: Section): Promise<string> {
    const index = await this.getIndex(docId);

    // Try using pre-stored pageTexts first
    if (index.pageTexts && index.pageTexts.length > 0) {
      return getSectionContent(
        {
          filename: DOCUMENTS[docId].filename,
          hash: index.metadata.hash,
          pageCount: index.metadata.pageCount,
          pages: index.pageTexts.map((text, i) => ({
            pageNumber: i + 1,
            text,
            lines: text.split('\n'),
          })),
        },
        section
      );
    }

    // Fallback: re-parse from PDF
    const docPath = getDocFilePath(docId);
    const lines: string[] = [];

    for (let p = section.startPage; p <= section.endPage; p++) {
      try {
        const text = await getPageText(docPath, p);
        lines.push(text);
      } catch {
        // Skip unreadable pages
      }
    }

    return lines.join('\n\n');
  }

  /**
   * Search for a query across one or all documents.
   */
  async search(query: string, docId?: DocumentId): Promise<FlatSearchMatch[]> {
    const results: FlatSearchMatch[] = [];
    const normalizedQuery = query.toLowerCase();

    const docIds: DocumentId[] = docId
      ? [docId]
      : (Object.keys(DOCUMENTS) as DocumentId[]);

    for (const id of docIds) {
      let index: DocumentIndex;
      try {
        index = await this.getIndex(id);
      } catch {
        continue; // Skip documents that can't be loaded
      }

      if (!index.pageTexts) continue;

      // pageRange가 있으면 pageTexts[0] = pageRange.start 페이지
      const pageOffset = index.metadata.pageRange?.start ?? 1;

      for (let pageIdx = 0; pageIdx < index.pageTexts.length; pageIdx++) {
        const pageText = index.pageTexts[pageIdx];
        const pageNum = pageOffset + pageIdx;

        if (!pageText.toLowerCase().includes(normalizedQuery)) continue;

        // Find matching section
        const section = findSectionForPage(index.sections, pageNum) ?? {
          id: '?',
          title: '(섹션 미확인)',
          level: 0,
          startPage: pageNum,
          endPage: pageNum,
        };

        // Extract context snippet
        const lower = pageText.toLowerCase();
        const matchIdx = lower.indexOf(normalizedQuery);
        const start = Math.max(0, matchIdx - 80);
        const end = Math.min(pageText.length, matchIdx + normalizedQuery.length + 80);
        const context = pageText.slice(start, end).replace(/\s+/g, ' ').trim();

        results.push({ document: id, section, page: pageNum, context });
      }
    }

    // Limit total results to keep responses manageable
    return results.slice(0, 50);
  }

  // -------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------

  private async buildIndex(
    docId: DocumentId,
    docPath: string,
    hash: string
  ): Promise<DocumentIndex> {
    const fullPdf = await parsePDF(docPath);
    const pageRange = DOCUMENTS[docId].pageRange;

    // pageRange가 지정된 경우 해당 범위만 잘라서 처리
    const pdf = pageRange
      ? {
          ...fullPdf,
          pageCount: pageRange.end - pageRange.start + 1,
          pages: fullPdf.pages.filter(
            (p) => p.pageNumber >= pageRange.start && p.pageNumber <= pageRange.end
          ),
        }
      : fullPdf;

    const sections = extractSections(pdf);
    const tables = extractTables(pdf);

    return {
      metadata: {
        filename: DOCUMENTS[docId].filename,
        hash,
        indexedAt: new Date().toISOString(),
        pageCount: pdf.pageCount,
        pageRange,
      },
      sections,
      tables,
      // pageTexts 인덱스 0 = pageRange.start (또는 p.1)
      pageTexts: pdf.pages.map((p) => p.text),
    };
  }

  private async saveCache(cachePath: string, index: DocumentIndex): Promise<void> {
    try {
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(index), 'utf-8');
    } catch {
      // Cache write failure is non-fatal
    }
  }
}

// -------------------------------------------------------------------
// Helper
// -------------------------------------------------------------------

function findSectionForPage(sections: Section[], page: number): Section | undefined {
  // Find the deepest section that contains this page
  return sections
    .filter((s) => s.startPage <= page && s.endPage >= page)
    .sort((a, b) => b.level - a.level)[0];
}

// -------------------------------------------------------------------
// Singleton
// -------------------------------------------------------------------

let _instance: IndexManager | null = null;

export function getIndexManager(): IndexManager {
  if (!_instance) {
    _instance = new IndexManager();
  }
  return _instance;
}
