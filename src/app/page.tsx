"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    <div className="flex-1 flex flex-col items-center justify-center bg-parchment px-4 py-16">
      <div className="text-center mb-10">
        <Image src="/icon.png" alt="padolet" width={72} height={72} className="mx-auto mb-5 rounded-2xl" />
        <span className="inline-block bg-linen text-ink text-xs font-semibold px-3 py-1 rounded-full mb-5 tracking-wide">
          교육용 실시간 보드
        </span>
        <h1
          className="font-display text-5xl md:text-6xl text-graphite mb-3"
          style={{ fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08 }}
        >
          padolet
        </h1>
        <p className="text-base text-slate-text max-w-md">
          포스트잇과 채팅으로 강사와 수강생이 한 화면에서 호흡하는 워크스페이스
        </p>
      </div>

      <Card className="w-full max-w-sm p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="text-xs text-ash-text uppercase tracking-wider font-semibold">입장코드</label>
          <Input
            variant="contained"
            placeholder="6자리 코드 입력"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError("");
            }}
            maxLength={6}
            className="text-center text-2xl tracking-widest font-bold font-mono"
          />
          {error && <p className="text-xs text-terracotta">{error}</p>}
          <Button type="submit">입장</Button>
        </form>
      </Card>

      <div className="mt-6 flex items-center gap-4">
        <Button variant="outlined" onClick={() => router.push("/admin")}>
          강사 로그인
        </Button>
        <Button variant="outlined" onClick={() => router.push("/timer")}>
          쉬는시간 타이머
        </Button>
      </div>
    </div>
  );
}
