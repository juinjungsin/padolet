padolet 빌딩 작업 로그
2026-05-02


Phase 1 — 기초 구조 [완료]

  [1] Next.js 15 + TypeScript + Tailwind v4 프로젝트 초기화
      - padolet/src/ 하위 디렉토리 구조 생성
      - 의존성: firebase, next-auth, qrcode, react-icons

  [2] ElevenLabs 디자인 토큰 적용
      - globals.css에 커스텀 컬러(eggshell, obsidian, gravel 등), 타이포그래피, 간격, 그림자 토큰 정의
      - Cormorant Garamond 300 (Waldenburg 대체), Inter 400/500

  [3] Firebase/Firestore SDK 초기화
      - src/lib/firebase.ts: lazy init 방식 (config 없어도 빌드 가능)
      - src/lib/firestore.ts: 세션/참여자/포스트잇/메시지 CRUD + 실시간 리스너
      - Firebase 프로젝트: jblet-3e6c3

  [4] 기본 레이아웃 컴포넌트
      - Nav (로고, 세션제목, 참여자수, 관리 링크)
      - Button (filled/ghost pill)
      - Input (underline/contained)
      - Card (white, rounded-xl, shadow)

  GitHub 레포: https://github.com/juinjungsin/padolet (main 브랜치)


Phase 2 — 입장 시스템 [완료]

  [5] 세션 생성 API (Firestore 직접 호출)
  [6] 6자리 코드 생성 (혼동 문자 0/O/1/I/L 제외)
  [7] 입장 화면 구현
      - / : 홈 (코드 입력 + 강사 로그인)
      - /join?code=XXXXXX : 코드 검증 → 이름 입력 → 익명 옵션 → 입장
      - sessionStorage에 참여자 정보 저장
  [8] 참여자 등록 + 실시간 카운터 (Firestore onSnapshot)
  [9] Firestore 복합 인덱스 생성 (createdBy + createdAt)


Phase 3 — 포스트잇 보드 [완료]

  [10] PostInput: 텍스트 입력 (500자), URL 자동감지
  [11] PostGrid: 5열 그리드, 실시간 동기화
  [12] Admin만 삭제 가능 (hover 시 삭제 아이콘)


Phase 4 — 대화 패널 [완료]

  [13] ChatPanel: 우측 1/4, 메시지 실시간 동기화
  [14] 파일 첨부 UI (드래그앤드롭, 클립보드 붙여넣기 감지)
  [15] 50MB/20개 제한 로직 구현
  [16] Firebase Storage 연동 완료
      - src/lib/storage.ts: 업로드 (진행률, 50MB/20개 검증)
      - 저장 경로: gs://jblet-3e6c3.firebasestorage.app/padolet/{sessionId}/
      - ChatPanel: 파일 첨부, 드래그앤드롭, 스크린샷 붙여넣기 (Ctrl+V)
      - PostInput: 이미지 첨부 버튼 추가


Phase 5 — Admin [완료]

  [17] Google OAuth 연동 (NextAuth v4 + Google Provider)
      - src/app/api/auth/[...nextauth]/route.ts
      - AuthProvider 래핑 (layout.tsx)
      - OAuth 클라이언트: 693370050069-0ds155h5gjm0tfga352mojo59pk9kjs9
      - .env.local에 GOOGLE_CLIENT_ID/SECRET 설정 완료
      - Google 로그인 테스트 통과 확인
  [18] Admin 대시보드: 미인증 시 Google 로그인 화면, 인증 후 세션 관리
  [19] 보드 페이지 Admin 판별: authSession.user.id === session.createdBy
  [20] 레포트 페이지: 참여자/포스트잇/대화 전체 조회 + MD 다운로드
  [21] QR 코드 모달 (도메인: juinjungsin.site)


Phase 6 — 마감 [완료]

  [22] 파일 업로드 실제 구현 [완료]
      - Firebase Storage 활성화 확인 (gs://jblet-3e6c3.firebasestorage.app/padolet)
      - 업로드/삭제 테스트 통과

  [23] 반응형 최적화 (모바일) [완료]
      - 보드: 모바일 하단 탭 전환 (보드/대화), 데스크탑 3/4+1/4 유지
      - 포스트잇 그리드: 2열(모바일) → 3열(sm) → 4열(md) → 5열(lg)
      - Nav: 모바일 높이/패딩 조정 (h-11, px-4)
      - Admin 대시보드: 세션 카드/헤더 모바일 세로 배치

  [24] Vercel 배포 + 도메인 연결 [완료]
      - Vercel 프로젝트: jongbin-9321s-projects/padolet
      - 배포 URL: https://padolet.vercel.app
      - 환경변수 10개 설정 완료 (Firebase 6개 + NextAuth 2개 + Google OAuth 2개)
      - 커스텀 도메인: juinjungsin.site 추가
      - 가비아 DNS A 레코드: 76.76.21.21 설정
      - Google OAuth 리디렉션 URI 3개 등록

  [25] 통합 테스트 [대기]
      - 프로덕션 URL: https://padolet.vercel.app
      - 커스텀 도메인: juinjungsin.site (DNS 전파 대기 중)


주요 설정 파일 위치

  프로젝트 루트: C:\Users\juinj\OneDrive\바탕 화면\JBlet\padolet\
  Firebase config: .env.local
  디자인 레퍼런스: C:\Users\juinj\OneDrive\바탕 화면\JBlet\DESIGN (1).md
  PRD: C:\Users\juinj\OneDrive\바탕 화면\JBlet\PRD.md


기술 스택

  Frontend: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
  Backend: Next.js API Routes (서버리스)
  DB: Cloud Firestore (실시간 동기화)
  파일저장: Firebase Storage
  인증: NextAuth v4 + Google OAuth
  배포: Vercel
  소스관리: GitHub (juinjungsin/padolet)


Git 커밋 이력

  dd85720 - padolet 초기 프로젝트 구조 — Phase 1~4 코어 구현
  623982b - Google OAuth 인증 + Firebase Storage 파일 업로드 구현
  40fa6a7 - 반응형 모바일 최적화


빌딩 타임라인

  2026-05-02 17:49  PRD 작성 시작
  2026-05-02 18:15  Phase 1 완료 (프로젝트 초기화 + 디자인 토큰)
  2026-05-02 18:30  Phase 2 완료 (입장 시스템)
  2026-05-02 18:40  Phase 3 완료 (포스트잇 보드)
  2026-05-02 18:50  Phase 4 완료 (대화 패널)
  2026-05-02 19:00  Firebase config 연결 + Firestore 인덱스 생성
  2026-05-02 19:10  전 기능 로컬 동작 확인
  2026-05-02 19:20  Phase 5 완료 (Google OAuth Admin 인증)
  2026-05-02 19:30  Firebase Storage 파일 업로드 구현
  2026-05-02 19:40  반응형 모바일 최적화
  2026-05-02 19:45  Vercel 배포 + 도메인 연결
  2026-05-02 19:50  프로덕션 배포 완료


미해결 항목

  - DNS 전파 대기: juinjungsin.site → 76.76.21.21 (가비아 설정 완료, 전파 중)
  - Firebase Auth 승인된 도메인에 juinjungsin.site 추가 필요
  - Google OAuth 리디렉션 URI: 프로덕션 도메인 동작 확인 필요


Phase 6 — Firestore Rules 재설계 및 인증 이중화 (2026-07-08)

  문제
    - Firebase Console의 Rules는 'request.auth.token.email == jongbin@gmail.com' 요구
    - 앱은 NextAuth로만 로그인, Firebase Auth signIn 호출 없음 → request.auth == null
    - 결과: 모든 write 실패 (세션 생성 포함)

  변경 파일 (신설 4, 수정 5)
    신설
      firestore.rules              컬렉션별 세밀 rules (관리자/참여자 경로 분리)
      firestore.indexes.json       createdBy+createdAt 복합 인덱스
      firebase.json                CLI 배포 설정
      .firebaserc                  프로젝트 alias (jblet-3e6c3)
      src/components/auth/FirebaseAuthSync.tsx
                                   NextAuth 세션 → Firebase Auth 이중 로그인 트리거

    수정
      src/app/api/auth/[...nextauth]/route.ts
                                   jwt callback에서 Google id_token 저장, session에 노출
      src/lib/firebase.ts          signInWithGoogleCredential, signInAsAnonymousUser 추가
      src/lib/firestore.ts         addParticipant를 uid 기준 setDoc로 변경 (중복 카운트 방지)
      src/app/join/page.tsx        Anonymous Auth 트리거, uid를 participantId로 사용
      src/app/admin/page.tsx       adminId → firebaseUid 통일, createdBy는 firebase uid
      src/components/auth/AuthProvider.tsx
                                   FirebaseAuthSync 삽입

  아키텍처
    관리자: NextAuth Google 로그인 → id_token → Firebase signInWithCredential
            → request.auth.token.email로 admin/super 판별
    참여자: /join 완료 시 signInAnonymously → uid를 participantId로
            → participants/{uid} 존재 여부로 세션 참여 판별

  배포 대기 항목
    1) Firebase Console → Authentication → Sign-in method
       - Google (활성 확인)
       - Anonymous (활성화 필요)
    2) npx firebase-tools deploy --only firestore:rules --project jblet-3e6c3
    3) 기존 세션 데이터의 createdBy 값 = NextAuth sub → 새 규칙으로는 소유자로 인식 안 됨
       (개발 초기라 무시 가능. 기존 데이터 유지 원하면 마이그레이션 스크립트 필요)


Phase 8 — 텍스트 파일 한글 깨짐 수정 + HTML 업로드 허용 (2026-10-19)

  원인
    - 한글 깨짐: 업로드 시 contentType을 file.type("text/plain")으로만 지정 → charset 없이 서빙
      → 브라우저가 인코딩을 추측하다 깨짐 (특히 메모장/엑셀 ANSI = CP949 파일)
      Firebase 정책 문제 아님. 저장 경로의 한글 파일명도 "_"로 치환돼 다운로드 파일명이 깨짐
    - HTML 차단: 앱(storage.ts) + 운영 Storage Rules 이중 차단
      a21ff82의 storage.rules가 7/8 운영 배포된 뒤 코드만 되돌려져(b8a2c9d) 운영에 그대로 남아 있었음
      → "text/plain; charset=utf-8"도 거부되는 상태

  변경
    src/lib/storage.ts       인코딩 판별(UTF-8/CP949/UTF-16 BOM) 후 contentType에 charset 명시
                             (원본 바이트 유지), contentDisposition에 원본 파일명(RFC 5987),
                             .md 등 file.type 빈 값은 확장자로 MIME 보정, text/html 허용
    storage.rules            운영 규칙을 저장소로 편입 + 텍스트 계열 charset 허용, text/html 차단 해제
    firebase.json            storage 섹션 추가

  배포
    - Storage Rules: npx firebase-tools deploy --only storage --project jblet-3e6c3 (규칙 먼저)
    - Vercel: main push → 자동 배포 (cfafe98, /claude-level 페이지 포함)
    - 운영 검증: CP949 txt·UTF-8 html 업로드/서빙 헤더 확인, SVG·JS·비로그인 거부 확인, 프로브 파일 삭제

  참고
    - 기존에 업로드된 텍스트 파일은 charset 없이 저장돼 있어 재업로드해야 정상 표시
    - Storage Rules 변경 시 반드시 규칙 배포 → 앱 배포 순서 (반대면 업로드 403)
    - 커스텀 도메인 juinjungsin.site 접속 불가 상태 확인 (padolet.vercel.app 정상) — DNS 점검 필요


Phase 9 — 교육 대시보드 개선 1단계: P0 신뢰성 수정 + 로컬 검증 환경 (2026-10-23)

  근거: Downloads\# 파도렛 교육 커뮤니케이션 대시보드 개선 요구사항.md (P0·P1, 단계별 승인)
  복구 지점: 태그 restore-20261023 (8808503) + JBlet\_backups\padolet_restore-point_20261023\RESTORE.md

  원인 (코드·운영 데이터 읽기 조회·에뮬레이터 재현으로 확인)
    - 교육생 첫 입장 실패: addParticipant가 세션 문서 participantCount를 증가시키는데
      7/8 Firestore Rules 이후 참여자는 세션 문서 수정 불가 → "입장에 실패했습니다".
      참여자 문서는 이미 생성돼 재시도 시에는 입장됨. 에뮬레이터에서 재현 확인.
    - 관리자 목록 참여자 1명 vs 보드 54명: 같은 원인으로 7/8 이후 세션 28개의 participantCount가 1에 고정
      (운영 35개 중 14개 불일치, 읽기 전용 조회)
    - 보고서 첨부 누락: 화면·MD 모두 content만 출력 → 파일·이미지 전용 게시물이 빈 항목
    - 위임 관리자 보고서 접근 불가: 소유자 판별이 NextAuth id 기준 (세션 createdBy는 Firebase uid)
    - 참여자 활동 통계가 이름 기준 → 동명이인 합산
    - 세션 삭제 시 댓글·투표 응답 하위 컬렉션 잔존

  변경
    src/lib/firestore.ts     addParticipant의 participantCount 증가 제거, getParticipantCount(집계 쿼리),
                             deleteSession이 댓글·투표 응답까지 삭제, getComments
    src/lib/metrics.ts       지표 정의 단일화: 누적 입장(참여자 문서 수) / 최근 활동(약 3분), 식별자 기준 집계
    src/lib/format.ts        용량 B·KB·MB(0 B와 크기 미확인 구분), 한국 시간 고정 표기
    src/lib/report.ts        보고서 MD 직렬화 — 첨부 파일명·링크·용량·시각, 댓글, 숨긴 메시지 본문 제외,
                             공유용 옵션(참여자 명단·첨부 링크 제외)
    admin/report             권한 판별을 Firebase uid 기준(구 세션 호환), 화면·PDF·MD 동일 항목, 내보내기 옵션
    admin                    누적 입장을 집계 쿼리로 표시(집계 중/확인 불가 구분), 레포트→보고서
    PostGrid·ChatPanel·Nav·ParticipantsPanel·BoardToolbar·projector
                             문구 한국어 통일(고정됨/복사/답글/숨기기/차단/수정/보고서), 용량 표시, 지표 이름·설명
    ui/Card                  div 속성 전달 (data-testid 등)

  로컬 검증 환경 (운영 Firebase 미접속, demo-padolet)
    - 휴대용 JDK 21: C:\Users\juinj\tools\jdk-21.* (scripts/emulators.mjs가 자동 탐색)
    - npm run emulators      Auth·Firestore·Storage 에뮬레이터
    - npm run dev:emulator   에뮬레이터 연결 개발 서버 http://localhost:3100 (관리자 화면에 에뮬레이터 로그인 표시)
    - npm run seed           가상 데이터 (세션 코드 TEST / EMPT / ENDD)
    - npm test               단위 테스트 (Vitest)
    - npm run test:rules     보안 규칙 테스트 (에뮬레이터 자동 기동)
    - npm run test:e2e       Playwright E2E (에뮬레이터·개발 서버 자동 기동)
    - 에뮬레이터 로그인은 NEXT_PUBLIC_USE_EMULATOR=1 + 개발 서버에서만 등록 (운영 빌드에 미포함 확인)

  검증 (2026-10-23 실행)
    - npm test 15/15, npm run test:rules 8/8, npm run test:e2e 15/15, tsc 통과, npm run build 통과
    - PDF 출력물 확인 (Playwright page.pdf): 첨부 전용 게시물·0 B 파일·댓글·숨긴 메시지 표시
    - ESLint: 신규 오류 없음, 기존 패턴 경고 1건(admin useEffect deps — 3단계 관리자 목록 개편 때 정리)

  데이터 영향
    - 마이그레이션 없음. sessions.participantCount 필드는 그대로 두고 표시에만 쓰지 않음
    - Firestore/Storage Rules 변경 없음 → 앱 배포만 필요


Phase 10 — 교육 대시보드 개선 2단계: 디자인 기반 (2026-10-23)

  발견·수정한 전역 문제
    - 간격이 Tailwind 표준의 1/4로 적용되던 문제: globals.css @theme의 "--spacing-4: 4px" 등 이름 토큰이
      p-4·h-16·w-8 같은 숫자 유틸리티 값을 바꿔 놓았음 (예: 상단 메뉴 h-16 = 16px, 카드 p-4 = 4px, 색상 점 4px).
      토큰을 제거해 표준(p-4 = 16px)으로 복원. 주의: @theme 안의 주석에 토큰 표기를 적어도 Tailwind가 읽는다.
      개편 범위 밖 화면(/claude-level, /timer, 프로젝터, 홈, 입장)은 전후 스크린샷 비교로 확인 — 여백·버튼 크기 정상화

  변경
    globals.css        요구사항 제안 색상 토큰(배경 #F6F8FB, 주요 #183B56, 강조 #2563EB, 본문 #172B4D,
                       보조 #526277, 테두리 #DCE3EB) + 3차 텍스트 #5F6F82, 상태(주황·초록) 토큰,
                       입력창 테두리 #7C8B9E(3:1), 키보드 포커스 표시, 터치 44px(.touch-target), 한국어 어절 줄바꿈,
                       제목은 산세리프(한글 시스템 고딕), 세리프(Fraunces)는 워드마크에만(.font-brand)
    ui/Modal           포커스 이동·가두기·복귀, 대화상자 이름
    ui/Menu (신규)     키보드 드롭다운 (↑↓ Home End Esc Tab)
    ui/Collapsible     긴 글 접기·펼쳐보기 (넘칠 때만 버튼)
    ui/ConnectionBanner 인터넷 연결 끊김 안내
    layout/Nav         강사 도구 메뉴로 통합(타이머·프로젝터·보고서·모더레이션·잠금·세션 관리), 좁은 화면 아이콘만
    board 페이지       보드·대화 단일 렌더(이전엔 데스크톱·모바일용 2벌 구독), 1024px 이상 좌우 분할 / 미만 하단 탭,
                       게시물 뒤 배경 이미지 제거, 세션 없음·로딩 상태
    PostGrid           흰 카드 + 색상 띠, 게시물 메뉴(수정·고정·프로젝터·삭제 — 호버 전용 아이콘 대체),
                       긴 글 접기, 첨부 칩(파일명 2줄·용량·열기), 빈 보드 안내, 리액션 접근 가능한 이름
    PostInput·ChatPanel·PostComments·BoardToolbar  글자 16px(대화 15px), 터치 영역, 레이블, 게시 실패 처리
    projector          파일 전용 게시물이 빈 카드로 보이던 문제 (일반·고정·스포트라이트)
    admin/report       로드 오류를 권한 없음과 구분 + 다시 시도

  검증 (실행)
    - npm test 46/46 (디자인 토큰 대비 31건 포함), 규칙 8/8, E2E 24/24, tsc·build 통과, ESLint 신규 오류 없음
    - 5개 폭(360·390·768·1280·1440) 가로 넘침·상단 메뉴 높이·항목 잘림 자동 검사 + 스크린샷 육안 확인
    - 키보드: 강사 도구 메뉴 이동·Esc 복귀, 모달 포커스 가두기·복귀

  남은 것 (3단계에서)
    - 관리자 목록: 로딩 중에도 "생성된 세션이 없습니다"가 보이는 문제, 관리자 권한 패널 분리(P1-05)
