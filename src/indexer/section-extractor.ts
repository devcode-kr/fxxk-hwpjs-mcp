import type { ParsedPDF, ParsedPage } from './pdf-parser.js';
import type { Section } from '../types.js';

// Patterns for detecting section headings
// e.g., "1.", "1.1", "1.1.1", "2.3.4.5"
const SECTION_PATTERN = /^(\d+(?:\.\d+)*\.?)\s+(.+)$/;

interface RawSection {
  id: string;
  title: string;
  level: number;
  page: number;
  lineIndex: number;
}

export function extractSections(pdf: ParsedPDF): Section[] {
  const rawSections: RawSection[] = [];

  for (const page of pdf.pages) {
    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i];
      const section = parseSectionHeading(line);

      if (section) {
        rawSections.push({
          ...section,
          page: page.pageNumber,
          lineIndex: i,
        });
      }
    }
  }

  // Convert to Section format with page ranges
  const sections: Section[] = rawSections.map((raw, index) => {
    const nextSection = rawSections[index + 1];
    return {
      id: raw.id,
      title: raw.title,
      level: raw.level,
      startPage: raw.page,
      endPage: nextSection ? nextSection.page : pdf.pageCount,
    };
  });

  return sections;
}

function parseSectionHeading(line: string): { id: string; title: string; level: number } | null {
  const trimmed = line.trim();

  // Check for numbered section pattern (1., 1.1, 1.1.1, etc.)
  const match = trimmed.match(SECTION_PATTERN);
  if (match) {
    const id = match[1].replace(/\.$/, ''); // Remove trailing dot
    const title = match[2].trim();

    // Calculate level based on number of dots
    const level = id.split('.').length;

    // Filter out likely page numbers or short matches
    if (title.length > 1 && !isLikelyNoise(id, title)) {
      return { id, title, level };
    }
  }

  return null;
}

function isLikelyNoise(id: string, title: string): boolean {
  // Filter out entries that are likely not actual section headings

  // Skip if title is just numbers (likely page references)
  if (/^\d+$/.test(title)) return true;

  // Skip very short titles
  if (title.length < 2) return true;

  // Skip if id has too many levels (likely table content)
  if (id.split('.').length > 5) return true;

  return false;
}

export function getSectionContent(pdf: ParsedPDF, section: Section): string {
  const lines: string[] = [];

  for (let pageNum = section.startPage; pageNum <= section.endPage; pageNum++) {
    const page = pdf.pages.find((p) => p.pageNumber === pageNum);
    if (page) {
      if (pageNum === section.startPage) {
        // Find the section heading and include content from there
        const headingIndex = findSectionHeadingIndex(page, section);
        if (headingIndex >= 0) {
          lines.push(...page.lines.slice(headingIndex));
        } else {
          lines.push(...page.lines);
        }
      } else if (pageNum === section.endPage) {
        // Find where next section starts and stop there
        lines.push(...page.lines);
      } else {
        lines.push(...page.lines);
      }
    }
  }

  return lines.join('\n');
}

function findSectionHeadingIndex(page: ParsedPage, section: Section): number {
  for (let i = 0; i < page.lines.length; i++) {
    const line = page.lines[i];
    if (line.includes(section.id) && line.includes(section.title)) {
      return i;
    }
  }
  return -1;
}

export function findSectionByIdOrTitle(sections: Section[], query: string): Section | undefined {
  const normalizedQuery = query.toLowerCase().trim();

  // Try exact ID match first
  const exactMatch = sections.find((s) => s.id === query || s.id === normalizedQuery);
  if (exactMatch) return exactMatch;

  // Try ID prefix match (e.g., "2.1" matches "2.1.1", "2.1.2", etc.)
  const prefixMatch = sections.find(
    (s) => s.id.startsWith(query + '.') || s.id.startsWith(normalizedQuery + '.')
  );
  if (prefixMatch) return prefixMatch;

  // Try title match (case-insensitive, partial)
  const titleMatch = sections.find((s) => s.title.toLowerCase().includes(normalizedQuery));
  if (titleMatch) return titleMatch;

  return undefined;
}

export function filterSectionsByDepth(sections: Section[], maxDepth: number): Section[] {
  return sections.filter((s) => s.level <= maxDepth);
}

export function buildTOC(sections: Section[], maxDepth: number = 3): string {
  const filtered = filterSectionsByDepth(sections, maxDepth);

  return filtered
    .map((s) => {
      const indent = '  '.repeat(s.level - 1);
      return `${indent}${s.id} ${s.title} (p.${s.startPage})`;
    })
    .join('\n');
}
