import { describe, it, expect } from 'vitest';
import { extractTables, findTableByNameOrId, formatTable } from './table-extractor.js';
import type { ParsedPDF } from './pdf-parser.js';
import type { Table } from '../types.js';

describe('table-extractor', () => {
  describe('extractTables', () => {
    it('should extract tables from parsed PDF', () => {
      const mockPdf: ParsedPDF = {
        filename: 'test.pdf',
        hash: 'abc123',
        pageCount: 2,
        pages: [
          {
            pageNumber: 1,
            text: '표 1: 파일 헤더\n필드명  타입  설명\nVersion  UINT32  버전',
            lines: ['표 1: 파일 헤더', '필드명  타입  설명', 'Version  UINT32  버전'],
          },
        ],
      };

      const tables = extractTables(mockPdf);

      expect(tables.length).toBeGreaterThanOrEqual(1);
      if (tables.length > 0) {
        expect(tables[0].name).toContain('파일 헤더');
      }
    });

    it('should handle PDF without tables', () => {
      const mockPdf: ParsedPDF = {
        filename: 'empty.pdf',
        hash: 'abc123',
        pageCount: 1,
        pages: [
          {
            pageNumber: 1,
            text: '일반 텍스트 내용',
            lines: ['일반 텍스트 내용'],
          },
        ],
      };

      const tables = extractTables(mockPdf);
      expect(tables).toEqual([]);
    });
  });

  describe('findTableByNameOrId', () => {
    const tables: Table[] = [
      { id: 'table-1', name: '파일 헤더', page: 1, rows: [['a', 'b']] },
      { id: 'table-2', name: '문서 정보', page: 2, rows: [['c', 'd']] },
      { id: 'table-1-1', name: '상세 구조', page: 3, rows: [['e', 'f']] },
    ];

    it('should find table by ID', () => {
      const result = findTableByNameOrId(tables, 'table-1');
      expect(result).toMatchObject({ id: 'table-1', name: '파일 헤더' });
    });

    it('should find table by number', () => {
      const result = findTableByNameOrId(tables, '2');
      expect(result).toMatchObject({ id: 'table-2' });
    });

    it('should find table by name (partial)', () => {
      const result = findTableByNameOrId(tables, '문서');
      expect(result).toMatchObject({ name: '문서 정보' });
    });

    it('should return undefined for non-existent table', () => {
      const result = findTableByNameOrId(tables, 'nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('formatTable', () => {
    it('should format table as text', () => {
      const table: Table = {
        id: 'table-1',
        name: '테스트 테이블',
        page: 5,
        rows: [
          ['Column A', 'Column B'],
          ['Value 1', 'Value 2'],
        ],
      };

      const formatted = formatTable(table);

      expect(formatted).toContain('table-1');
      expect(formatted).toContain('테스트 테이블');
      expect(formatted).toContain('page 5');
      expect(formatted).toContain('Column A');
      expect(formatted).toContain('Value 1');
    });

    it('should handle empty table', () => {
      const table: Table = {
        id: 'table-empty',
        name: '빈 테이블',
        page: 1,
        rows: [],
      };

      const formatted = formatTable(table);
      expect(formatted).toContain('empty');
    });
  });
});
