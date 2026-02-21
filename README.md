# HWP Spec MCP Server

HWP 규격 PDF 문서를 조회하기 위한 MCP (Model Context Protocol) 서버입니다.

## 설치

```bash
npm install
npm run build
```

## PDF 파일 설정

`specs/` 폴더에 다음 PDF 파일들을 넣어주세요:

| ID | 파일명 | 설명 |
|----|--------|------|
| hwp3 | hwp-v3.pdf | HWP 3.0 규격 |
| hwp5 | hwp-v5.pdf | HWP 5.0 규격 |
| formula | formula.pdf | 수식 규격 |
| chart | chart.pdf | 차트 규격 |
| dist | dist.pdf | 배포용 문서 규격 |

> **파일명 규칙**: 원본 PDF 파일을 위 표의 파일명으로 변경하여 `specs/` 폴더에 저장하세요.

### HWPX 형식 안내

HWPX(.hwpx)는 OWPML 규격 기반이며, **KS X 6101** 표준으로 등록되어 있습니다. 유료 문서이므로 이 MCP 서버에서는 지원하지 않습니다. HWPX 파일은 ZIP으로 압축된 XML 문서이므로, 확장자를 `.zip`으로 변경하여 직접 분석할 수 있습니다.

또는 환경 변수로 경로를 지정할 수 있습니다:
```bash
export HWP_SPECS_DIR=/path/to/your/specs
```

## 사용법

### MCP 서버 실행

```bash
npm start
# 또는
node dist/index.js
```

### Claude Desktop 설정

`claude_desktop_config.json`에 다음을 추가하세요:

```json
{
  "mcpServers": {
    "hwp-spec": {
      "command": "npx",
      "args": ["hwp-spec-mcp"],
      "env": {
        "HWP_SPECS_DIR": "/path/to/specs"
      }
    }
  }
}
```

### Claude Code 설정

`~/.claude/settings.json` 또는 프로젝트의 `.claude/settings.json`에 다음을 추가하세요:

```json
{
  "mcpServers": {
    "hwp-spec": {
      "command": "npx",
      "args": ["hwp-spec-mcp"],
      "env": {
        "HWP_SPECS_DIR": "/path/to/specs"
      }
    }
  }
}
```

또는 CLI에서 직접 추가할 수 있습니다:

```bash
claude mcp add hwp-spec -- npx hwp-spec-mcp
```

## Tools

### search_spec
규격 문서에서 키워드 검색

```
query: 검색어 (필수)
document: hwp3 | hwp5 | formula | chart | dist (선택, 생략시 전체 검색)
```

### get_section
특정 섹션의 내용 조회

```
document: hwp3 | hwp5 | formula | chart | dist (필수)
section: 섹션 번호 또는 제목 (예: "2.1.3" 또는 "FileHeader")
```

### get_table
문서 내 테이블 조회

```
document: hwp3 | hwp5 | formula | chart | dist (필수)
table_name: 테이블 이름 또는 번호
```

### list_sections
문서의 전체 섹션 목록 조회

```
document: hwp3 | hwp5 | formula | chart | dist (필수)
depth: 목차 깊이 (기본값: 2)
```

## Resources

각 문서의 목차를 리소스로 제공합니다:

- `spec://hwp3/toc` - HWP 3.0 규격 목차
- `spec://hwp5/toc` - HWP 5.0 규격 목차
- `spec://formula/toc` - 수식 규격 목차
- `spec://chart/toc` - 차트 규격 목차
- `spec://dist/toc` - 배포용 문서 규격 목차

## 개발

```bash
# 타입 체크
npm run typecheck

# 테스트
npm test

# 빌드
npm run build
```

## 캐싱

PDF 파일을 처음 파싱할 때 `cache/` 디렉토리에 JSON 인덱스 파일이 생성됩니다.
PDF 파일이 변경되면 (MD5 해시 비교) 자동으로 인덱스가 재생성됩니다.

## License

MIT
