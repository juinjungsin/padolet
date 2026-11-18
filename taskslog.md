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


Phase 11 — 교육 대시보드 개선 3단계: 자료 분류·검색(P1-02) + 관리자 목록(P1-05) (2026-10-23)

  데이터 (추가 방식, 마이그레이션 없음)
    posts    kind(general|notice|material|question|prompt), title, purpose, authorRole(admin|participant)
             — 이전 글: kind 없으면 isQuestion→질문, 그 외 일반 / 강사 여부는 작성자=세션 소유자로 판단
             — isQuestion은 kind와 함께 계속 저장 (프로젝터 등 이전 화면 호환)
    sessions eventDate("YYYY-MM-DD", 생성일과 별개), lastUsedAt(관리자가 보드에 들어간 시각)

  보안 규칙 변경 (firestore.rules — 배포 필요: 규칙 먼저, 앱 나중)
    - posts 생성: kind 허용 목록, 공지·authorRole=admin은 세션 관리자만
    - 작성자 5분 내 수정: content·editedAt·title·purpose 필드만 (유형·고정·강사 표시 변경 차단)

  변경
    lib/post-kind.ts     유형 판별(이전 데이터 호환)·강사 글 판별·자료 대상·검색(제목·본문·사용 목적·작성자·파일명)·
                         정렬(고정 먼저, 고정끼리 최근 고정순 → 등록/최신/공감)
    lib/session-list.ts  상태(진행 중·종료·보관) 필터, 최근 사용/교육일/생성일 정렬
    PostInput            유형 선택(공지는 강사만), 자료 제목, 프롬프트 제목·사용 목적·원문 보존,
                         실패한 파일만 다시 시도(중복 게시 방지), 평소엔 한 줄로 접힘
    PostCard (분리)      유형별 표시(강사 공지 강조, 자료 제목, 프롬프트 서식 유지·복사), 강사 배지
    MaterialsList (신규) 자료 목록 보기 — 같은 게시물을 목록으로 (원본 복제 없음)
    board 페이지         보드/자료 보기 탭, 게시물 구독 1회, 검색은 받은 데이터에서(서버 요청 없음)
    BoardToolbar         유형 필터, 강사 게시 필터, 정렬 규칙 안내
    admin                검색·상태 필터·정렬, 교육일, 보드 열기·보고서 + 더보기(QR·정보 수정·복제·종료/재개·
                         보관/해제·삭제), 삭제 창에서 보관 권유, 로딩·오류·빈 상태 구분
    admin/settings (신규) 관리자 권한 관리 분리 (최고 관리자 전용)
    report               유형·제목·사용 목적 출력

  검증 (실행): 단위 59/59, 규칙 14/14, E2E 36/36, tsc·build 통과, ESLint 신규 문제 없음(기존 10건 해소)


Phase 12 — 교육 대시보드 개선 4단계: 교육 진행 (P1-01·03·04·06) (2026-10-23)

  데이터 (추가 방식, 마이그레이션 없음)
    sessions.activeModuleId          현재 실습 (세션당 하나)
    sessions/{id}/modules/{mid}      모듈명·실습 제목·설명·자료 링크·보드 자료 연결·마감·제출 링크 (강사만 편집)
    sessions/{id}/progress/{mid}__{uid}      진행 중/완료 — 이름 없이 uid·상태만, 문서 id 고정으로 반복 클릭 중복 없음
    sessions/{id}/helpRequests/{mid}__{uid}  도움 요청 — 본인·강사만 열람, 확인·처리는 강사만, 진행 상태와 별개
    posts    questionStatus(open|answering|resolved — 미설정 질문은 접수), resolvedAt, meToo[uid], moduleId,
             sourceMessageId·originalAuthorId·originalAuthorName (대화 메시지를 질문으로 옮긴 경우)
    messages linkedPostId (질문으로 등록됨 — 게시물 id를 메시지 id로 고정 + 트랜잭션으로 중복 생성 방지)

  보안 규칙 변경 (배포 필요)
    - modules: 읽기 공개, 쓰기 강사
    - progress: 세션 참여자·강사 읽기, 본인 문서만 쓰기(키 제한·모듈 존재 확인), 본인 삭제(=선택 취소)
    - helpRequests: 본인·강사 읽기(아직 없는 내 문서 조회 포함), 본인 생성·다시 요청·취소, 강사 확인·처리
    - posts: 교육생은 접수 상태·빈 meToo로만 생성, 이동 표시 필드 금지, meToo는 본인 uid 하나만 추가·제거

  변경
    GuideBanner (신규)        현재 실습 고정 + 진행 중·실습 완료·도움 필요·질문하기, 교육생에게는 집계만
    ModuleEditorModal (신규)  실습 안내 편집·현재 실습 지정/해제 (URL 검증)
    QuestionsList (신규)      상태(미답변 기본 아님/선택)·내 질문·모듈·최신/공감순, 미답변 수
    InstructorPanel (신규)    강사 진행 요약(도움 요청·미답변·완료/진행/응답 없음) + 상세(요청자 이름, 확인·처리 완료,
                              교육생별 진행) — 강사 계정은 집계 제외
    PostCard                  질문 상태 배지(아이콘+글자), '저도 궁금해요'(내 질문 제외), 강사 상태 변경·재열기
    ChatPanel                 강사 메시지 메뉴(질문으로 등록·숨기기·차단) — 좁은 대화창 글자 단위 줄바꿈 해소
    PostInput·ChatPanel       로컬 경로(file:/// obsidian://) 안내 → 파일 첨부 또는 그대로 게시 (P1-06)
    BoardToolbar              모듈 필터, 좁은 화면 필터 접기, 질문 보기에서는 검색만
    deleteSession             modules·progress·helpRequests까지 삭제
    report                    질문 상태·저도 궁금해요 수·대화에서 옮김 표시

  익명 식별의 한계 (요구사항 P1-03·QA-05 기록)
    - 교육생 식별 = 브라우저의 Firebase 익명 계정. 같은 브라우저 재접속은 같은 사람(진행·저도 궁금해요 유지)
    - 다른 기기·시크릿 창·브라우저 데이터 삭제 시 새 참여자로 집계되고 이전 진행 상태·'저도 궁금해요'와 연결되지 않음
    - 같은 사람이 두 기기로 들어오면 '저도 궁금해요'를 두 번 누를 수 있음 (식별자당 1회 보장)

  검증 (실행): 단위 68/68, 규칙 26/26, E2E 48/48, tsc·build 통과, ESLint 신규 문제 없음(기존 17→7건)
    - 교육생 2명 + 강사 1명 동시 사용(QA-03), 도움 요청·처리 독립(QA-04), 반복 클릭·재접속(QA-05),
      로컬 경로·외부 요청 없음(QA-09), 업로드 일부 실패·재시도 중복 없음(QA-08), 연결 끊김(QA-13), 역할 범위(QA-02)


Phase 13 — 교육 대시보드 개선 운영 배포 (2026-10-23)

  순서 (규칙 먼저 → 앱)
    1. npx firebase-tools deploy --only firestore:rules --project jblet-3e6c3  (Storage 규칙은 변경 없음)
       → 운영 규칙을 내려받아 저장소 firestore.rules와 동일함 확인
    2. main fast-forward 8808503 → 19b87e5, push → Vercel 배포 success
    3. 운영 읽기 전용 점검: 주요 경로 200(/admin/settings 신규 포함), CSP에 에뮬레이터 주소 없음,
       에뮬레이터 로그인 미노출, 상단 메뉴 64px(간격 수정 반영), 390px 가로 넘침 없음, 페이지 오류 없음
  태그: release-20261023 (배포본) / restore-20261023 (배포 전 복구 지점)

  되돌리기
    - 앱: Vercel 대시보드에서 이전 배포(HLoYaCf96xC1roWN3UrTKFo3y7Rn) Instant Rollback, 또는
          git revert --no-commit restore-20261023..HEAD 후 커밋·push
    - 규칙: JBlet\_backups\padolet_restore-point_20261023\firebase-rules\deployed_cloud.firestore.rules 를
            firestore.rules로 덮어쓰고 규칙 배포 (규칙 → 앱 순서 주의: 되돌릴 때는 앱 먼저, 규칙 나중)

  운영 확인 권장 (운영 데이터 쓰기가 필요해 자동 점검에서 제외)
    - 테스트 세션 생성 → 휴대폰으로 첫 시도 입장 → 관리자 목록 누적 입장 증가 확인
    - 실습 안내 지정 → 교육생 화면 상단 고정, 실습 완료·도움 필요, 질문 상태 변경, 보고서 PDF/MD


Phase 14 — P2-01 실습별 제출함 (2026-10-23, 미배포)

  정책 결정 (사용자)
    - 공개: 그 실습에 제출한 교육생끼리 최신 제출물 열람 (제출 전 베끼기 방지). 이력·피드백은 본인·강사만
      (다른 교육생 카드에는 피드백 여부도 표시하지 않음)
    - 파일: 링크를 아는 사람 열람 (보드 첨부와 같은 방식 — Storage 규칙 변경 없음)
    - 익명 식별: 브라우저 기준 유지, 제출 화면에 같은 기기·브라우저 안내

  데이터 (추가 방식)
    modules.submissionEnabled                       실습별 앱 안 제출함 켜기
    sessions/{id}/submissions/{mid}__{uid}          최신 제출 — name, version(1부터 +1), text, files[{name,size,mimeType,url}],
                                                    submittedAt, feedbackStatus(none|reviewed), feedbackVersion, feedbackAt
    .../submissions/{id}/versions/{n}               제출 이력 (교육생 수정 불가) + 강사 피드백(feedback, feedbackAt, feedbackBy)

  보안 규칙 (배포 필요)
    - 제출: 본인 문서, 제출함 켜진 실습, version = 이전+1, 같은 배치에 이력 문서 존재(existsAfter), 피드백 상태 위조 금지, 파일 5개 이하
    - 열람: 강사·본인·같은 실습 제출자(목록 조회 포함), 이력은 본인·강사
    - 피드백: 강사만 (이력 feedback 필드, 최신 문서 feedbackStatus·feedbackVersion·feedbackAt만)

  변경
    SubmissionsView (신규)  제출 탭 — 교육생: 상태(미제출/제출/재제출, 피드백 대기/완료)·제출/다시 제출·성공 확인·
                            이력·제출 후 동료 제출물 / 강사: 실습별 현황(집계 대상 명시)·교육생별 보기·피드백
                            업로드가 하나라도 실패하면 제출 기록을 남기지 않음 (실패를 제출로 세지 않음)
    GuideBanner             '결과 제출하기'(교육생) / '제출 현황 보기'(강사)
    ModuleEditorModal       '앱 안 제출함 열기'
    board                   제출 탭은 제출함이 켜진 실습이 있을 때만, 제출 탭에서는 포스트잇 입력·필터 숨김
    report                  실습 제출 섹션 (명단 제외 시 '교육생 n', 링크 제외 옵션 적용)
    deleteSession           submissions·versions 삭제

  검증: 단위 73, 규칙 33, E2E 55 + 제출 7 통과 / tsc 통과 / ESLint 신규 문제 없음


Phase 15 — P2-03 강사 진행 화면 (2026-10-23, 미배포)

  변경
    /board/{id}/instructor (신규)  강사 전용 한 화면 — 요약 4칸(처리할 도움 요청·미답변 질문·실습 완료·제출) +
                                   도움 요청 처리, 미답변 질문(저도 궁금해요 순, 상태 변경), 교육생별 진행, 제출 현황·피드백
                                   실습 선택, '도움 요청·질문도 이 실습만' 필터, 각 수치에 집계 기준 문구,
                                   상단에 "집계 대상: 교육생 N명 (강사·관리자 계정 제외)"
    InstructorPanel                도움 요청 목록·진행 목록을 공용 컴포넌트로 분리(진행 현황 창과 공유), 진행 요약 막대에 링크
    Nav                            강사 도구 > 강사 진행 화면 (새 창)
  권한: 화면은 세션 소유자·최고 관리자만, 데이터는 기존 규칙(도움 요청·진행·제출 열람 제한)으로 보호
  검증: E2E 3건 (교육생 접근 차단, 수치·처리 반영, 메뉴 진입·360px)


Phase 16 — P2-02 세션 템플릿 (2026-10-23, 미배포)

  변경
    lib/template.ts        복제 계획(순수 함수) — 강사 글(세션 소유자/강사 표시, 질문 제외)만, 새 id를 미리 정해
                           실습 안내의 '보드 자료 연결'을 새 게시물로 다시 연결(교육생 자료 연결은 제외),
                           마감 시각은 비움(회차마다 다름), 작성자는 복제한 강사, 리액션·댓글 수는 새로 시작
    classroom.ts           duplicateSessionFromTemplate — 새 세션 생성 후 모듈·강사 글을 한 배치로 기록
    admin                  '설정 복제' → '템플릿으로 복제' 창 (새 제목·교육일·실습 안내 n개·강사 자료 n개 선택,
                           복사하지 않는 항목 안내). 설명·금칙어·차단 이름은 항상 복사
  복사하지 않음: 교육생 글·질문·대화·제출물·참여자·투표 (요구사항: 교육생 대화·개인 제출물 기본 복제 제외)
  데이터·규칙 변경 없음 (기존 규칙으로 강사가 자기 세션에 쓰기)
  검증: 단위 3건(복사 대상·연결 재매핑·옵션), E2E 1건(복제 창 → 새 세션 보드·실습 안내·제출함 확인)

Phase 17 — P2-04 프로젝터 크게 보기 개선 (2026-10-23, 미배포)

  변경
    firestore.ts           세션에 spotlight {kind: post|submission, refId, showName, snapshot?} 추가.
                           setSpotlightPost가 spotlightPostId(이전 방식)와 spotlight를 함께 기록
    classroom.ts           setSubmissionSpotlight(제출물 글·파일명·회차만 복사, 이름·피드백·이력은 복사 안 함),
                           setSpotlightShowName(제출물은 켤 때만 이름 복사, 끄면 삭제), clearSpotlight
    SpotlightControl       강사 보드·강사 진행 화면 상단 — 무엇이 떠 있는지, 이름 표시/숨기기, 크게 보기 해제
    projector              질문이면 처리 상태 배지와 저도 궁금해요 수, 작성자 이름은 강사가 켰을 때만.
                           제출물은 복사된 글·이미지·파일명과 n번째 제출만 표시
    SubmissionsView        강사 제출 현황에서 프로젝터에 크게 보기 (이름 숨김)
  정책: 작성자 이름 기본 숨김, 강사가 켜기 (2026-10 사용자 결정)
  세션 문서는 공개 읽기이므로 제출물 이름은 강사가 이름 표시를 켤 때만 세션 문서에 복사한다
  규칙 변경 없음 (세션 소유자 수정 규칙 그대로). 이전 데이터(spotlightPostId만 있음)도 게시물 크게 보기로 표시
  검증: E2E 4건(질문 크게 보기·이름 토글·제출물 크게 보기·해제), 스크린샷 확인

Phase 18 — P2 운영 배포 (2026-10-23)

  사용자 승인 후 배포
    1. Firestore 규칙 (submissions 추가) — firebase deploy --only firestore:rules --project jblet-3e6c3
       Storage 규칙·인덱스는 변경 없음 (제출 파일은 보드 첨부와 같은 경로·검사)
    2. feature/p2 → main fast-forward (8469b21..6b9d541) push → Vercel 자동 배포
    3. 태그 release-20261023-p2
  배포 확인: 운영 /board/{id}/instructor 경로 응답 200 (없는 경로는 404)
  배포 전 검증: 단위 76 · 규칙 33 · E2E 63 통과, tsc·build 통과, ESLint 기존 7건 외 신규 없음
  되돌리기: 앱은 release-20261023으로, 규칙도 같은 태그의 firestore.rules로 재배포.
            새 submissions 데이터는 이전 앱에서 쓰이지 않음 (이전 규칙은 기본 거부)
  운영 변화: 프로젝터 크게 보기에서 작성자 이름이 기본 숨김 (강사가 이름 표시를 켜야 보임)

Phase 19 — 메인 화면 아이콘 크기 (2026-10-23)

  증상: 메인(/) 아이콘이 108px 자리에서 약 44px로 작게 보임 (개편 전 복구 지점에서도 동일)
  원인: public/icon.png가 정사각형이 아닌 2816x1536 가로형 이미지(가운데 아이콘 + 넓은 여백)라
        108px 폭에 맞춰 108x59로 줄고, 그 안의 아이콘은 더 작게 보임
  조치: 아이콘 부분만 정사각형으로 잘라낸 public/logo.png(512x512) 추가, 메인 화면만 logo.png 사용 → 108x108
        icon.png는 그대로 (사이트 아이콘·상단 메뉴·프로젝터·타이머에서 사용 중)
  검증: 1440px·360px 렌더링 108x108 측정, 레이아웃 E2E 8건, build 통과

Phase 20 — 상단 메뉴 로고 크기 (2026-10-23)

  증상: 보드 입장 후 왼쪽 위 로고가 28px 자리에서 28x15로 줄어 아이콘이 작게 보임 (Phase 19와 같은 원인)
  조치: Nav 로고를 logo.png로 교체 → 28x28. Nav를 쓰는 보드·강사 진행 화면·관리자 화면 모두 적용
        icon.png는 사이트 아이콘(apple)·프로젝터·타이머에서 계속 사용
  검증: 1440px·360px 렌더링 28x28 측정, E2E 11건(layout·강사 진행 화면), build 통과

Phase 21 — 첨부 파일 1개 상한 50MB → 100MB (2026-10-24)

  배경: 사용자 요청. 운영 Storage 252MB/파일 150개(무료 저장 5GB), 50MB 이상 파일 0개, 최대 37.2MB (10/24 조회)
  변경
    storage.rules          size < 50MB → size <= 100MB (상한 크기까지 허용 — 앱 검사와 경계 일치)
    lib/storage.ts         MAX_FILE_SIZE_MB = 100 상수, 초과 안내 문구도 상수에서
    PostInput·ChatPanel    "최대 50MB" 안내를 상수로 (보드 첨부·대화 첨부·실습 제출 공통)
  이전에는 정확히 50MB인 파일을 앱은 통과시키고 규칙은 거절하는 1바이트 차이가 있었음 → 둘 다 100MB까지 허용으로 통일
  검증: 단위 3건(60MB·100MB 통과, 100MB+1 거절), Storage 규칙 4건(신규 — 예전 규칙에서는 60MB·100MB가 실패함을 확인),
        단위 79 · 규칙 37 · E2E 63 통과, build 통과
  배포: storage 규칙 먼저 → main push
  참고: 버킷이 US-CENTRAL1이라 한국에서 100MB 업로드는 수십 초~수 분, 다운로드 무료 월 100GB 초과분은 과금

Phase 22 — 보드 편집·칸반·작업 흐름도 (2026-11-18, 운영 배포 완료)

  사용자 요청 8항목 반영
    1. 포스트잇 위치·컬러: 배치순에서 드래그 이동, 설정에서 배치 번호·4가지 색상 변경. 자신의 문서만 갱신하는 순서 계산.
    2. 포스트잇 제목: 모든 유형(파일·이미지 포함)에 제목 설정. 작성자/보드 관리자, 설정은 5분 제한 없음. 본문 제한은 유지.
    3. 보드·대화 너비: 포인터 드래그·방향키, 브라우저 저장, 두 번 클릭 초기화. 좁은 화면은 기존 탭 유지.
    4. 보드 제목: 등록 관리자 중 보드 소유자·최고관리자만. UI와 Firestore 규칙 양쪽 검사.
    5. 대화 삭제: 작성자·보드 관리자, 확인 후 삭제. 질문으로 복사한 내용·Storage 첨부 원본은 유지.
    6. 정렬: 게시물 배치/최신/오래된/제목·내용/작성자/공감, 대화 오래된/최신/작성자/내용. 대화는 로드한 범위임을 안내.
    7. 칸반: 할 일·진행 중·완료, 드래그 또는 선택 메뉴. 기존 포스트잇과 같은 문서의 kanbanStatus 사용.
    8. 흐름도: 참여자별 1개 공유 문서. 작업·분기·시작/종료, 이름/종류 변경, 드래그·방향키 이동,
       연결선·설명·삭제. 명시적 저장, revision 트랜잭션으로 동시 수정 충돌 탐지 및 초안 보존.

  권한·데이터
    잠금 시 참여자의 설정·칸반·대화 삭제·흐름도 쓰기 차단. 보드 관리자는 기존 관리 권한 유지.
    대화 본인 수정은 content/editedAt만 허용해 authorId 변경을 통한 삭제 권한 우회 차단.
    sessions/{sessionId}/flowcharts/{uid}: title, nodes, edges, revision, updatedAt.
    세션 삭제 시 flowcharts 정리. 기존 포스트잇은 kanbanStatus 미설정 시 '할 일'. 일괄 마이그레이션 불필요.
    흐름도 한도: 단계 100·연결선 200. 타인의 흐름도는 읽기, 보드 관리자는 편집 가능.

  검증
    단위 83건, Firestore/Storage 규칙 42건 통과.
    전체 E2E 67개 시나리오 실행: 59개 통과 후 탭 줄바꿈·새 메뉴 기대값·오류 선택자 수정.
    영향받은 board-tools/layout/regression 21건 재검증 전부 통과 (이전 실패 및 미실행 8건 포함).
    새 기능: 데스크톱·390px, 드래그 위치, 저장/새로고침, 칸반, 대화 삭제, 분할 너비, 흐름도·충돌 처리 검증.
    레이아웃: 360/390/768/1280/1440px 통과. 신규 컴포넌트·유틸·테스트 ESLint 통과.
    전체 ESLint는 기존 7건(오류 3·경고 4) 유지, 타입 검사 및 최종 운영 빌드 통과.

  배포: 사용자 지시에 따라 Firestore 규칙 선배포 후 main push 완료. README에 사용법 추가.
    Firebase jblet-3e6c3: firestore.rules 컴파일·업로드·release 성공 (Storage·인덱스 변경 없음).
    기능 커밋: 5551f5981a0eaac21471b869fb5fffc5548931af.
    Vercel: dpl_2tFwRNRK2GuPrpJxwgfbhcz2NLsb, production READY, 빌드 약 36초.
    운영: https://padolet.vercel.app — 홈·입장·보드 경로 HTTP 200.
    운영 JS에서 kanbanStatus·flowcharts·너비 조절·제목/색상/위치 변경 코드 제공 확인.
    배포 직후 해당 배포의 error/fatal 서버 로그 없음. 실제 운영 사용자 데이터의 생성·수정·삭제 테스트는 하지 않음.
    되돌리기 기준: 이전 운영 배포 dpl_BPCcqRrNJAL64YooQGnF9ADkP8eR (4717a75).

Phase 23 — 흐름도 연결 UX·확장 캔버스·이미지 저장·공유 (2026-11-18)

  변경
    기본 연결: 출발 객체 좌클릭 선택 → 도착 객체 우클릭. 우클릭이 출발 선택을 바꾸지 않도록 이벤트 분리.
    모바일/키보드: '선택 객체에서 연결' → 도착 객체 탭/Enter, Shift+F10 연결 지원.
    객체 생성: 도구 버튼·빈 공간 더블클릭, 현재 화면 중앙에 배치하고 이름 입력에 포커스.
    화면 이동: 빈 공간 드래그. 휠·핀치·버튼 확대/축소, 전체 보기, 100% 복원.
    기존 1400×960 경계 제거, 음수·큰 좌표 허용. 확대율의 고정 상하한 없이 유한 수치 범위에서 계산.
    별도 창: 동일 React 상태를 포털로 이동하여 초안·권한·선택·저장 충돌 검사 유지. 닫으면 보드로 복귀.
    PNG/JPG: 화면 확대율과 무관한 전체 영역, XML escape, 흰 배경, 최대 8192px/1600만 화소.
    공유: 이미지 미리보기 → 확인 → 기존 Storage 업로드 → 게시물/대화에 이미지 첨부.
          최신 잠금·차단·금칙어 검사. 업로드 성공 후 게시 실패 시 업로드 결과 재사용.

  검증
    단위 86건 통과, 타입 검사·변경 파일 ESLint·운영 빌드 통과.
    board-tools 4건 및 flowchart-ux 2건 통과: 우클릭/중복 연결, 팝업 초안 보존,
    확대·축소, PNG/JPG 시그니처, 포스트잇·대화 이미지 게시, 모바일 연결, 팝업 차단, 잠금 권한.
    PNG 결과를 시각 확인 (한글 객체명·연결선·전체 이미지 정상).

  배포 방식: 기존 Firestore/Storage 규칙과 데이터 구조를 사용하며 앱만 main push로 배포.
  제한: 객체 수 100·연결선 200은 유지. 공유는 편집 가능한 원본이 아닌 이미지 사본.

Phase 24 — Wanted Sans 웹폰트 교체 (2026-11-18)

  공식 wanteddev/wanted-sans v1.0.3의 한글·영문 가변 WOFF2를 프로젝트에 포함.
  next/font/local로 본문·제목·워드마크에 적용, 공식 굵기 범위 400–1000 사용.
  기존 Plus Jakarta Sans·Fraunces 로딩 및 Fraunces 전용 축 설정 제거.
  public/fonts/wanted-sans에 원본 글꼴·OFL 라이선스·출처 및 SHA-256 기록.
  검증: 운영 빌드·변경 파일 ESLint 통과, layout E2E 8건 통과.
    360/390/768/1280/1440px에서 글꼴 로딩·가로 넘침·메뉴·보드 버튼·키보드 동작 확인.
    웹폰트 로딩을 기다린 후 레이아웃을 검사하도록 보강, 390px 홈 화면 시각 확인.
  배포 방식: 앱만 main push로 운영 배포. 데이터·보안 규칙 변경 없음.

Phase 25 — 자기 업무 파악·조직 협업용 업무 리디자인 구성도 (2026-11-19)

  변경
    내 업무 / 조직 협업 템플릿, 기존 초안 교체 전 확인.
    객체별 담당 조직·역할·입력·산출물·시스템·작업/대기 시간·문제점·개선 방향·개선 후 업무안.
    조직별 구획과 연결 의존 순서 자동 배치. 피드백 순환 허용, 자유 배치 전환 시 좌표 보존.
    연결별 순서/요청/전달/승인/피드백 및 전달 산출물·인수/완료 조건 편집. 피드백은 점선.
    진단: 담당 역할/산출물 누락, 작업보다 긴 대기, 조직 간 전달 산출물 누락. 해당 객체로 이동.
    시간은 입력 단계의 단순 합계이며 병렬·반복을 반영한 전체 처리 시간이 아님을 표시.
    진단서 Markdown 저장: 업무 상세·현재 문제점·개선안·협업 합의 전체 포함.
    PNG/JPG·이미지 공유에 조직 구획·역할·개선 방향·협업 유형 반영, 연결선과 글자 겹침 시 흰 테두리.

  데이터·권한
    기존 nodes/edges에 선택적 work/collaboration, 최상위 선택적 layout(free/organization) 추가.
    기존 문서는 변환 없이 읽기. 기존 소유권·관리자 권한·잠금·revision 충돌 검사 유지.
    업무 메타데이터의 문자열 길이·수치·열거형 검증, 공유 시 추가 업무 내용도 금칙어 검사.
    Firestore 규칙에 layout 허용값만 추가. Storage 규칙 변경 없음.

  검증
    단위 90건 및 보안 규칙 43건 통과. 타입 검사·변경 파일 ESLint·운영 빌드 통과.
    기존 board-tools/flowchart-ux 6건 통과. 신규 업무 리디자인 2건 최종 통과.
    접근성 이름이 텍스트 입력 후 변하지 않도록 textarea/select의 명시적 레이블 보완.
    저장/새로고침 복원, 협업 조건/진단서, PNG, 템플릿 취소, 모바일, 타인 읽기/편집 차단 검증.
    조직 구획 PNG 시각 확인. 마지막 유효성 검증·글자 대비 보완 후 관련 단위 7건 재통과.

  배포 방식: Firestore 규칙 선배포 후 앱 main push. 기존 데이터 일괄 변환 없음.

Phase 26 — Markdown 업무 설명 → AI 구성도 생성 (2026-11-19)

  사용자 입력 API 키 방식
    흐름도에 'MD 파일에서 AI로 흐름도 만들기' 추가. OpenAI API 키(암호 입력)·모델 ID·MD 파일 선택.
    OpenAI Responses API + strict JSON Schema, 기본 gpt-4o-mini, store:false, 고정 HTTPS 엔드포인트.
    키는 화면 메모리와 요청 처리 중에만 사용. 환경 파일·브라우저 저장소·Firestore·로그에 기록하지 않음.
    원본 MD는 파일 저장소에 보관하지 않으며 생성 버튼을 누를 때만 외부 전송. API 비용 안내.

  생성·적용
    UTF-8 .md/.markdown, 128KB/60,000자 제한, 문서 내용 미리보기.
    문서의 현재 업무 단계·조직·역할·입출력·시스템·협업 조건 추출. 미기재 정보는 빈 값/시간 null.
    개선안은 원문에 명시된 경우만 추출. 문서 내 지시를 명령으로 따르지 않도록 시스템 지침 분리.
    생성 결과를 별도 캔버스·읽기 전용 업무 상세·AI 확인 사항으로 검토 후 초안 적용.
    기존 구성도 교체 확인, 현재 revision 유지, 흐름도 저장 전에는 원본 변경 없음.
    취소·키/모델/한도 오류·거절·미완료·잘못된 JSON/연결 참조는 기존 흐름도 보존.
    단계/연결 수, 중복 ID·연결, 자기 연결, 문자열/시간/열거형 검증 후 허용 필드만 재구성.
    화면과 미리보기 SVG의 marker/pattern ID를 분리.

  서버 경계
    /api/flowcharts/generate: 같은 origin, Firebase accounts:lookup으로 ID token 확인,
    Firestore에서 보드 참여/소유자·최고관리자/잠금/차단 상태 검사 후 OpenAI 호출.
    요청 256KB·AI 응답 1MB 스트림 크기 제한, 외부 리다이렉트 차단, 90초 제한.
    공급자 오류 원문은 반환하지 않아 키/문서가 오류로 노출되지 않음. 응답 no-store.
    Firestore/Storage 규칙·데이터 구조 변경 없음. 공용 AI 키 설정 불필요.

  검증
    단위 102건, 관련 E2E 7건, 변경 파일 ESLint·TypeScript·운영 빌드 통과.
    업로드/미리보기/교체 취소·적용/저장 복원, 키 비저장, 파일 크기·확장자·인코딩, API 오류·취소 검증.
    실제 로컬 서버 경로에서 Firebase 인증 후 비참여자·잠금 요청 차단 확인.
    AI 공급자는 테스트 응답으로 대체했으며 실제 유료 API 호출은 실행하지 않음.
    공식 OpenAI Structured Outputs 및 Firebase Auth REST 문서 기준 구현. README에 사용법 추가.

  배포 방식: 앱 main push로 운영 배포. API 키/환경 변수 추가 없이 사용자 키로 실행.

Phase 27 — OpenAI 모델 선택 목록 (2026-11-19)

  모델 ID 입력란을 선택 목록으로 변경. GPT-6 Luna(기본), GPT-6.2 Sol, GPT-6.1 Terra,
  GPT-6.2 Astra 및 '직접 입력' 제공. 직접 입력값은 목록 전환 후에도 화면 내에서 유지.
  공식 모델 문서에서 Responses API·Structured Outputs·출력 16,000토큰 지원 확인.
  기존 기본 모델의 Deprecated 표시를 확인해 현재 모델로 기본값 갱신.
  API 키에 따라 접근 권한이 다름을 안내. 생성 중 모델 변경 차단.
  기존 E2E에서 목록 모델/직접 입력의 요청 전달, 빈 직접 입력 차단, 모바일 전환 검증.
  관련 브라우저 3건·변경 파일 ESLint 통과. 유료 AI 호출 없이 테스트 응답 사용.

Phase 28 — 예시 양식의 업무 단계 추출 실패 보완 (2026-11-19)

  제공된 회계 양식은 실제 업무값 대신 [예: …] 절차와 참고 수치를 포함한 미작성 양식임을 확인.
  실제 업무/예시 기반 초안 모드 분리. 번호가 연속된 예시 절차가 한 구역에 있으면 예시 모드 자동 선택.
  API 키 없이 명시된 예시 절차로 즉시 초안 생성 가능. 복수 절차·빈칸·혼합/불연속 번호는 자동 연결하지 않음.
  예시 제목에 [예시 초안], 검토 안내 추가. 예시 생성 결과의 작업/대기 시간은 제거.
  AI가 완료 응답에서 빈 단계를 반환한 경우에만 예시 절차로 대체하며 추가 API 호출 없음.
  거절·잘린 응답·잘못된 연결·인증 오류는 대체하지 않음. 실제 업무 모드는 예시와 분리.
  서술형·인터뷰·업무 목록도 분석하고 담당자/순서 누락만으로 빈 결과를 반환하지 않도록 지침 보완.

  검증: 상시 단위 115건과 실제 제공 파일 임시 검사 1건 통과 (5단계·4연결).
  사용자 파일 및 경로는 저장소에 포함하지 않음. 일반화된 양식으로 회귀 검사 추가.
  브라우저 4건, 변경 파일 ESLint·타입 검사·운영 빌드 통과.
  예시 모드 전환·키 없는 생성·적용·저장 복원, 기존 AI 생성·모델 선택·취소·권한 차단 확인.
  실제 유료 AI 호출은 실행하지 않음. Firestore 규칙/데이터 구조 변경 없음.

Phase 29 — 문서 이해를 바탕으로 흐름도 구성 (2026-11-19)

  기존 실제 단계만 추출하는 프롬프트/응답 계약을 제거.
  AI가 전체 문서의 목적·활동·입출력·관계·근거를 구조화한 뒤 앱이 도식을 결정적으로 생성.
  활동 최소 1개 스키마, 문서 문맥에서 필요한 활동·순서를 도출하고 예시/추정을 구분.
  실제/예시 선택 UI 제거. 이전 클라이언트가 actual/example을 보내도 새로운 이해 경로 사용.
  미리보기에 'AI가 파악한 업무'와 문서 유형 표시. 활동/연결에 [예시]/[추정]과 원문 발췌 보존.
  원문 근거(공백 정규화), ID/연결, 수량/문자열 제한 검증. 모르는 조직·담당자는 빈 값.
  예시·추정 시간은 실제 시간으로 저장하지 않음. API 호출은 1회, 거절/미완료는 성공으로 위장하지 않음.
  번호 기반 로컬 예시 생성은 접힌 보조 기능으로 유지. 기본 AI 경로에서는 사용하지 않음.

  검증: 단위 122건, 브라우저 4건, 변경 파일 ESLint·타입 검사·운영 빌드 통과.
  서술형 분석 결과의 활동/추정 연결, 예시 조건 분기, 잘못된 인용/연결 차단,
  이전 모드 요청 호환, 업무 이해 미리보기·적용·저장·취소·권한 차단 확인.
  실제 유료 모델 호출 및 해석 품질 검증은 미실행; 서버 응답 대역을 사용한 회귀 검사임.
  OpenAI Structured Outputs 문서의 배열 minItems/maxItems 지원 확인. 규칙/DB 구조 변경 없음.
