# fxxk-hwpjs-mcp

HWP/HWPX 규격 PDF 문서를 AI가 필요할 때 조회할 수 있도록 도와주는 도구입니다.  
**MCP 서버** (Claude Desktop / Claude Code)와 **OpenClaw Skill** (CLI 래퍼) 두 가지 방식을 지원합니다.

---

## 목차

- [설치](#설치)
- [PDF 파일 설정](#pdf-파일-설정)
- [OpenClaw Skill (권장)](#openclaw-skill-권장)
- [시맨틱 검색 설정 (Gemini + Qdrant)](#시맨틱-검색-설정-gemini--qdrant)
- [MCP 서버](#mcp-서버-claude-desktop--claude-code)
- [도구 레퍼런스](#도구-레퍼런스)
- [주의사항](#주의사항)
- [작업 이력](#작업-이력)

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

| 문서 ID     | 파일명       | 설명                                        | 페이지 범위  |
|------------|--------------|---------------------------------------------|-------------|
| `hwp3-bin` | hwp-v3.pdf   | HWP 3.x **바이너리** 파일 구조              | p.1 ~ 54    |
| `hwp3-xml` | hwp-v3.pdf   | **HWPML** — HWP 3.x XML(SGML) 구조         | p.55 ~ 122  |
| `hwp5`     | hwp-v5.pdf   | HWP 5.0 규격                                | 전체        |
| `formula`  | formula.pdf  | 수식 규격                                   | 전체        |
| `chart`    | chart.pdf    | 차트 규격                                   | 전체        |
| `dist`     | dist.pdf     | 배포용 문서 규격 (암호화/DRM 구조)          | 전체        |

> **`hwp3-bin` vs `hwp3-xml`**: `hwp-v3.pdf` 파일 하나에 두 문서가 합쳐져 있습니다.  
> 앞부분(p.1~54)은 HWP 3.x 바이너리 포맷, 뒷부분(p.55~122)은 HWPML(XML) 구조입니다.  
> 같은 파일을 공유하지만 서로 다른 docId로 독립적으로 인덱싱/조회됩니다.

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

| 변수             | 기본값                  | 설명                         |
|-----------------|------------------------|------------------------------|
| `HWP_SPECS_DIR` | `./specs`              | PDF 파일 디렉토리 경로       |
| `HWP_CACHE_DIR` | `./cache`              | 파싱 캐시 저장 경로          |
| `QDRANT_URL`    | `http://localhost:6333`| Qdrant 서버 URL              |
| `GEMINI_API_KEY`| (없음)                 | Gemini API 키 (시맨틱 검색용)|

### CLI 명령어

```bash
export HWP_SPECS_DIR=/path/to/specs
export QDRANT_URL=http://localhost:30333
export GEMINI_API_KEY=your_api_key

CLI="node /path/to/fxxk-hwpjs-mcp/dist/cli.js"
```

#### 목차 조회 (toc)

```bash
$CLI toc hwp5               # 기본 depth 2
$CLI toc hwp3-bin --depth 3
$CLI toc hwp3-xml
```

#### 키워드 검색 (search, exact match)

```bash
$CLI search "FileHeader" --doc hwp5
$CLI search "HWPTAG_PARA_SHAPE"          # 전체 문서 검색
$CLI search "하이퍼링크" --doc hwp3-bin
```

#### 섹션 내용 조회 (section)

```bash
$CLI section hwp5 "4.2.6"          # 섹션 번호
$CLI section hwp5 "글자 모양"       # 섹션 제목 부분 매칭
$CLI section hwp3-bin "3.1"
$CLI section hwp3-xml "5.16"       # HWPML 머리말/꼬리말
```

#### 표 조회 (table)

```bash
$CLI table hwp5 "표 43"            # 한글 표 번호
$CLI table hwp5 "43"               # 숫자만도 가능
$CLI table hwp5 "글자 모양"        # 이름 부분 매칭
```

#### 자연어 시맨틱 검색 (semantic)

> **사전 조건**: Qdrant 실행 중 + 벡터 인덱스 생성 완료

```bash
$CLI semantic "문단 들여쓰기 저장 방식" --doc hwp5
$CLI semantic "이미지 그림 삽입 데이터 구조"   # 전체 문서 교차 검색
$CLI semantic "HWPML 문단 속성 엘리먼트" --doc hwp3-xml
$CLI semantic "암호화 배포용 문서" --doc dist
$CLI semantic "How to store paragraph indent" --doc hwp5  # 영어도 가능
```

#### 벡터 인덱스 생성 (index)

```bash
$CLI index                       # 전체 문서 인덱싱
$CLI index --doc hwp5            # 특정 문서만
$CLI index --doc hwp3-bin
$CLI index --doc hwp3-xml
$CLI index --force               # 강제 재인덱싱
```

---

## 시맨틱 검색 설정 (Gemini + Qdrant)

### 임베딩 모델

| 항목           | 값                          |
|---------------|----------------------------|
| 모델           | `gemini-embedding-001`      |
| API 버전       | `v1beta`                   |
| 벡터 차원      | **3072**                   |
| 언어           | 다국어 (한국어, 영어 등)    |
| API 키 발급    | https://aistudio.google.com/app/apikey |

### 1. Qdrant 배포 (Kubernetes)

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/qdrant.yaml

# 배포 확인
kubectl get pods -n openclaw-support
kubectl get svc -n openclaw-support
```

| 접근 방법          | 주소                                              |
|-------------------|--------------------------------------------------|
| 클러스터 내부      | `http://qdrant.openclaw-support.svc.cluster.local:6333` |
| 외부 (NodePort)   | `http://<node-ip>:30333`                         |

### 2. 벡터 인덱스 생성

최초 1회 실행 (문서당 약 2~5분). 이후 Qdrant에 영구 저장됩니다.

```bash
export HWP_SPECS_DIR=/path/to/specs
export QDRANT_URL=http://localhost:30333
export GEMINI_API_KEY=your_api_key

node dist/cli.js index
```

| docId       | 청크 수 (참고) |
|------------|---------------|
| `hwp3-bin` | ~149          |
| `hwp3-xml` | ~178          |
| `hwp5`     | ~208          |
| `formula`  | ~38           |
| `chart`    | ~131          |
| `dist`     | ~17           |

---

## MCP 서버 (Claude Desktop / Claude Code)

### Claude Desktop

`claude_desktop_config.json`:

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

---

## 도구 레퍼런스

### `search` / `search_spec`
키워드 exact match 검색. 대소문자 구분 없음.

| 파라미터   | 필수 | 설명                                     |
|-----------|------|------------------------------------------|
| `query`   | ✅   | 검색어 (HWPTAG 상수, 한글 키워드 등)     |
| `document`| ❌   | docId (생략 시 전체 문서 검색)           |

### `semantic` / `semantic_search`
자연어 의미 기반 검색 (Gemini Embedding + Qdrant Cosine).

| 파라미터   | 필수 | 설명                             |
|-----------|------|----------------------------------|
| `query`   | ✅   | 자연어 질문 (한국어/영어 모두 가능) |
| `document`| ❌   | 대상 docId (생략 시 전체 교차 검색) |
| `limit`   | ❌   | 결과 개수 (기본 5, 최대 20)      |

### `section` / `get_section`
특정 섹션 전체 내용 조회.

| 파라미터   | 필수 | 설명                                          |
|-----------|------|-----------------------------------------------|
| `document`| ✅   | docId                                         |
| `section` | ✅   | 섹션 번호(`"4.2.6"`) 또는 제목 부분(`"글자 모양"`) |

### `table` / `get_table`
표 내용 조회. 번호/이름 부분 매칭 지원.

| 파라미터     | 필수 | 설명                                          |
|-------------|------|-----------------------------------------------|
| `document`  | ✅   | docId                                         |
| `table_name`| ✅   | `"표 43"`, `"43"`, `"글자 모양"` 모두 가능   |

### `toc` / `list_sections`
문서 목차 조회.

| 파라미터   | 필수 | 설명                    |
|-----------|------|-------------------------|
| `document`| ✅   | docId                   |
| `depth`   | ❌   | 목차 깊이 (기본 2)      |

---

## 주의사항

### `hwp3-bin` vs `hwp3-xml` 구분

`hwp-v3.pdf` 파일은 하나지만 내용이 **두 개의 독립적인 문서**로 구성되어 있습니다:

- **`hwp3-bin`** (p.1~54): HWP 3.x 바이너리 포맷 — offset 기반 구조체, 특수 문자 코드 등
- **`hwp3-xml`** (p.55~122): HWPML — XML/SGML 태그 기반의 HWP 문서 표현

두 문서는 섹션 번호가 각각 1부터 시작하므로, **반드시 올바른 docId를 지정**해야 합니다.  
`hwp3` docId는 더 이상 사용하지 않습니다.

```bash
# ❌ 예전 방식 (제거됨)
$CLI section hwp3 "3.1"

# ✅ 올바른 방식
$CLI section hwp3-bin "3.1"   # 바이너리 포맷 파일 인식 정보
$CLI section hwp3-xml "3"     # HWPML 루트 엘리먼트
```

### Gemini 임베딩 API

- `text-embedding-004`는 Google AI Studio 키에서 지원되지 않습니다.
- `gemini-embedding-001`(3072차원)을 `v1beta` endpoint로 사용합니다.
- API 키는 [Google AI Studio](https://aistudio.google.com/app/apikey)에서 발급하세요.

### PDF 파싱 한계

- **표(table) 조회**: PDF 텍스트 레이어 기반 파싱이므로 복잡한 다단 표는 행이 일부 누락될 수 있습니다.  
  표 내용이 필요할 때는 `section` 명령으로 해당 섹션 전체를 가져오는 것이 더 신뢰성이 높습니다.
- **PDF 폰트 인코딩**: 일부 PDF에서 한글이 PUA(Private Use Area) 유니코드로 파싱될 수 있습니다.  
  섹션 추출기는 이를 보정하도록 처리되어 있습니다.
- **TOC 페이지**: 점선(·····) 목차 페이지는 시맨틱 인덱싱에서 자동 제외됩니다.

### 벡터 인덱스

- Qdrant 컬렉션 이름: `hwp_spec`
- docId별로 독립 관리되므로 문서 하나만 재인덱싱해도 다른 문서에 영향 없음
- 재인덱싱 시 기존 데이터 자동 삭제 후 재업로드

---

## 캐싱 구조

| 경로                  | 내용                                   |
|----------------------|----------------------------------------|
| `cache/<docId>.json` | PDF 파싱 결과 (섹션/표/페이지 텍스트)  |
| Qdrant `hwp_spec`    | 벡터 임베딩 (docId 필드로 구분)        |

- PDF 파일 MD5 해시가 변경되면 자동으로 캐시 재생성
- 벡터 인덱스는 `index --force`로 강제 재생성

---

## 작업 이력

### v0.2.0 (2026-02-21)

#### 주요 변경

- **`hwp3` 분리**: `hwp3-bin` (바이너리, p.1~54) + `hwp3-xml` (HWPML, p.55~122)  
  `hwp-v3.pdf`가 두 개의 독립 문서를 포함하고 있어 섹션 번호 충돌 문제 해결
- **Gemini 임베딩 모델 변경**: `text-embedding-004` → `gemini-embedding-001` (3072차원)  
  Google AI Studio API 키에서 지원되는 모델로 변경, REST API 직접 호출 방식 채택

#### 섹션 추출 개선 (`section-extractor.ts`)

- **PDF PUA 유니코드 수정**: 일부 PDF에서 한글이 `U+F53A` 같은 PUA 영역으로 파싱될 때  
  `[가-힣]` 패턴 매칭 실패 → `[\u0080-\uFFFF]`로 확장해 모든 비ASCII 문자 허용  
  → `"1. 개요"`, `"3. 글 파일 구조"` 등 이전에 누락되던 최상위 섹션 복구
- **짧은 섹션 제목 허용**: `{3,}` → `{1,}` 완화 ("개요"(2글자) 같은 짧은 제목 지원)

#### 표 파싱 개선 (`table-extractor.ts`)

- **캡션 패턴 수정**: `"표 N: 제목"` (콜론 필수) → `"표 N 제목"` (실제 HWP 스펙 PDF 형식)
- **역방향 탐색**: HWP 스펙 PDF는 표 내용이 먼저 나오고 캡션이 아래에 위치  
  캡션 기준으로 위쪽을 역방향 탐색하도록 변경
- **쿼리 파싱**: `"표 43"`, `"43"`, `"문단 모양"` 등 다양한 입력 형식 지원
- 오탐(행 내 `(표 N 참조)` 패턴)을 `TABLE_HEADER_PATTERN` 제거로 해결

#### 시맨틱 인덱싱 개선 (`doc-indexer.ts`)

- **TOC 페이지 제외**: 점선 목차 페이지를 자동 감지해 벡터 인덱싱에서 제외  
  → 전체 청크 수 909 → 721로 최적화, 검색 품질 향상

#### docId 체계 (`types.ts`, `index-manager.ts`)

- `DocumentInfo`에 `pageRange?: { start, end }` 추가
- `hwp3-bin`, `hwp3-xml` 각각 페이지 범위 슬라이싱 후 독립 인덱싱

### v0.1.0 (2026-02-21)

- CLI 래퍼 추가 (`src/cli.ts`): `search`, `section`, `table`, `toc`, `semantic`, `index`
- Gemini Embedding + Qdrant 시맨틱 검색 구현
- PDF 섹션 추출 개선 (584개 → 88개 섹션, 목차 노이즈 필터링)
- Kubernetes YAML (`k8s/`) — `openclaw-support` 네임스페이스, NodePort 30333/30334
- OpenClaw Skill 파일 (`skills/hwp-spec/SKILL.md`)

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
