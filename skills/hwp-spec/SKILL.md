# hwp-spec Skill

HWP/HWPX 규격 PDF 문서를 검색하고 조회하는 스킬입니다.  
토큰 낭비 없이 필요한 스펙만 그때그때 `exec`으로 조회합니다.

---

## 환경 설정

```bash
export HWP_SPECS_DIR=/home/claw/.openclaw/workspace/specs/hwp
export HWP_CACHE_DIR=/home/claw/.openclaw/workspace/fxxk-hwpjs-mcp/cache
export QDRANT_URL=http://192.168.0.101:30333
export GEMINI_API_KEY=<gemini_api_key>   # 시맨틱 검색 시 필요
```

CLI 경로:
```
/home/claw/.openclaw/workspace/fxxk-hwpjs-mcp/dist/cli.js
```

모든 명령어 공통 prefix (환경변수 포함):
```bash
HWP_SPECS_DIR=/home/claw/.openclaw/workspace/specs/hwp \
  node /home/claw/.openclaw/workspace/fxxk-hwpjs-mcp/dist/cli.js
```

시맨틱 검색 시:
```bash
HWP_SPECS_DIR=/home/claw/.openclaw/workspace/specs/hwp \
  QDRANT_URL=http://192.168.0.101:30333 \
  GEMINI_API_KEY=<key> \
  node /home/claw/.openclaw/workspace/fxxk-hwpjs-mcp/dist/cli.js
```

---

## 사용 가능한 문서

| docId       | 파일         | 설명                              | 페이지 범위  |
|------------|--------------|-----------------------------------|-------------|
| `hwp3-bin` | hwp-v3.pdf   | HWP 3.x **바이너리** 파일 구조   | p.1 ~ 54   |
| `hwp3-xml` | hwp-v3.pdf   | **HWPML** — HWP 3.x XML 구조     | p.55 ~ 122 |
| `hwp5`     | hwp-v5.pdf   | HWP 5.0 규격                      | 전체        |
| `formula`  | formula.pdf  | 수식 규격                         | 전체        |
| `chart`    | chart.pdf    | 차트 규격                         | 전체        |
| `dist`     | dist.pdf     | 배포용 문서 규격 (암호화/DRM)     | 전체        |

> ⚠️ **`hwp3-bin` vs `hwp3-xml`**: `hwp-v3.pdf` 파일 하나에 두 문서가 합쳐져 있습니다.
> - `hwp3-bin`: 바이너리 포맷 (offset 구조체, 특수 문자 코드 등)
> - `hwp3-xml`: HWPML XML 태그 기반 구조
>
> 두 문서는 섹션 번호가 각각 1부터 시작하므로, **반드시 올바른 docId를 지정**하세요.  
> 예전 `hwp3` docId는 더 이상 존재하지 않습니다.

---

## 명령어

### 1. 목차 조회 (toc)

문서 구조 파악 시 가장 먼저 실행합니다.

```bash
... toc hwp5
... toc hwp5 --depth 3
... toc hwp3-bin
... toc hwp3-xml
```

### 2. 키워드 검색 (search, exact match)

HWPTAG 상수, 자료형, 한글 키워드 검색. 대소문자 구분 없음.

```bash
... search "FileHeader" --doc hwp5
... search "HWPTAG_PARA_SHAPE"               # 전체 문서 검색
... search "하이퍼링크" --doc hwp3-bin
... search "COLORREF" --doc hwp5
```

### 3. 섹션 내용 조회 (section)

섹션 번호 또는 제목 부분으로 조회. 구조체 전체 내용을 반환합니다.

```bash
... section hwp5 "4.2.6"          # 섹션 번호
... section hwp5 "글자 모양"       # 제목 부분 매칭
... section hwp3-bin "3.1"        # HWP 3.x 파일 인식 정보
... section hwp3-xml "5.16"       # HWPML 머리말/꼬리말
... section hwp5 "1"              # 최상위 섹션 (개요)
```

### 4. 표 조회 (table)

번호 / 한글 표기 / 이름 부분 매칭 모두 지원합니다.

```bash
... table hwp5 "표 43"            # 한글 표 번호
... table hwp5 "43"               # 숫자만
... table hwp5 "글자 모양"         # 이름 부분 매칭
... table hwp5 "테두리"            # 첫 번째 매칭 반환
```

### 5. 자연어 시맨틱 검색 (semantic)

개념·의미 기반 검색. Qdrant 실행 중 + 인덱싱 완료 필요.

```bash
# 특정 문서
... semantic "문단 들여쓰기 바이트 구조" --doc hwp5
... semantic "HWPML 문단 속성 엘리먼트" --doc hwp3-xml
... semantic "암호화 배포용 문서 스트림" --doc dist

# 전체 문서 교차 검색 (--doc 생략)
... semantic "이미지 그림 삽입 데이터 구조"
... semantic "하이퍼링크 URL 저장 방식"

# 영어 질문도 가능
... semantic "How to store paragraph indent" --doc hwp5

# 결과 개수 조정
... semantic "글자 색상" --doc hwp5 --limit 3
```

> 임베딩 모델: `gemini-embedding-001` (3072차원, `v1beta` REST API)  
> Qdrant: `http://192.168.0.101:30333` / 컬렉션: `hwp_spec`

### 6. 벡터 인덱스 생성 (index)

최초 1회 실행. 이후 Qdrant에 영구 저장됩니다.

```bash
... index                       # 전체 문서
... index --doc hwp5            # 특정 문서만
... index --doc hwp3-bin
... index --doc hwp3-xml
... index --force               # 강제 재인덱싱
```

---

## 권장 워크플로우

### 개념만 알 때 (자연어 탐색)
```
1. semantic "글자 색상 속성" --doc hwp5     # 관련 섹션 찾기
2. section hwp5 "4.2.6"                     # 상세 내용 확인
```

### 키워드를 알 때
```
1. search "HWPTAG_CHAR_SHAPE" --doc hwp5   # 위치 파악
2. section hwp5 "글자 모양"                # 섹션 전체 조회
```

### 문서 구조 파악
```
1. toc hwp5 --depth 2    # 전체 구조 파악
2. toc hwp5 --depth 3    # 세부 항목 확인
```

### HWP 3.x 조회 시 docId 선택 기준
```
- 바이너리 파일 구조, offset, 특수 문자 코드 → hwp3-bin
- XML 태그, 엘리먼트, 속성, HWPML → hwp3-xml
```

---

## 주의사항

1. **`hwp3` docId 제거됨**: 반드시 `hwp3-bin` 또는 `hwp3-xml` 사용.
2. **시맨틱 검색 전제조건**: Qdrant(`192.168.0.101:30333`) 실행 중 + `index` 완료.
3. **첫 실행 느림**: PDF 최초 파싱 시 캐시 생성 (1~3분). 이후 즉시 로드.
4. **표(table) 한계**: PDF 텍스트 기반 파싱이므로 복잡한 표는 일부 누락 가능.  
   표 내용이 불완전하면 `section`으로 해당 섹션 전체를 조회할 것.
5. **토큰 절약**: 전체 문서를 컨텍스트에 넣지 말고 필요한 섹션만 조회할 것.
6. **Qdrant 네임스페이스**: Kubernetes `openclaw-support`, NodePort `30333`(HTTP) / `30334`(gRPC).
