import type { ParsedPDF, ParsedPage } from './pdf-parser.js';
import type { Table } from '../types.js';

// HWP 스펙 PDF 표 캡션 형식: "표 N 제목" (줄 전체가 캡션)
// 예: "표 15 아이디 매핑 헤더", "표 43 문단 모양"
// ※ "(표 N 참조)" 같은 참조 표현은 줄 전체가 표 캡션이 아니므로 제외됨
const TABLE_CAPTION_PATTERN = /^표\s+(\d+(?:[-.]\d+)?)\s+(.{2,})$/;

interface TableCandidate {
  id: string;
  name: string;
  page: number;
  startLine: number;
  endLine: number;
}

export function extractTables(pdf: ParsedPDF): Table[] {
  const tables: Table[] = [];
  const candidates = findTableCandidates(pdf);

  for (const candidate of candidates) {
    const page = pdf.pages.find((p) => p.pageNumber === candidate.page);
    if (!page) continue;

    const rows = extractTableRows(page, candidate.startLine, candidate.endLine);
    if (rows.length > 0) {
      tables.push({
        id: candidate.id,
        name: candidate.name,
        page: candidate.page,
        rows,
      });
    }
  }

  return tables;
}

function findTableCandidates(pdf: ParsedPDF): TableCandidate[] {
  const candidates: TableCandidate[] = [];

  for (const page of pdf.pages) {
    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i];

      // Check for table caption: "표 N 제목" (줄 전체가 캡션이어야 함)
      const captionMatch = line.match(TABLE_CAPTION_PATTERN);
      if (captionMatch) {
        const id = `table-${captionMatch[1]}`;
        const name = captionMatch[2].trim();

        // Find table boundaries (heuristic: look for tabular content before caption)
        // HWP 스펙 PDF는 표 내용이 먼저 나오고 캡션이 아래에 위치
        const { startLine, endLine } = findTableBoundaries(page, i);

        candidates.push({
          id,
          name,
          page: page.pageNumber,
          startLine,
          endLine,
        });
      }
    }
  }

  return candidates;
}

function findTableBoundaries(
  page: ParsedPage,
  captionIndex: number
): { startLine: number; endLine: number } {
  // HWP 스펙 PDF는 표 내용이 먼저 나오고 캡션이 아래에 위치
  // 캡션 이전 행부터 역방향으로 표 내용을 찾음
  const endLine = captionIndex - 1;
  let startLine = endLine;

  for (let i = endLine; i >= 0; i--) {
    const line = page.lines[i];
    if (!line.trim()) continue; // 빈 줄 건너뜀
    if (looksLikeNewSection(line)) break;
    if (isTableRow(line)) {
      startLine = i;
    } else {
      // 헤더 행 (예: "자료형 길이(바이트) 설명")도 포함
      if (startLine < endLine) break;
    }
  }

  return { startLine: Math.max(startLine, 0), endLine: Math.max(endLine, 0) };
}

function isTableRow(line: string): boolean {
  // Heuristics for detecting table rows:
  // 1. Contains multiple tab or multi-space separators
  // 2. Has structured data patterns

  const trimmed = line.trim();
  if (!trimmed) return false;

  // Check for tab-separated values
  if (trimmed.includes('\t')) return true;

  // Check for multiple spaces (common in PDF table extraction)
  const multiSpacePattern = /\s{2,}/g;
  const matches = trimmed.match(multiSpacePattern);
  if (matches && matches.length >= 1) return true;

  // Check for structured patterns (numbers, types, etc.)
  const hasStructuredData =
    /\b(UINT\d+|INT\d+|BYTE|WORD|DWORD|HWPUNIT|COLORREF|WCHAR|unsigned|signed)\b/i.test(trimmed);
  if (hasStructuredData) return true;

  return false;
}

function looksLikeNewSection(line: string): boolean {
  // Check if line looks like a new section heading
  return /^(\d+(?:\.\d+)*\.?)\s+\S/.test(line.trim());
}

function extractTableRows(page: ParsedPage, startLine: number, endLine: number): string[][] {
  const rows: string[][] = [];

  for (let i = startLine; i <= endLine && i < page.lines.length; i++) {
    const line = page.lines[i];
    if (!line.trim()) continue;

    // Split by tabs first, then by multiple spaces
    let cells: string[];
    if (line.includes('\t')) {
      cells = line.split('\t').map((c) => c.trim());
    } else {
      cells = line
        .split(/\s{2,}/)
        .map((c) => c.trim())
        .filter((c) => c);
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

export function findTableByNameOrId(tables: Table[], query: string): Table | undefined {
  const normalizedQuery = query.toLowerCase().trim();

  // Try exact ID match (e.g., "table-43")
  const idMatch = tables.find((t) => t.id.toLowerCase() === normalizedQuery);
  if (idMatch) return idMatch;

  // "표 N" or "표N" 형식 처리 (e.g., "표 43", "표43" → id "table-43")
  const koreanTableMatch = normalizedQuery.match(/^표\s*(\d+(?:[-.]\d+)?)$/);
  if (koreanTableMatch) {
    const num = koreanTableMatch[1];
    const numMatch = tables.find((t) => t.id === `table-${num}`);
    if (numMatch) return numMatch;
  }

  // Try plain number match (e.g., "43" matches "table-43")
  if (/^\d+(?:[-.]\d+)?$/.test(query)) {
    const numMatch = tables.find((t) => t.id === `table-${query}`);
    if (numMatch) return numMatch;
  }

  // Try name match (partial, case-insensitive)
  const nameMatch = tables.find((t) => t.name.toLowerCase().includes(normalizedQuery));
  if (nameMatch) return nameMatch;

  return undefined;
}

export function formatTable(table: Table): string {
  if (table.rows.length === 0) {
    return `Table: ${table.name} (empty)`;
  }

  const lines: string[] = [];
  lines.push(`Table ${table.id}: ${table.name} (page ${table.page})`);
  lines.push('');

  // Calculate column widths
  const colWidths: number[] = [];
  for (const row of table.rows) {
    for (let i = 0; i < row.length; i++) {
      colWidths[i] = Math.max(colWidths[i] || 0, row[i].length);
    }
  }

  // Format rows
  for (const row of table.rows) {
    const formattedCells = row.map((cell, i) => cell.padEnd(colWidths[i] || 0));
    lines.push('| ' + formattedCells.join(' | ') + ' |');
  }

  return lines.join('\n');
}
