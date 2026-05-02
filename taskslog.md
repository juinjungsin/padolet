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
