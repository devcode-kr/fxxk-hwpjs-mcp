import type { ParsedPDF, ParsedPage } from './pdf-parser.js';
import type { Section } from '../types.js';

// -------------------------------------------------------------------
// Patterns
// -------------------------------------------------------------------

// Strict: at least "N.N" level (avoids single-digit noise like "0", "1")
const SECTION_PATTERN = /^(\d+(?:\.\d+)+\.?)\s+(.+)$/;

// Top-level: "1. 개요" 형태 허용 (점 필수)
// [\u0080-\uFFFF]: PDF 폰트 인코딩에서 PUA 영역(U+F53A 등)으로 매핑된 한글 포함
const TOP_LEVEL_PATTERN = /^([1-9])\.\s+([\u0080-\uFFFF][\u0080-\uFFFF A-Za-z0-9/()·-]{1,})$/;

// Noise titles — likely table row content, not headings
const NOISE_TITLE_PATTERN = /^[\d\s.]+$|^[A-Z_]{2,}\s*\d+$|^(UINT|INT|BYTE|WORD|DWORD|HWPUNIT|MAKE_4CHID|true|false|off|on)\b/i;

// Excessive special characters (목차 점선 등)
const DOTLEADER_PATTERN = /[·.]{4,}/;

// -------------------------------------------------------------------
// TOC page detection
// -------------------------------------------------------------------

/**
 * Detect pages that are likely TOC (table of contents).
 * Heuristic: if a page has >= TOC_DENSITY_THRESHOLD candidate lines
 * with dotleaders (·····) it is a TOC page.
 */
const TOC_DENSITY_THRESHOLD = 5;

function isTocPage(page: ParsedPage): boolean {
  const dotLeaderLines = page.lines.filter((l) => DOTLEADER_PATTERN.test(l)).length;
  return dotLeaderLines >= TOC_DENSITY_THRESHOLD;
}

// -------------------------------------------------------------------
// Section heading parser
// -------------------------------------------------------------------

function parseSectionHeading(line: string): { id: string; title: string; level: number } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return null;

  // Try strict multi-level first (e.g. "3.2.1 파일 인식 정보")
  let match = trimmed.match(SECTION_PATTERN);
  if (match) {
    const id = match[1].replace(/\.$/, '');
    const title = match[2].trim();
    const level = id.split('.').length;
    if (level <= 5 && isGoodTitle(id, title)) {
      return { id, title, level };
    }
  }

  // Try top-level (e.g. "3 글 파일 구조" or "3. 글 파일 구조")
  match = trimmed.match(TOP_LEVEL_PATTERN);
  if (match) {
    const id = (match[1] ?? match[3]).trim();
    const title = (match[2] ?? match[4]).trim();
    if (isGoodTitle(id, title)) {
      return { id, title, level: 1 };
    }
  }

  return null;
}

function isGoodTitle(id: string, title: string): boolean {
  if (!title || title.length < 2) return false;

  // Reject dotleader lines (목차 항목들)
  if (DOTLEADER_PATTERN.test(title)) return false;

  // Reject noise patterns
  if (NOISE_TITLE_PATTERN.test(title)) return false;

  // Reject titles that are purely numeric
  if (/^\d[\d\s]*$/.test(title)) return false;

  // Reject very long IDs that look like table row indices
  if (id.split('.').length > 5) return false;

  // Must contain at least one letter (한글, PUA 한글, or Latin)
  if (!/[가-힣\u0080-\uFFFF A-Za-z]/.test(title)) return false;

  return true;
}

// -------------------------------------------------------------------
// Deduplication: prefer body pages over TOC pages
// -------------------------------------------------------------------

function deduplicateSections(raws: Array<{ id: string; title: string; level: number; page: number; lineIndex: number }>): typeof raws {
  // Group by id
  const byId = new Map<string, typeof raws[0][]>();
  for (const s of raws) {
    if (!byId.has(s.id)) byId.set(s.id, []);
    byId.get(s.id)!.push(s);
  }

  const result: typeof raws[0][] = [];
  for (const candidates of byId.values()) {
    if (candidates.length === 1) {
      result.push(candidates[0]);
    } else {
      // Multiple occurrences — pick the one with the highest page number
      // (body content comes after TOC)
      const best = candidates.reduce((a, b) => (a.page >= b.page ? a : b));
      result.push(best);
    }
  }

  // Re-sort by page, then lineIndex
  result.sort((a, b) => a.page - b.page || a.lineIndex - b.lineIndex);
  return result;
}

// -------------------------------------------------------------------
// Main extractor
// -------------------------------------------------------------------

export function extractSections(pdf: ParsedPDF): Section[] {
  const rawSections: Array<{ id: string; title: string; level: number; page: number; lineIndex: number }> = [];

  for (const page of pdf.pages) {
    // Skip TOC pages — they duplicate headings with dotleaders
    if (isTocPage(page)) continue;

    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i];
      const section = parseSectionHeading(line);
      if (section) {
        rawSections.push({ ...section, page: page.pageNumber, lineIndex: i });
      }
    }
  }

  const deduped = deduplicateSections(rawSections);

  // Build Section[] with page ranges
  return deduped.map((raw, index) => {
    const next = deduped[index + 1];
    return {
      id: raw.id,
      title: raw.title,
      level: raw.level,
      startPage: raw.page,
      endPage: next ? Math.max(raw.page, next.page - 1) : pdf.pageCount,
    };
  });
}

// -------------------------------------------------------------------
// Content extraction
// -------------------------------------------------------------------

export function getSectionContent(pdf: ParsedPDF, section: Section): string {
  const lines: string[] = [];

  for (let pageNum = section.startPage; pageNum <= section.endPage; pageNum++) {
    const page = pdf.pages.find((p) => p.pageNumber === pageNum);
    if (!page) continue;

    if (pageNum === section.startPage) {
      const headingIndex = findSectionHeadingIndex(page, section);
      lines.push(...page.lines.slice(headingIndex >= 0 ? headingIndex : 0));
    } else {
      lines.push(...page.lines);
    }
  }

  return lines.join('\n');
}

function findSectionHeadingIndex(page: ParsedPage, section: Section): number {
  for (let i = 0; i < page.lines.length; i++) {
    const line = page.lines[i];
    if (line.includes(section.id) && line.includes(section.title)) return i;
  }
  return -1;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

export function findSectionByIdOrTitle(sections: Section[], query: string): Section | undefined {
  const q = query.toLowerCase().trim();

  const exactMatch = sections.find((s) => s.id === query || s.id === q);
  if (exactMatch) return exactMatch;

  const prefixMatch = sections.find(
    (s) => s.id.startsWith(query + '.') || s.id.startsWith(q + '.')
  );
  if (prefixMatch) return prefixMatch;

  const titleMatch = sections.find((s) => s.title.toLowerCase().includes(q));
  return titleMatch;
}

export function filterSectionsByDepth(sections: Section[], maxDepth: number): Section[] {
  return sections.filter((s) => s.level <= maxDepth);
}

export function buildTOC(sections: Section[], maxDepth: number = 3): string {
  return filterSectionsByDepth(sections, maxDepth)
    .map((s) => `${'  '.repeat(s.level - 1)}${s.id} ${s.title} (p.${s.startPage})`)
    .join('\n');
}
