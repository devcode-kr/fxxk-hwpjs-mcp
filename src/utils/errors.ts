export class HwpSpecError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HwpSpecError';
  }
}

export class DocumentNotFoundError extends HwpSpecError {
  constructor(documentId: string) {
    super(`Document not found: ${documentId}`, 'DOCUMENT_NOT_FOUND', { documentId });
    this.name = 'DocumentNotFoundError';
  }
}

export class SectionNotFoundError extends HwpSpecError {
  constructor(documentId: string, sectionQuery: string) {
    super(`Section not found: ${sectionQuery} in ${documentId}`, 'SECTION_NOT_FOUND', {
      documentId,
      sectionQuery,
    });
    this.name = 'SectionNotFoundError';
  }
}

export class TableNotFoundError extends HwpSpecError {
  constructor(documentId: string, tableQuery: string) {
    super(`Table not found: ${tableQuery} in ${documentId}`, 'TABLE_NOT_FOUND', {
      documentId,
      tableQuery,
    });
    this.name = 'TableNotFoundError';
  }
}

export class PdfParseError extends HwpSpecError {
  constructor(filename: string, originalError?: Error) {
    super(`Failed to parse PDF: ${filename}`, 'PDF_PARSE_ERROR', {
      filename,
      originalError: originalError?.message,
    });
    this.name = 'PdfParseError';
  }
}

export class CacheError extends HwpSpecError {
  constructor(operation: string, originalError?: Error) {
    super(`Cache operation failed: ${operation}`, 'CACHE_ERROR', {
      operation,
      originalError: originalError?.message,
    });
    this.name = 'CacheError';
  }
}

export function formatErrorForUser(error: unknown): string {
  if (error instanceof HwpSpecError) {
    return `[${error.code}] ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
