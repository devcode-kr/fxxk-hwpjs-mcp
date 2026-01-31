#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  searchSpec,
  searchSpecSchema,
  getSection,
  getSectionSchema,
  getTable,
  getTableSchema,
  listSections,
  listSectionsSchema,
} from './tools/index.js';
import { TOC_RESOURCES, getTocResource } from './resources/toc.js';

const server = new Server(
  {
    name: 'hwp-spec-mcp',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_spec',
        description: 'HWP 규격 문서에서 키워드로 검색',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '검색어' },
            document: {
              type: 'string',
              enum: ['hwp5', 'hwp3', 'formula', 'chart', 'dist'],
              description: '대상 문서 (생략시 전체)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_section',
        description: '규격 문서의 특정 섹션 내용 조회',
        inputSchema: {
          type: 'object',
          properties: {
            document: {
              type: 'string',
              enum: ['hwp5', 'hwp3', 'formula', 'chart', 'dist'],
              description: '대상 문서',
            },
            section: {
              type: 'string',
              description: '섹션 번호 또는 제목 (예: "2.1.3" 또는 "FileHeader")',
            },
          },
          required: ['document', 'section'],
        },
      },
      {
        name: 'get_table',
        description: '규격 문서의 특정 테이블 조회',
        inputSchema: {
          type: 'object',
          properties: {
            document: {
              type: 'string',
              enum: ['hwp5', 'hwp3', 'formula', 'chart', 'dist'],
              description: '대상 문서',
            },
            table_name: {
              type: 'string',
              description: '테이블 이름 또는 번호',
            },
          },
          required: ['document', 'table_name'],
        },
      },
      {
        name: 'list_sections',
        description: '규격 문서의 섹션 목록 조회',
        inputSchema: {
          type: 'object',
          properties: {
            document: {
              type: 'string',
              enum: ['hwp5', 'hwp3', 'formula', 'chart', 'dist'],
              description: '대상 문서',
            },
            depth: {
              type: 'number',
              description: '목차 깊이 (기본값: 2)',
            },
          },
          required: ['document'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'search_spec': {
        const parsed = searchSpecSchema.parse(args);
        result = await searchSpec(parsed);
        break;
      }
      case 'get_section': {
        const parsed = getSectionSchema.parse(args);
        result = await getSection(parsed);
        break;
      }
      case 'get_table': {
        const parsed = getTableSchema.parse(args);
        result = await getTable(parsed);
        break;
      }
      case 'list_sections': {
        const parsed = listSectionsSchema.parse(args);
        result = await listSections(parsed);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `오류: ${message}` }],
      isError: true,
    };
  }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: TOC_RESOURCES,
  };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    const content = await getTocResource(uri);

    if (content === null) {
      throw new Error(`Unknown resource: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: content,
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`리소스 읽기 오류: ${message}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HWP Spec MCP Server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
