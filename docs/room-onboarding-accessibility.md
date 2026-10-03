# 구현 및 통합 안내

## 기존 구조와 신규 기능

방 관리 및 내부 과제 카드는 기존 RoomPanel을 확장했다. 방 강조 테두리와 전용 헤더를 추가하고 과제 상세에 RoomBreadcrumb을 연결했다. 방/과제 데이터 모델과 기존 권한 정책은 변경하지 않았다.

AsyncStorage, sample-project, ThemedText, 알림 토스트, 평가 참여 집계, 단계/마인드맵/내보내기의 기존 접근성 기능을 재사용했다. 사용자별 온보딩·글자 크기, 읽기 전용 샘플 둘러보기, 익명 리마인드 및 카카오톡 텍스트 복사는 신규 기능이다. 현재 과제 즐겨찾기 모델은 없으며 기존 아이디어 즐겨찾기에 라벨을 보완했다.

글자 크기는 ThemedText와 공통 ScaledTextInput에서 적용한다. 입력창이 있는 화면은 import만 교체했다. 작은 설정에서도 14px 이상을 유지한다. OS의 글자 확대도 유지한다. 기존 project-flow 인터페이스는 변경하지 않았다.

## Migration

`supabase/migrations/20260928120000_add_anonymous_reminders.sql`

- `reminder_preferences`: 사용자별 수신 허용 여부. 본인만 조회/저장 가능.
- `reminder_dispatches`: 발송자/과제/시간의 서버 전용 전송 이력. API 역할의 모든 접근 권한을 제거하고 RLS를 활성화했다.
- `reminder_notifications`: 수신자/과제/시간/읽음 상태의 수신 이력. 발송자 필드가 없고 본인만 조회, isread 열만 갱신 가능.
- `send_anonymous_reminder(uuid)`: 기존 방 멤버십/과제 소유자 권한을 검사하고 현재 라운드 모든 유효 아이디어에 대한 평가 완료 여부를 판단한다. 응답은 상태 문자열뿐이다.
- 과제별 1시간 쿨다운, 발송자별 서울 날짜 기준 하루 5회. 트랜잭션 advisory lock으로 동시 전송을 직렬화한다.
- 알림 테이블은 직접 INSERT할 수 없으며 RPC만 레코드를 생성한다. 일반 API에서 발송 이력 조회는 불가능하다.

`schema.sql`은 담당자 통합을 위해 수정하지 않았다. 원격 DB에 migration을 적용하지 않았으므로 리마인드 사용 전 통합 담당자가 검토·적용해야 한다. Docker 미실행으로 실제 Postgres 검증은 미수행이다.

## 외부 연동

Figma 및 카카오 SDK 연동은 필요 없다. 카카오톡 기능은 Expo Clipboard의 텍스트 복사만 사용한다. 실제 푸시는 미구현이며 `sendReminderNotification()` 뒤의 서버 발송 경계에 추후 연결한다. 현재는 앱 내 알림 레코드와 알림 화면에서의 30초 갱신을 제공한다.

## 화면에서 확인할 변경

- 방: 전용 헤더, 강조 테두리, 긴 이름 줄임, 가벼운 내부 과제 카드.
- 과제 상세: 방/과제 경로, 평가 미완료 시 두 참여 버튼, 평가 로딩·실패 안내.
- 첫 로그인: 네 단계 온보딩과 읽기 전용 샘플.
- 내 정보 → 앱 설정: 글자 크기와 온보딩 다시 보기.
- 알림: 익명 리마인드 목록, 읽음 처리, 수신 끄기, 빈 상태와 오류 재시도.

수동 검증은 `docs/manual-checklist-room-onboarding-accessibility.md`를 따른다.

## 공식 문서 확인

- https://docs.expo.dev/versions/v56.0.0/
- https://docs.expo.dev/versions/v56.0.0/sdk/clipboard/

프로젝트는 Expo ~56.0.21, React Native 0.85.3, React 19.2.3, expo-clipboard ~56.0.4를 사용하며 추가 패키지는 설치하지 않았다.

## 검증 결과

- `npm test`: 39개 통과 (기존 33개 + 신규 6개).
- 신규 컴포넌트/컨텍스트/유틸과 수정한 평가 훅·공통 텍스트에 대한 ESLint: 통과.
- Expo 웹 개발 서버: localhost:8093 시작, SSR/웹 번들 성공, HTTP 200 확인. React Native DevTools 설치는 환경의 spawn EPERM으로 실패했다.
- 전체 TypeScript 검사: 기존 오류 17개로 실패. example의 누락된 import, EXPO1 복제 앱의 /explore 경로, presentation.tsx의 기존 텍스트 종류/테마 키, PresentationView의 누락된 스타일이다. 해당 코드가 HEAD에도 존재함을 확인했으며 담당 범위 밖이라 변경하지 않았다.
- 실제 DB migration 적용·RLS 실행, 인증된 화면의 브라우저 조작, 모바일 장치 점검은 미수행이다.

## Changed files

- `docs/manual-checklist-room-onboarding-accessibility.md`
- `docs/room-onboarding-accessibility.md`
- `package.json`
- `src/app/_layout.tsx`
- `src/app/notifications.tsx`
- `src/app/profile.tsx`
- `src/app/projects/[id].tsx`
- `src/components/app-navigation.tsx`
- `src/components/auth-screen.tsx`
- `src/components/experience-settings.tsx`
- `src/components/idea-board.tsx`
- `src/components/idea-coach-panel.tsx`
- `src/components/idea-extraction/candidate-idea-card.tsx`
- `src/components/idea-extraction/extraction-source-input.tsx`
- `src/components/idea-extraction/idea-extraction-panel.tsx`
- `src/components/idea-mind-map.tsx`
- `src/components/notification/reminder-inbox.tsx`
- `src/components/onboarding/OnboardingModal.tsx`
- `src/components/PresentationView.tsx`
- `src/components/project-form.tsx`
- `src/components/reminder/ReminderActions.tsx`
- `src/components/room/RoomBreadcrumb.tsx`
- `src/components/room-panel.tsx`
- `src/components/scaled-text-input.tsx`
- `src/components/themed-text.tsx`
- `src/context/ExperienceContext.tsx`
- `src/hooks/use-team-evaluation-progress.ts`
- `src/utils/fontSize.ts`
- `src/utils/onboardingStorage.ts`
- `src/utils/reminder/reminderSender.ts`
- `src/utils/share/kakaoReminderMessage.ts`
- `supabase/migrations/20260928120000_add_anonymous_reminders.sql`
- `tests/room-onboarding-accessibility.test.mjs`
