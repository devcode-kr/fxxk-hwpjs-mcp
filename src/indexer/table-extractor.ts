import type { ParsedPDF, ParsedPage } from './pdf-parser.js';
import type { Table } from '../types.js';

// Pattern for table headers like "표 1", "Table 1", "[표 1-1]"
const TABLE_HEADER_PATTERN = /(?:표|Table|테이블)\s*(\d+(?:[-.]\d+)?)/i;
const TABLE_CAPTION_PATTERN = /^\[?(?:표|Table)\s*(\d+(?:[-.]\d+)?)\]?\s*[:.]\s*(.+)/i;

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

      // Check for table caption
      const captionMatch = line.match(TABLE_CAPTION_PATTERN);
      if (captionMatch) {
        const id = `table-${captionMatch[1]}`;
        const name = captionMatch[2].trim();

        // Find table boundaries (heuristic: look for tabular content after caption)
        const { startLine, endLine } = findTableBoundaries(page, i);

        candidates.push({
          id,
          name,
          page: page.pageNumber,
          startLine,
          endLine,
        });
        continue;
      }

      // Check for simple table header
      const headerMatch = line.match(TABLE_HEADER_PATTERN);
      if (headerMatch && !captionMatch) {
        const id = `table-${headerMatch[1]}`;
        const name = line.trim();

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
  // Start from the line after caption
  const startLine = captionIndex + 1;

  // Look for table end (empty line or new section/table)
  let endLine = startLine;
  for (let i = startLine; i < page.lines.length; i++) {
    const line = page.lines[i];

    // Check if this looks like table content
    if (isTableRow(line)) {
      endLine = i;
    } else if (line.trim() === '') {
      // Empty line might be table separator, continue looking
      if (i + 1 < page.lines.length && isTableRow(page.lines[i + 1])) {
        continue;
      } else {
        break;
      }
    } else if (looksLikeNewSection(line)) {
      break;
    }
  }

  return { startLine, endLine: Math.max(endLine, startLine) };
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

  // Try exact ID match
  const idMatch = tables.find((t) => t.id.toLowerCase() === normalizedQuery);
  if (idMatch) return idMatch;

  // Try number match (e.g., "1" matches "table-1")
  if (/^\d+(?:[-.]\d+)?$/.test(query)) {
    const numMatch = tables.find((t) => t.id.includes(query));
    if (numMatch) return numMatch;
  }

  // Try name match (partial)
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
