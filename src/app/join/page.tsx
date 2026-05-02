"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { getSessionByCode } from "@/lib/firestore";
import { addParticipant } from "@/lib/firestore";

function JoinForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const codeFromUrl = searchParams.get("code") || "";

  const [step, setStep] = useState<"code" | "name">(codeFromUrl ? "name" : "code");
  const [code, setCode] = useState(codeFromUrl);
  const [name, setName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (codeFromUrl) {
      verifyCode(codeFromUrl);
    }
  }, [codeFromUrl]);

  async function verifyCode(c: string) {
    setLoading(true);
    setError("");
    try {
      const session = await getSessionByCode(c);
      if (!session) {
        setError("유효하지 않은 코드입니다.");
        setStep("code");
        setLoading(false);
        return;
      }
      setSessionId(session.id);
      setSessionTitle(session.title);
      setStep("name");
    } catch {
      setError("세션 조회에 실패했습니다.");
      setStep("code");
    }
    setLoading(false);
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    await verifyCode(code.trim().toUpperCase());
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!isAnonymous && !name.trim()) {
      setError("이름을 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const displayName = isAnonymous
        ? `익명#${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`
        : name.trim();
      const participantId = await addParticipant(sessionId, {
        name: displayName,
        isAnonymous,
        isOnline: true,
      });
      // 참여자 정보를 sessionStorage에 저장
      sessionStorage.setItem(
        `padolet_${sessionId}`,
        JSON.stringify({ participantId, name: displayName })
      );
      router.push(`/board/${sessionId}`);
    } catch {
      setError("입장에 실패했습니다.");
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-eggshell px-4">
      {step === "code" && (
        <Card className="w-full max-w-sm p-8">
          <h2
            className="font-display text-3xl text-obsidian text-center mb-6"
            style={{ fontWeight: 300, letterSpacing: "-0.64px" }}
          >
            입장코드 입력
          </h2>
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
            <Input
              variant="contained"
              placeholder="6자리 코드"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-medium"
            />
            {error && <p className="text-xs text-ember">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "확인 중..." : "다음"}
            </Button>
          </form>
        </Card>
      )}

      {step === "name" && (
        <Card className="w-full max-w-sm p-8">
          <div className="text-center mb-6">
            <p className="text-xs text-gravel mb-1">{code}</p>
            <h2
              className="font-display text-3xl text-obsidian"
              style={{ fontWeight: 300, letterSpacing: "-0.64px" }}
            >
              {sessionTitle || "세션 입장"}
            </h2>
          </div>
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            {!isAnonymous && (
              <Input
                variant="contained"
                placeholder="이름을 입력하세요"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
              />
            )}
            <label className="flex items-center gap-2 text-sm text-gravel cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="accent-obsidian"
              />
              익명으로 참여
            </label>
            {error && <p className="text-xs text-ember">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "입장 중..." : "입장하기"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-eggshell text-gravel">로딩 중...</div>}>
      <JoinForm />
    </Suspense>
  );
}
