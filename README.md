# HWP Spec MCP / OpenClaw Skill

HWP/HWPX 규격 PDF 문서를 AI가 필요할 때 조회할 수 있도록 도와주는 도구입니다.  
**MCP 서버** (Claude Desktop / Claude Code)와 **OpenClaw Skill** (CLI 래퍼) 두 가지 방식을 지원합니다.

---

## 목차

- [설치](#설치)
- [PDF 파일 설정](#pdf-파일-설정)
- [OpenClaw Skill (권장)](#openclaw-skill-권장)
- [시맨틱 검색 설정 (Gemini + Qdrant)](#시맨틱-검색-설정-gemini--qdrant)
- [MCP 서버 (Claude Desktop / Claude Code)](#mcp-서버-claude-desktop--claude-code)
- [도구 레퍼런스](#도구-레퍼런스)
- [개발](#개발)

---

## 설치

```bash
git clone https://github.com/devcode-kr/fxxk-hwpjs-mcp.git
cd fxxk-hwpjs-mcp
npm install
npm run build
```

---

## PDF 파일 설정

`specs/` 폴더(또는 `HWP_SPECS_DIR` 환경변수로 지정한 경로)에 다음 파일명으로 PDF를 넣으세요.

| ID      | 파일명         | 설명            |
|---------|----------------|-----------------|
| hwp3    | hwp-v3.pdf     | HWP 3.0 규격    |
| hwp5    | hwp-v5.pdf     | HWP 5.0 규격    |
| formula | formula.pdf    | 수식 규격       |
| chart   | chart.pdf      | 차트 규격       |
| dist    | dist.pdf       | 배포용 문서 규격|

> **HWPX 안내**: HWPX는 KS X 6101 유료 표준이므로 포함되지 않습니다.  
> HWPX 파일은 ZIP 구조이므로 확장자를 `.zip`으로 변경하여 직접 분석할 수 있습니다.

---

## OpenClaw Skill (권장)

OpenClaw 환경에서는 MCP 프로토콜 대신 **CLI 래퍼 Skill**로 사용합니다.  
토큰 낭비 없이 필요한 스펙만 그때그때 조회할 수 있습니다.

### Skill 파일 위치

```
~/.openclaw/workspace/skills/hwp-spec/SKILL.md
```

### 환경 변수

| 변수            | 기본값                                | 설명                        |
|-----------------|---------------------------------------|-----------------------------|
| `HWP_SPECS_DIR` | `./specs`                             | PDF 파일 디렉토리 경로      |
| `HWP_CACHE_DIR` | `./cache`                             | 파싱 캐시 저장 경로         |
| `QDRANT_URL`    | `http://localhost:6333`               | Qdrant 서버 URL             |
| `GEMINI_API_KEY`| (없음)                                | Gemini API 키 (시맨틱 검색용)|

### CLI 명령어

```bash
# 환경 변수 설정
export HWP_SPECS_DIR=/path/to/specs
export QDRANT_URL=http://localhost:30333
export GEMINI_API_KEY=your_api_key

CLI=node /path/to/fxxk-hwpjs-mcp/dist/cli.js
```

#### 키워드 검색 (exact match)
```bash
$CLI search "FileHeader" [--doc hwp5]
$CLI search "문단 모양" --doc hwp5
```

#### 자연어 시맨틱 검색 (Gemini + Qdrant)
```bash
$CLI semantic "문단 배경색 설정 방법" [--doc hwp5] [--limit 5]
$CLI semantic "표 셀 병합 구조"
```

#### 섹션 내용 조회
```bash
$CLI section hwp5 "3.2.1"
$CLI section hwp5 "문서 정보"
```

#### 테이블 조회
```bash
$CLI table hwp5 "표 1"
```

#### 목차 조회
```bash
$CLI toc hwp5 [--depth 3]
$CLI toc hwp3
```

#### 벡터 인덱스 생성 (시맨틱 검색 전 필수)
```bash
$CLI index               # 전체 문서 인덱싱
$CLI index --doc hwp5    # 특정 문서만
$CLI index --force       # 강제 재인덱싱
```

---

## 시맨틱 검색 설정 (Gemini + Qdrant)

자연어로 HWP 스펙을 검색하려면 Qdrant 벡터 DB와 Gemini Embedding이 필요합니다.

### 1. Qdrant 배포 (Kubernetes)

프로젝트에 포함된 Kubernetes YAML을 사용합니다:

```bash
# claw-support 네임스페이스에 Qdrant 배포
kubectl apply -f k8s/claw-support/namespace.yaml
kubectl apply -f k8s/claw-support/qdrant.yaml

# 배포 확인
kubectl get pods -n claw-support
kubectl get svc -n claw-support
```

배포 후 접근 방법:
- **클러스터 내부**: `http://qdrant.claw-support.svc.cluster.local:6333`
- **로컬 접근 (NodePort)**: `http://<node-ip>:30333`

### 2. Gemini API 키 설정

```bash
export GEMINI_API_KEY=your_gemini_api_key
```

Google AI Studio에서 API 키 발급: https://aistudio.google.com/app/apikey

### 3. 벡터 인덱스 생성

Qdrant 배포 후 최초 1회 실행합니다.  
PDF당 약 2~5분 소요 (이후 캐시에서 즉시 로드).

```bash
export HWP_SPECS_DIR=/path/to/specs
export QDRANT_URL=http://localhost:30333
export GEMINI_API_KEY=your_api_key

# 전체 문서 인덱싱
node dist/cli.js index

# 특정 문서만
node dist/cli.js index --doc hwp5
```

### 4. 시맨틱 검색 테스트

```bash
node dist/cli.js semantic "글자 모양의 색상 속성" --doc hwp5
node dist/cli.js semantic "표 셀 테두리 설정"
```

---

## MCP 서버 (Claude Desktop / Claude Code)

OpenClaw가 아닌 환경에서 MCP 프로토콜로 사용할 때 설정합니다.

### Claude Desktop

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "hwp-spec": {
      "command": "node",
      "args": ["/path/to/fxxk-hwpjs-mcp/dist/index.js"],
      "env": {
        "HWP_SPECS_DIR": "/path/to/specs",
        "QDRANT_URL": "http://localhost:6333",
        "GEMINI_API_KEY": "your_api_key"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add hwp-spec -- node /path/to/fxxk-hwpjs-mcp/dist/index.js
```

또는 `.claude/settings.json`:

```json
{
  "mcpServers": {
    "hwp-spec": {
      "command": "node",
      "args": ["/path/to/fxxk-hwpjs-mcp/dist/index.js"],
      "env": {
        "HWP_SPECS_DIR": "/path/to/specs",
        "QDRANT_URL": "http://localhost:6333",
        "GEMINI_API_KEY": "your_api_key"
      }
    }
  }
}
```

---

## 도구 레퍼런스

### `search_spec` / `search`
키워드로 규격 문서 전문 검색 (exact match)

| 파라미터   | 필수 | 설명                                           |
|-----------|------|------------------------------------------------|
| `query`   | ✅   | 검색어                                         |
| `document`| ❌   | `hwp3` \| `hwp5` \| `formula` \| `chart` \| `dist` (생략 시 전체) |

### `semantic_search` / `semantic`
자연어로 의미 기반 검색 (Gemini Embedding + Qdrant)

| 파라미터   | 필수 | 설명                                           |
|-----------|------|------------------------------------------------|
| `query`   | ✅   | 자연어 검색어                                  |
| `document`| ❌   | 대상 문서 (생략 시 전체)                       |
| `limit`   | ❌   | 결과 개수 (기본 5, 최대 20)                    |

### `get_section` / `section`
특정 섹션 내용 조회

| 파라미터   | 필수 | 설명                                              |
|-----------|------|---------------------------------------------------|
| `document`| ✅   | 대상 문서                                         |
| `section` | ✅   | 섹션 번호 또는 제목 (예: `"3.2.1"`, `"문서 정보"`) |

### `get_table` / `table`
문서 내 테이블 조회

| 파라미터     | 필수 | 설명             |
|-------------|------|------------------|
| `document`  | ✅   | 대상 문서        |
| `table_name`| ✅   | 테이블 이름/번호 |

### `list_sections` / `toc`
문서 목차 조회

| 파라미터   | 필수 | 설명                    |
|-----------|------|-------------------------|
| `document`| ✅   | 대상 문서               |
| `depth`   | ❌   | 목차 깊이 (기본 2)      |

---

## Resources (MCP)

MCP 서버 모드에서 각 문서의 목차를 리소스로 제공합니다:

- `spec://hwp3/toc` — HWP 3.0 규격 목차
- `spec://hwp5/toc` — HWP 5.0 규격 목차
- `spec://formula/toc` — 수식 규격 목차
- `spec://chart/toc` — 차트 규격 목차
- `spec://dist/toc` — 배포용 문서 규격 목차

---

## 캐싱 구조

| 경로                | 내용                              |
|--------------------|-----------------------------------|
| `cache/<docId>.json`| PDF 파싱 결과 (섹션, 페이지 텍스트) |
| Qdrant Collection  | `hwp_spec` — 벡터 임베딩          |

- PDF 파일 MD5 해시가 변경되면 자동으로 캐시 재생성
- 벡터 인덱스는 `index --force`로 강제 재생성 가능

---

## 개발

```bash
npm run build      # TypeScript 빌드
npm run typecheck  # 타입 체크만
npm test           # 테스트 실행
```

---

## License

MIT
