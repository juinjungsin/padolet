"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { isValidCode } from "@/lib/session-code";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const upperCode = code.trim().toUpperCase();
    if (!isValidCode(upperCode)) {
      setError("6자리 입장코드를 정확히 입력하세요.");
      return;
    }
    router.push(`/join?code=${upperCode}`);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-eggshell px-4">
      <div className="text-center mb-12">
        <h1
          className="font-display text-5xl text-obsidian mb-3"
          style={{ fontWeight: 300, letterSpacing: "-0.96px", lineHeight: 1.08 }}
        >
          padolet
        </h1>
        <p className="text-base text-gravel">교육용 실시간 커뮤니케이션 보드</p>
      </div>

      <Card className="w-full max-w-sm p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="text-sm text-gravel">입장코드</label>
          <Input
            variant="contained"
            placeholder="6자리 코드 입력"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError("");
            }}
            maxLength={6}
            className="text-center text-2xl tracking-widest font-medium"
          />
          {error && <p className="text-xs text-ember">{error}</p>}
          <Button type="submit">입장</Button>
        </form>
      </Card>

      <div className="mt-8">
        <Button variant="ghost" onClick={() => router.push("/admin")}>
          강사 로그인
        </Button>
      </div>
    </div>
  );
}
