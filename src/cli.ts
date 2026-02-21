#!/usr/bin/env node

/**
 * hwp-spec CLI - OpenClaw skill용 CLI 래퍼
 *
 * Usage:
 *   node dist/cli.js search <query> [--doc <docId>]
 *   node dist/cli.js section <doc> <section>
 *   node dist/cli.js table <doc> <table_name>
 *   node dist/cli.js toc <doc> [--depth <n>]
 */

import { searchSpec } from './tools/search-spec.js';
import { getSection } from './tools/get-section.js';
import { getTable } from './tools/get-table.js';
import { listSections } from './tools/list-sections.js';
import { semanticSearchSpec } from './tools/semantic-search.js';
import { indexDocument, indexAllDocuments } from './vector/doc-indexer.js';
import type { DocumentId } from './types.js';

const args = process.argv.slice(2);

function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(argv[i]);
    }
  }

  return { positional, flags };
}

function usage() {
  console.log(`hwp-spec CLI

Commands:
  search <query> [--doc hwp3-bin|hwp3-xml|hwp5|formula|chart|dist]
      HWP 규격 문서에서 키워드 검색 (exact match)

  semantic <query> [--doc <docId>] [--limit <n>]
      자연어 시맨틱 검색 (Gemini Embedding + Qdrant)

  index [--doc <docId>] [--force]
      문서 벡터 인덱스 생성 (전체 또는 특정 문서)

  section <doc> <section>
      특정 섹션 내용 조회 (예: section hwp5 "2.1.3")

  table <doc> <table_name>
      테이블 내용 조회 (예: table hwp5 "표 1")

  toc <doc> [--depth <n>]
      문서 목차 조회 (기본 depth: 2)

Documents:
  hwp3-bin  HWP 3.x 바이너리 파일 구조 (hwp-v3.pdf p.1~54)
  hwp3-xml  HWPML — HWP 3.x XML 구조 (hwp-v3.pdf p.55~122)
  hwp5      HWP 5.0 규격
  formula   수식 규격
  chart     차트 규격
  dist      배포용 문서

Environment:
  HWP_SPECS_DIR   PDF 파일 경로 (기본: ./specs)
  QDRANT_URL      Qdrant 서버 URL (기본: http://localhost:6333)
  GEMINI_API_KEY  Gemini API 키 (semantic/index 명령 필요)
`);
  process.exit(0);
}

async function main() {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    usage();
  }

  const command = args[0];
  const { positional, flags } = parseFlags(args.slice(1));

  try {
    let result: string;

    switch (command) {
      case 'search': {
        const query = positional[0];
        if (!query) {
          console.error('오류: 검색어를 입력하세요.\n  예: search "FileHeader" --doc hwp5');
          process.exit(1);
        }
        result = await searchSpec({
          query,
          document: flags.doc as DocumentId | undefined,
        });
        break;
      }

      case 'section': {
        const doc = positional[0];
        const section = positional[1];
        if (!doc || !section) {
          console.error('오류: 문서와 섹션을 입력하세요.\n  예: section hwp5 "2.1.3"');
          process.exit(1);
        }
        result = await getSection({
          document: doc as DocumentId,
          section,
        });
        break;
      }

      case 'table': {
        const doc = positional[0];
        const tableName = positional[1];
        if (!doc || !tableName) {
          console.error('오류: 문서와 테이블명을 입력하세요.\n  예: table hwp5 "표 1"');
          process.exit(1);
        }
        result = await getTable({
          document: doc as DocumentId,
          table_name: tableName,
        });
        break;
      }

      case 'toc': {
        const doc = positional[0];
        if (!doc) {
          console.error('오류: 문서를 입력하세요.\n  예: toc hwp5 --depth 3');
          process.exit(1);
        }
        const depth = flags.depth ? parseInt(flags.depth as string, 10) : 2;
        result = await listSections({
          document: doc as DocumentId,
          depth,
        });
        break;
      }

      case 'semantic': {
        const query = positional[0];
        if (!query) {
          console.error('오류: 검색어를 입력하세요.\n  예: semantic "문단 배경색 설정" --doc hwp5');
          process.exit(1);
        }
        const limit = flags.limit ? parseInt(flags.limit as string, 10) : 5;
        result = await semanticSearchSpec({
          query,
          document: flags.doc as DocumentId | undefined,
          limit,
        });
        break;
      }

      case 'index': {
        const docId = flags.doc as DocumentId | undefined;
        const force = !!flags.force;
        if (docId) {
          await indexDocument(docId, force);
          result = `✅ '${docId}' 인덱싱 완료`;
        } else {
          await indexAllDocuments(force);
          result = '✅ 전체 문서 인덱싱 완료';
        }
        break;
      }

      default:
        console.error(`알 수 없는 명령어: ${command}`);
        usage();
    }

    console.log(result!);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`오류: ${message}`);
    process.exit(1);
  }
}

main();
