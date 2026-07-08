"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import WaveDecor, { WaveUnderline } from "@/components/ui/WaveDecor";
import { isValidCode } from "@/lib/session-code";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const upperCode = code.trim().toUpperCase();
    if (!isValidCode(upperCode)) {
      setError("입장코드 4자리를 정확히 입력하세요.");
      return;
    }
    router.push(`/join?code=${upperCode}`);
  }

  return (
    <div className="flex-1 relative flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
      <div className="relative z-10 text-center mb-10">
        <Image
          src="/icon.png"
          alt="padolet"
          width={108}
          height={108}
          className="mx-auto mb-6 rounded-3xl shadow-[--shadow-card]"
        />
        <span className="inline-block bg-linen text-ochre text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6 tracking-wide">
          교육용 실시간 보드
        </span>
        <h1
          className="font-display text-6xl md:text-7xl text-graphite mb-4"
          style={{ fontWeight: 700, letterSpacing: "-1.6px", lineHeight: 1.05 }}
        >
          padolet
        </h1>
        <WaveUnderline className="mx-auto mb-4" />
        <p className="text-base md:text-lg text-slate-text max-w-md">
          파도치듯 주고받는 커뮤니케이션 보드
        </p>
      </div>

      <Card className="relative z-10 w-full max-w-sm p-8 rounded-2xl border-silver-mist/70 backdrop-blur-sm bg-chalk-card/90">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="text-xs text-ash-text uppercase tracking-wider font-semibold">입장코드</label>
          <Input
            variant="contained"
            placeholder="4자리 코드 입력"
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

      <div className="relative z-10 mt-6">
        <Button variant="outlined" onClick={() => router.push("/admin")}>
          관리자 로그인
        </Button>
      </div>

      <WaveDecor />
    </div>
  );
}
