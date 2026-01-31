import { describe, it, expect } from 'vitest';
import {
  HwpSpecError,
  DocumentNotFoundError,
  SectionNotFoundError,
  TableNotFoundError,
  formatErrorForUser,
} from './errors.js';

describe('errors', () => {
  describe('HwpSpecError', () => {
    it('should create error with code and details', () => {
      const error = new HwpSpecError('Test error', 'TEST_CODE', { key: 'value' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ key: 'value' });
      expect(error.name).toBe('HwpSpecError');
    });
  });

  describe('DocumentNotFoundError', () => {
    it('should include document ID in message', () => {
      const error = new DocumentNotFoundError('hwp5');

      expect(error.message).toContain('hwp5');
      expect(error.code).toBe('DOCUMENT_NOT_FOUND');
      expect(error.details).toEqual({ documentId: 'hwp5' });
    });
  });

  describe('SectionNotFoundError', () => {
    it('should include document ID and section query', () => {
      const error = new SectionNotFoundError('hwp5', '2.1.3');

      expect(error.message).toContain('hwp5');
      expect(error.message).toContain('2.1.3');
      expect(error.code).toBe('SECTION_NOT_FOUND');
    });
  });

  describe('TableNotFoundError', () => {
    it('should include document ID and table query', () => {
      const error = new TableNotFoundError('hwp5', 'table-1');

      expect(error.message).toContain('hwp5');
      expect(error.message).toContain('table-1');
      expect(error.code).toBe('TABLE_NOT_FOUND');
    });
  });

  describe('formatErrorForUser', () => {
    it('should format HwpSpecError with code', () => {
      const error = new HwpSpecError('Something went wrong', 'ERR_CODE');
      const formatted = formatErrorForUser(error);

      expect(formatted).toBe('[ERR_CODE] Something went wrong');
    });

    it('should format regular Error', () => {
      const error = new Error('Regular error');
      const formatted = formatErrorForUser(error);

      expect(formatted).toBe('Regular error');
    });

    it('should format non-Error values', () => {
      const formatted = formatErrorForUser('string error');
      expect(formatted).toBe('string error');
    });
  });
});
