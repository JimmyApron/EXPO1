# 내보내기 / 공유

프로젝트의 **발표자료** 화면에서 사용할 수 있습니다. 선정 아이디어와 현재 MVP가 있으면 발표자료를 AI로 생성하기 전에도 내보낼 수 있습니다. 생성된 발표자료가 있으면 해당 슬라이드·대본과 보고서를 사용합니다.

| 기능 | 웹 | Android / iOS |
| --- | --- | --- |
| 사업계획서·최종보고서 DOCX | 파일 다운로드 | 파일 생성 후 공유 창 |
| PPTX | 파일 다운로드 | 파일 생성 후 공유 창 |
| PDF | 보고서 전용 새 창 → 인쇄 → PDF로 저장 | Expo Print로 PDF 생성 후 공유 창 |
| 카톡·노션 복사 | 클립보드 복사 | 클립보드 복사 |

웹 PDF는 브라우저의 PDF 저장 기능을 사용하며 팝업 허용이 필요할 수 있습니다. 웹 클립보드는 HTTPS 또는 localhost에서 확인하세요. 모바일 공유 창을 취소한 경우 저장 완료로 표시하지 않습니다.

## 파일과 데이터

- `src/components/export/ExportPanel.tsx`: 기존 DOCX 두 버튼과 새 내보내기 버튼, 진행 상태 및 완료·오류 메시지.
- `src/components/export/ExportButton.tsx`: 테마와 접근성 상태를 사용하는 공통 버튼.
- `src/types/export.ts`: 실제 데이터와 샘플 데이터가 공유하는 타입.
- `src/utils/export/exportFormats.ts`: 카톡 요약, 노션 마크다운, 보고서 HTML, 슬라이드 분할.
- `src/utils/export/createPptx.ts`: PPTX 바이트 생성. 한글 폰트 지정 및 발표 노트 포함.
- `src/utils/export/exportToPptx.ts`, `exportToPdf.ts`, `exportToPdf.web.ts`: 형식별 다운로드·공유.
- `src/utils/export/saveFile.ts`: 웹 다운로드 및 모바일 임시 파일 공유·정리.
- `src/utils/export/copyForKakao.ts`, `copyForNotion.ts`: Expo Clipboard 복사.
- `src/constants/sample-export.ts`: 독립 미리보기용 샘플 데이터.

실제 화면은 `PresentationView.tsx`와 `presentation-workflow-panel.tsx`를 통해 선정 아이디어, MVP, AI 분석, 역할 분담, 발표 순서를 연결합니다. 데이터가 없는 항목은 미작성·분석 전으로 표시합니다. 기존 `fileExport.ts`의 DOCX 문서 서식은 재사용하며 파일 저장만 공통 함수로 연결했습니다.

샘플 미리보기는 별도 화면에서 아래 컴포넌트를 사용하면 됩니다. 실제 프로젝트 데이터에 샘플을 자동 대입하지 않습니다.

```tsx
import { ExportPanel } from '@/components/export/ExportPanel';
import { sampleExportData } from '@/constants/sample-export';

<ExportPanel data={sampleExportData} />
```

## 실행 확인

1. `npx expo start`로 실행합니다.
2. 프로젝트에서 아이디어 선정과 MVP 생성을 완료하고 발표자료 화면으로 이동합니다.
3. DOCX/PPTX를 열어 한글 내용과 PPTX 발표 노트를 확인합니다.
4. 웹 PDF 인쇄 창에서 PDF로 저장하고, 모바일에서는 파일 앱으로 공유합니다.
5. 카톡용 복사는 짧은 문제·해결·기능·분석 요약을, 노션 복사는 제목과 목록으로 구성된 전체 계획을 붙여넣는지 확인합니다.
6. `npm run test:export`로 포맷과 실제 PPTX ZIP 구조 테스트를 실행합니다.

추가 의존성은 `pptxgenjs`, `expo-print`, `expo-sharing`, `expo-file-system`이며, 이미 설치된 `expo-clipboard`를 재사용합니다. Expo Sharing 플러그인을 `app.json`에 등록했습니다.
