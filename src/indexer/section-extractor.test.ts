import { describe, it, expect } from 'vitest';
import {
  extractSections,
  findSectionByIdOrTitle,
  filterSectionsByDepth,
  buildTOC,
} from './section-extractor.js';
import type { ParsedPDF } from './pdf-parser.js';
import type { Section } from '../types.js';

describe('section-extractor', () => {
  describe('extractSections', () => {
    it('should extract sections from parsed PDF', () => {
      const mockPdf: ParsedPDF = {
        filename: 'test.pdf',
        hash: 'abc123',
        pageCount: 3,
        pages: [
          {
            pageNumber: 1,
            text: '1. 소개\n내용1',
            lines: ['1. 소개', '내용1'],
          },
          {
            pageNumber: 2,
            text: '1.1 개요\n내용2\n1.2 범위\n내용3',
            lines: ['1.1 개요', '내용2', '1.2 범위', '내용3'],
          },
          {
            pageNumber: 3,
            text: '2. 파일구조\n내용4',
            lines: ['2. 파일구조', '내용4'],
          },
        ],
      };

      const sections = extractSections(mockPdf);

      expect(sections.length).toBe(4);
      expect(sections[0]).toMatchObject({
        id: '1',
        title: '소개',
        level: 1,
        startPage: 1,
      });
      expect(sections[1]).toMatchObject({
        id: '1.1',
        title: '개요',
        level: 2,
        startPage: 2,
      });
    });

    it('should handle empty PDF', () => {
      const mockPdf: ParsedPDF = {
        filename: 'empty.pdf',
        hash: 'abc123',
        pageCount: 0,
        pages: [],
      };

      const sections = extractSections(mockPdf);
      expect(sections).toEqual([]);
    });
  });

  describe('findSectionByIdOrTitle', () => {
    const sections: Section[] = [
      { id: '1', title: '소개', level: 1, startPage: 1, endPage: 5 },
      { id: '1.1', title: '개요', level: 2, startPage: 1, endPage: 3 },
      { id: '1.2', title: 'FileHeader', level: 2, startPage: 3, endPage: 5 },
      { id: '2', title: '파일구조', level: 1, startPage: 5, endPage: 10 },
    ];

    it('should find section by exact ID', () => {
      const result = findSectionByIdOrTitle(sections, '1.1');
      expect(result).toMatchObject({ id: '1.1', title: '개요' });
    });

    it('should find section by title (case-insensitive)', () => {
      const result = findSectionByIdOrTitle(sections, 'fileheader');
      expect(result).toMatchObject({ id: '1.2', title: 'FileHeader' });
    });

    it('should find section by partial title', () => {
      const result = findSectionByIdOrTitle(sections, '파일');
      expect(result).toMatchObject({ id: '2', title: '파일구조' });
    });

    it('should return undefined for non-existent section', () => {
      const result = findSectionByIdOrTitle(sections, 'nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('filterSectionsByDepth', () => {
    const sections: Section[] = [
      { id: '1', title: 'A', level: 1, startPage: 1, endPage: 10 },
      { id: '1.1', title: 'B', level: 2, startPage: 1, endPage: 5 },
      { id: '1.1.1', title: 'C', level: 3, startPage: 1, endPage: 3 },
      { id: '1.1.2', title: 'D', level: 3, startPage: 3, endPage: 5 },
      { id: '2', title: 'E', level: 1, startPage: 10, endPage: 20 },
    ];

    it('should filter to depth 1', () => {
      const result = filterSectionsByDepth(sections, 1);
      expect(result.length).toBe(2);
      expect(result.map((s) => s.id)).toEqual(['1', '2']);
    });

    it('should filter to depth 2', () => {
      const result = filterSectionsByDepth(sections, 2);
      expect(result.length).toBe(3);
      expect(result.map((s) => s.id)).toEqual(['1', '1.1', '2']);
    });
  });

  describe('buildTOC', () => {
    const sections: Section[] = [
      { id: '1', title: '소개', level: 1, startPage: 1, endPage: 10 },
      { id: '1.1', title: '개요', level: 2, startPage: 1, endPage: 5 },
      { id: '2', title: '파일구조', level: 1, startPage: 10, endPage: 20 },
    ];

    it('should build formatted TOC', () => {
      const toc = buildTOC(sections, 2);
      expect(toc).toContain('1 소개');
      expect(toc).toContain('1.1 개요');
      expect(toc).toContain('2 파일구조');
    });

    it('should indent based on level', () => {
      const toc = buildTOC(sections, 2);
      const lines = toc.split('\n');
      expect(lines[0]).toMatch(/^1 소개/);
      expect(lines[1]).toMatch(/^\s{2}1\.1 개요/);
    });
  });
});
