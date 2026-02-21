export type DocumentId = 'hwp3' | 'hwp5' | 'formula' | 'chart' | 'dist';

export interface DocumentInfo {
  id: DocumentId;
  filename: string;
  description: string;
}

export const DOCUMENTS: Record<DocumentId, DocumentInfo> = {
  hwp3: {
    id: 'hwp3',
    filename: 'hwp-v3.pdf',
    description: 'HWP 3.0 규격',
  },
  hwp5: {
    id: 'hwp5',
    filename: 'hwp-v5.pdf',
    description: 'HWP 5.0 규격',
  },
  formula: {
    id: 'formula',
    filename: 'formula.pdf',
    description: '수식 규격',
  },
  chart: {
    id: 'chart',
    filename: 'chart.pdf',
    description: '차트 규격',
  },
  dist: {
    id: 'dist',
    filename: 'dist.pdf',
    description: '배포용 문서 규격',
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
