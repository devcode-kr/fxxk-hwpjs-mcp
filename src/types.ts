export type DocumentId = 'hwp5' | 'hwp3' | 'formula' | 'chart' | 'dist';

export interface DocumentInfo {
  id: DocumentId;
  filename: string;
  description: string;
}

export const DOCUMENTS: Record<DocumentId, DocumentInfo> = {
  hwp5: {
    id: 'hwp5',
    filename: '한글문서파일형식_5.0_revision1.3.pdf',
    description: 'HWP 5.0 규격',
  },
  hwp3: {
    id: 'hwp3',
    filename: '한글문서파일형식3.0_HWPML_revision1.2.pdf',
    description: 'HWP 3.0 HWPML',
  },
  formula: {
    id: 'formula',
    filename: '한글문서파일형식_수식_revision1.3.pdf',
    description: '수식 규격',
  },
  chart: {
    id: 'chart',
    filename: '한글문서파일형식_차트_revision1.2.pdf',
    description: '차트 규격',
  },
  dist: {
    id: 'dist',
    filename: '한글문서파일형식_배포용문서_revision1.2.pdf',
    description: '배포용 문서',
  },
};

export interface Section {
  id: string;
  title: string;
  level: number;
  startPage: number;
  endPage: number;
  content?: string;
}

export interface Table {
  id: string;
  name: string;
  page: number;
  rows: string[][];
}

export interface DocumentIndex {
  metadata: {
    filename: string;
    hash: string;
    indexedAt: string;
    pageCount: number;
  };
  sections: Section[];
  tables: Table[];
  pageTexts: string[];
}

export interface SearchResult {
  document: DocumentId;
  section: Section;
  matches: Array<{
    text: string;
    page: number;
    context: string;
  }>;
}
