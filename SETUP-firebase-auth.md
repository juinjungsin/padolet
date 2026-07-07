Firebase Auth 이중 로그인 및 Rules 배포 절차

작성일: 2026-07-08
대상: padolet (jblet-3e6c3)

배경
- Firestore Rules가 request.auth.token.email로 관리자를 판별하지만,
  기존 앱은 NextAuth만 사용하고 Firebase Auth로 로그인하지 않음 → write 100% 실패.
- 해결: NextAuth 성공 시 Google id_token으로 Firebase Auth 이중 로그인.
  참여자는 signInAnonymously로 uid 확보.


Step 1. Firebase Console 세팅 (5분)

1-1) Sign-in method 활성화
  - URL: https://console.firebase.google.com/project/jblet-3e6c3/authentication/providers
  - Google Provider: Enabled 확인
  - Anonymous Provider: Enable 클릭 → Save
    (참여자용. 무료 티어 월 50K uid 무료)

1-2) Authorized domains 확인
  - 같은 페이지 하단
  - localhost, padolet.vercel.app, juinjungsin.site 등록 확인
  - 없으면 Add domain으로 추가

1-3) Google OAuth 클라이언트 확인 (관리자 로그인용)
  - URL: https://console.cloud.google.com/apis/credentials?project=jblet-3e6c3
  - Web application 클라이언트의 Authorized redirect URIs에
    http://localhost:3000/api/auth/callback/google
    https://padolet.vercel.app/api/auth/callback/google
    포함 확인


Step 2. Firestore Rules 배포 (2분)

로컬 터미널에서 실행 (별도 PowerShell 창):

  cd "C:\Users\juinj\OneDrive\바탕 화면\JBlet\padolet"
  npx firebase-tools deploy --only firestore:rules --project jblet-3e6c3

인덱스도 배포 (선택, 없으면 자동 프롬프트):

  npx firebase-tools deploy --only firestore:indexes --project jblet-3e6c3

성공 시 출력 예:
  ✔  Deploy complete!
  Project Console: https://console.firebase.google.com/project/jblet-3e6c3/overview


Step 3. 로컬 테스트 (10분)

3-1) 개발 서버 실행
  cd padolet
  npm run dev

3-2) 관리자 흐름 검증
  - http://localhost:3000/admin 접속
  - "Google로 로그인" → jongbin@gmail.com 선택
  - 개발자도구 Console에서 [FirebaseAuthSync] 에러 없는지 확인
  - "새 세션 생성" → 제목 입력 → 생성
  - Firestore Console에서 sessions/{id}.createdBy가 firebase auth uid로 저장됐는지 확인

3-3) 참여자 흐름 검증
  - 시크릿 창 또는 다른 브라우저로 QR/코드 스캔
  - /join → 코드 입력 → 이름 입력 → 입장
  - Firestore Console에서 sessions/{id}/participants/{uid} 문서 생성 확인
  - 포스트잇 작성 → posts/{id}.authorId가 참여자 uid와 일치 확인
  - 대화 입력 → messages/{id} 정상 생성 확인

3-4) 권한 위반 시나리오 (Rules가 방어하는지)
  - 관리자 로그인 없이 브라우저 콘솔에서 세션 생성 시도
    → Missing or insufficient permissions 에러 확인
  - 다른 참여자의 포스트잇 삭제 시도
    → 권한 거부 확인


Step 4. 커밋 및 배포 (5분)

  cd padolet
  git add firestore.rules firestore.indexes.json firebase.json .firebaserc
  git add src/lib/firebase.ts src/lib/firestore.ts
  git add src/app/api/auth/[...nextauth]/route.ts
  git add src/app/admin/page.tsx src/app/join/page.tsx
  git add src/components/auth/FirebaseAuthSync.tsx src/components/auth/AuthProvider.tsx
  git add taskslog.md SETUP-firebase-auth.md
  git commit -m "Firestore Rules 재설계 + Firebase Auth 이중 로그인 적용"
  git push

Vercel이 GitHub 연동이므로 push 즉시 프로덕션 배포 트리거됨.


Self-Verification Checklist

빌드 검증
  [ ] npm run build 성공 (TypeScript 컴파일 오류 없음)
  [ ] npm run lint 통과

Firebase 세팅
  [ ] Anonymous Auth 활성 (Console에서 Enable 확인)
  [ ] Google Auth 활성 유지
  [ ] Authorized domains에 로컬/프로덕션 도메인 포함
  [ ] Firestore Rules 배포 성공 (firebase deploy 출력 확인)

관리자 흐름
  [ ] /admin 로그인 후 세션 생성 성공
  [ ] Firestore의 sessions/{id}.createdBy가 firebase uid로 기록됨
  [ ] 세션 목록에 방금 생성한 세션이 표시됨
  [ ] 세션 삭제 시 posts/messages/participants 하위 컬렉션도 함께 삭제
  [ ] 브라우저 콘솔에 FirebaseAuthSync 에러 없음

참여자 흐름
  [ ] /join?code=XXXXXX → 이름 입력 → 입장 성공
  [ ] participants/{uid} 문서 생성 확인
  [ ] 포스트잇 작성 → posts/{id}.authorId == uid
  [ ] 대화 입력 → messages/{id} 생성
  [ ] 재입장 시 participantCount가 중복 증가하지 않음 (setDoc merge + isNew 체크)

Rules 방어
  [ ] 비인증 상태에서 write 시도 → permission-denied
  [ ] 참여자가 관리자 세션 update 시도 → permission-denied
  [ ] 참여자가 다른 참여자의 posts 삭제 시도 → permission-denied
  [ ] 5분 window 초과 후 본인 포스트 편집 시도 → permission-denied


알려진 제약 사항

1) Google id_token 유효기간 약 1시간
   - NextAuth 세션은 8시간이지만 Firebase Auth는 1시간마다 만료
   - 만료 후 write 시도 시 permission-denied 발생
   - 완화: 관리자에게 재로그인 유도 안내 (추후 자동 refresh 구현 필요)

2) 기존 세션 데이터의 createdBy 값 불일치
   - 기존 세션은 createdBy에 NextAuth의 sub(Google user ID) 저장
   - 새 rules는 firebase auth uid 요구 → 기존 세션은 소유자로 인식 안 됨
   - super_admin(jongbin@gmail.com)은 getAllSessions로 여전히 조회 가능
   - 기존 세션 삭제 원하면 super_admin으로 로그인 후 처리

3) Anonymous Auth 사용자 uid는 브라우저별로 다름
   - 다른 브라우저·시크릿 창으로 재접속 시 새 uid 발급 → 새 참여자로 취급
   - 강의 특성상 문제 없음 (참여자는 매 회 새로 등록)

4) 세션 삭제 시 관리자가 재귀적으로 하위 문서 삭제
   - deleteSession은 writeBatch로 하위 참여자/포스트잇/메시지를 일괄 삭제
   - 각 delete op에도 Rules가 적용됨 → 세션 관리자 권한 있어야 성공
