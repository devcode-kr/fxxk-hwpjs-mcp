# HWP Spec MCP Server

HWP/HWPX 규격 PDF 문서를 조회하기 위한 MCP (Model Context Protocol) 서버입니다.

## 설치

```bash
npm install
npm run build
```

## PDF 파일 설정

`specs/` 폴더에 다음 PDF 파일들을 넣어주세요:

| ID | 파일명 |
|----|--------|
| hwp5 | 한글문서파일형식_5.0_revision1.3.pdf |
| hwp3 | 한글문서파일형식3.0_HWPML_revision1.2.pdf |
| formula | 한글문서파일형식_수식_revision1.3.pdf |
| chart | 한글문서파일형식_차트_revision1.2.pdf |
| dist | 한글문서파일형식_배포용문서_revision1.2.pdf |

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
      "command": "node",
      "args": ["/path/to/hwp-spec-mcp/dist/index.js"],
      "env": {
        "HWP_SPECS_DIR": "/path/to/specs"
      }
    }
  }
}
```

## Tools

### search_spec
규격 문서에서 키워드 검색

```
query: 검색어 (필수)
document: hwp5 | hwp3 | formula | chart | dist (선택, 생략시 전체 검색)
```

### get_section
특정 섹션의 내용 조회

```
document: hwp5 | hwp3 | formula | chart | dist (필수)
section: 섹션 번호 또는 제목 (예: "2.1.3" 또는 "FileHeader")
```

### get_table
문서 내 테이블 조회

```
document: hwp5 | hwp3 | formula | chart | dist (필수)
table_name: 테이블 이름 또는 번호
```

### list_sections
문서의 전체 섹션 목록 조회

```
document: hwp5 | hwp3 | formula | chart | dist (필수)
depth: 목차 깊이 (기본값: 2)
```

## Resources

각 문서의 목차를 리소스로 제공합니다:

- `spec://hwp5/toc` - HWP 5.0 규격 목차
- `spec://hwp3/toc` - HWP 3.0 HWPML 목차
- `spec://formula/toc` - 수식 규격 목차
- `spec://chart/toc` - 차트 규격 목차
- `spec://dist/toc` - 배포용 문서 목차

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
