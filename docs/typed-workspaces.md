# 과제 유형별 작업 공간 및 공통 목록·마인드맵

## 구현 범위

세 유형 모두 기존 `ideas` 카드와 `mindmaps` / `mind_map_nodes`를 사용한다. 보고서 후보나 글쓰기 후보를 별도 배열·테이블로 복제하지 않는다. 최종 주제·소재는 작업 공간의 `selectedIdeaId`로 같은 카드를 참조한다.

| 유형 | 독립 메뉴 | 단계별 작업 |
| --- | --- | --- |
| 서비스·앱 기획 | 아이디어 목록 / 마인드맵 | 기존 도출 → 비교·선정 → MVP → 선택적 발표 |
| 보고서·조사 | 조사 주제 목록 / 조사 마인드맵 | 주제 선정 → 자료 조사·정리 → 목차 구성 → 보고서 작성 → 검토·제출 → 선택적 발표 |
| 글쓰기·창작 | 소재 목록 / 창작 마인드맵 | 주제·소재 → 글 종류별 개요 → 초안 → AI 피드백·수정 → 최종 결과물 → 선택적 발표 |

- 목록의 추가·수정·삭제, 즐겨찾기, 검색·필터·정렬, 공감·피드백을 재사용한다. 검색에 유형별 추가 필드와 키워드도 포함한다.
- 조사 목적·핵심 질문·범위 또는 창작 메시지·분위기·전개는 `ideas.details`, 키워드는 기존 `ideas.keywords`에 저장한다. 기존 서비스 필드는 보존한다.
- 조사·창작 마인드맵은 수정 가능한 분류와 실제 카드 연결을 분리한다. 기본 분류는 처음 한 번 생성하며, 삭제한 기본 분류를 재동기화 때 강제로 복원하지 않는다. 자유 글쓰기는 기본 분류가 없으며, 카드를 바로 동기화하면 미분류 가지를 만든다.
- 카드 동기화 RPC는 과제 단위 잠금을 사용해 중복 배치를 방지한다. 기존 카드를 다른 가지에 배치하면 같은 노드를 옮긴다. 분류 삭제는 배치만 삭제하고 실제 카드는 보존한다. 실제 카드 삭제는 FK로 연결 노드를 정리하고 최종 선택도 해제한다.
- 자료함은 직접 등록한 자료·원문·출처를 보관한다. 본문 없는 URL 자료의 AI 요약·비교는 클라이언트와 서버 양쪽에서 거절한다.
- 목차·개요는 안정적인 ID로 본문·근거·자료를 연결한다. 하위 항목, 접기, 순서 이동, 삭제 전 원고 버전 보관을 지원한다.
- Markdown 서식(굵게·기울임·목록), 문단·장면 구분, 글자 수, 자동/명시적 저장, 전체 미리보기, AI 제안 비교·적용을 제공한다. AI 적용 전 원고를 버전으로 보관하며 원문이 바뀐 경우 적용을 거절한다.
- 피드백의 원문이 실제 원고에 한 번만 존재하는 경우에만 적용한다. 무시한 피드백 상태를 보관한다. AI 실행은 단계 완료의 필수 조건이 아니다.
- 최초 초안·수정본·최종본을 저장하고 이전 버전 복원 전에 현재 원고를 보관한다. 최종본 이후 원고·선정 항목·출처 변경을 재검토하도록 안내한다.
- TXT·DOCX·PDF와 발표 PPTX/대본 TXT를 제공한다. 웹 PDF는 인쇄 대화상자에서 PDF로 저장한다. 발표 AI 초안은 기존 슬라이드 뒤에 추가하여 직접 작성한 슬라이드를 유지한다.
- 공통 과제 카드에는 유형 태그를 제목 바로 위 왼쪽에 배치한다. 최근 업데이트 안내·D-Day·즐겨찾기는 유지한다.

## 저장 및 호환성

`20261017020000_typed_workspaces_shared_topics.sql`은 기존 테이블을 삭제하지 않고 다음을 추가한다.

- `projects.settings`: 유형별 설정.
- `ideas.details`: 조사·창작 카드 필드.
- `mindmaps.defaultsinitialized`: 기본 분류를 한 번만 생성하기 위한 상태.
- `project_workspaces`: 과제+유형별 구조화 JSON. 자료·근거·개요·본문·버전·피드백·검토 체크·발표와 저장 리비전을 보관한다.
- `save_project_workspace`: 리비전 비교를 통한 원자적 저장. 충돌하면 덮어쓰지 않는다. 과제·선정 카드의 범위와 RLS를 확인한다.
- `sync_topic_map`: 조사·창작용 동기화. 서비스 기획의 고정 필드 구조는 기존 경로를 계속 사용한다.
- 카드 수정·삭제 동기화 및 다른 과제의 카드·부모 노드 연결 방지 트리거.

팀원은 기존 과제/방 접근 정책을 기준으로 작업 공간을 공유한다. 기존 카드의 작성자별 수정·삭제 권한은 변경하지 않는다. 비공개 과제는 타인이 읽거나 저장할 수 없다.

원고는 900ms 후 자동 저장하며 사용자+과제+유형 키로 기기 초안을 보관한다. 충돌 시 기기 초안을 내려받고 서버 최신본을 다시 불러올 수 있다. 다른 과제로 이동할 때 초안 키가 섞이지 않는다. 작업 단계 내부 이동은 서버 저장을 마친 뒤 수행한다. 독립 목록·마인드맵 메뉴 이동 중에는 같은 작업 공간 컨트롤러를 유지한다.

이전 단순 텍스트 단계 내용은 삭제하지 않는다. 새 작업 공간이 없는 경우 `legacyNotes`로 가져와 참고 영역에서 제공하며, 이전 보고서 결과/글쓰기 초안은 자유 본문으로 가져온다. 보고서의 기존 `result` ID는 보고서 작성에 유지하고 검토·제출에는 기존 허용 ID인 `revision`을 사용한다. 진행률은 홈·목록·상세에서 같은 `project_stage_progress`를 참조한다. 원고·선정 항목·자료 등 내용이 바뀌면 관련 완료 상태를 재검토하도록 해제한다.

## 수정·추가 파일

| 영역 | 파일 |
| --- | --- |
| 과제 카드·설정·상세 | `src/components/project-card.tsx`, `project-form.tsx`, `project-settings-fields.tsx`, `project-home-summary.tsx`, `src/app/projects/[id].tsx` |
| 공통 목록·마인드맵 | `src/components/idea-board.tsx`, `idea-mind-map.tsx`, `mind-map-export.tsx`, `topic-fields.tsx`, `app-navigation.tsx` |
| 전용 작업 화면 | `src/components/document-workspace/`의 단계 패널, 자료함, 개요, 원고, 피드백, 결과, 발표, 공통 컨트롤, Markdown 미리보기 |
| 데이터·훅 | `src/lib/topic-workspace.ts`, `document-workspace.ts`, `workspace-export.ts`, 기존 project/mind-map 라이브러리, `src/hooks/use-document-workspace.ts`, `use-workspace-assistant.ts`, 기존 projects/ideas/mind-map 훅 |
| 타입 | `src/types/document-workspace.ts`, `project.ts`, `idea.ts`, `mind-map.ts` |
| 출력·TXT 입력 | `src/utils/export/workspaceDocx.ts`, `workspacePdf.ts`, `workspacePdf.web.ts`, `src/utils/import-text-file.ts`, `import-text-file.web.ts` |
| 서버·DB | `supabase/functions/workspace-assistant/index.ts`, 위 마이그레이션 |
| 검사 | `tests/document-workspace.test.mjs`, `workspace-assistant.test.mjs`, `workspace-migration.test.mjs`, `project-stages.test.mjs`, `package.json` |

## 적용 순서

2026-10-17 앱 환경변수와 연결된 Supabase 프로젝트가 일치하는지 확인한 후 `20261017020000_typed_workspaces_shared_topics.sql`을 원격 DB에 적용했다. 적용 후 dry-run에서 미적용 마이그레이션이 없음을 확인했다. 기존 과제 8개·아이디어 42개·서비스 마인드맵 노드 152개는 추가 열을 제외한 데이터 해시와 행 수가 적용 전후 동일했다. `workspace-assistant` Edge Function 배포는 아직 수행하지 않았다.

다른 환경에 적용할 때는 원격 마이그레이션 상태를 먼저 확인한다.

```powershell
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run --include-all
# 검토한 마이그레이션을 적용
npx.cmd supabase db push --include-all
npx.cmd supabase functions deploy workspace-assistant
```

기존 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`를 사용한다. 새 클라이언트 환경변수는 없다. 서버는 기존 `DEEPSEEK_API_KEY`와 선택적 `DEEPSEEK_MODEL`을 사용한다. API 키는 Supabase Edge Function secret에만 설정한다. 설정되지 않았거나 AI가 실패해도 직접 작성·저장·출력은 사용할 수 있다.

구현 전 [Expo SDK 56 문서](https://docs.expo.dev/versions/v56.0.0/)와 해당 버전의 [Print](https://docs.expo.dev/versions/v56.0.0/sdk/print/), [FileSystem](https://docs.expo.dev/versions/v56.0.0/sdk/filesystem/), [Sharing](https://docs.expo.dev/versions/v56.0.0/sdk/sharing/)를 확인했다. 파일 저장·공유는 기존 `saveFile`을 재사용한다. 테이블 반환 RPC는 [PostgREST의 객체 응답 형식](https://docs.postgrest.org/en/latest/references/api/resource_representation.html)에 맞춰 `.single()`로 받는다.

## 검증 및 재현

```powershell
npm.cmd test
node node_modules/typescript/bin/tsc --noEmit
npm.cmd run lint
node node_modules/expo/bin/cli export --platform web --output-dir dist/workspace-verification
```

로컬 DB 검사는 프로젝트의 실제 기존 마인드맵 마이그레이션과 새 마이그레이션을 PGlite PostgreSQL에서 실행한다. 간소화한 과제/방 테스트 스키마를 사용하므로 원격 Supabase 전체 스키마 검증과는 구별해야 한다. 테스트 의존성은 앱 의존성에 추가하지 않고 `.expo` 아래에 설치했다.

```powershell
npm.cmd install --prefix .expo/workspace-verification --no-save --package-lock=false @electric-sql/pglite
npm.cmd run test:workspace:db
```

Chrome 검증은 `.expo/workspace-verification/browser-check.mjs`와 격리된 메모리 API를 사용했다. 실제 서비스의 계정·데이터·AI에 요청하지 않는다. 테스트 데이터는 제품 코드에 포함하지 않는다. 데스크톱 1440px / 모바일 390px에서 메뉴·카드·입력·마인드맵·자료·원고 저장과 새로고침을 확인한다. 결과·스크린샷·출력물은 동일한 임시 폴더에 생성한다.

2026-10-17 검증 결과: 기본 테스트 72개, 로컬 PostgreSQL 통합 검사 1개, 전체 ESLint, TypeScript 검사, Expo 웹 export 통과. 격리된 Chrome 테스트에서 유형 태그·메뉴, 조사/창작의 서비스 평가 UI 제외, 카드 입력과 단일 노드 반영, 자료 자동 저장, 원고 자동 저장과 새로고침, 최종본 버전 저장, AI 오류 시 원고 유지, 데스크톱·모바일 화면을 확인했다. TXT·DOCX·PDF·PPTX를 실제 파일로 출력했으며 DOCX/PPTX ZIP 구조 및 한글 내용과 PDF 페이지/본문을 검사했다. 이 결과는 원격 DB/AI 및 네이티브 실기기 검증을 포함하지 않는다.

## 제한 및 실환경 확인 항목

- 원격 DB 마이그레이션/함수 배포, 실제 팀 계정 권한, 실제 DeepSeek 응답은 별도 실환경 확인이 필요하다.
- iOS·Android 실기기 실행 및 네이티브 인쇄·공유는 아직 검증하지 않았다.
- TXT 자료 불러오기는 웹에서 2MB 이하 UTF-8 TXT를 지원한다. 네이티브에서는 본문을 붙여넣는다. PDF/DOCX 첨부 원문 추출, URL 크롤링, 외부 자료 검색은 제공하지 않는다.
- APA/MLA/IEEE는 등록 정보에 기반한 서식 초안이다. 정보가 부족하면 확인 필요로 표시한다. 직접 지정 형식은 작성 규칙과 초안을 제공하며 최종 서식은 사용자가 확인한다.
- 페이지 목표는 실제 인쇄 화면에서 확인한다. 사실 정확도·표절 자동 검증은 구현하지 않았으며 완료로 표시하지 않는다.
- 팀 공동 작업은 리비전 충돌 감지 방식이다. 동시 문자 편집·자동 병합은 제공하지 않는다. 충돌 시 초안을 보관한 후 최신본에 반영한다.
- 글 종류를 바꿔도 사용자가 편집한 기존 분류를 덮어쓰지 않는다. 필요하면 현재 글 종류의 기본 분류를 추가하고 기존 분류를 직접 수정한다.
