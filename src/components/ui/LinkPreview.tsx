"use client";

import { useEffect, useState } from "react";

interface OgData {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

interface LinkPreviewProps {
  url: string;
}

export default function LinkPreview({ url }: LinkPreviewProps) {
  const [og, setOg] = useState<OgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    async function fetchOg() {
      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) {
          // 제목이 URL 자체이고 설명/이미지도 없으면 미리보기 불필요
          if (data.title === url && !data.description && !data.image) {
            setError(true);
          } else {
            setOg(data);
          }
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOg();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 rounded-xl border border-chalk bg-powder p-3 animate-pulse text-left">
        <div className="h-3 bg-chalk rounded w-3/4 mb-2" />
        <div className="h-2 bg-chalk rounded w-full mb-1" />
        <div className="h-2 bg-chalk rounded w-2/3" />
      </div>
    );
  }

  if (error || !og) return null;

  const desc = og.description
    ? og.description.split(/\n/).slice(0, 3).join(" ").slice(0, 150)
    : "";

  // 도메인 추출 (siteName 없을 때 대체)
  let domain = og.siteName;
  if (!domain) {
    try {
      domain = new URL(url).hostname.replace("www.", "");
    } catch {
      domain = "";
    }
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block rounded-xl border border-chalk bg-white overflow-hidden hover:border-slate transition-colors no-underline text-left"
    >
      {og.image && (
        <div className="w-full h-32 bg-powder">
          <img
            src={og.image}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
          />
        </div>
      )}
      <div className="p-3">
        {domain && (
          <p className="text-[10px] text-slate uppercase tracking-wide mb-0.5">{domain}</p>
        )}
        <p className="text-sm font-medium text-obsidian leading-snug line-clamp-2">
          {og.title}
        </p>
        {desc && (
          <p className="text-xs text-gravel mt-1 leading-relaxed line-clamp-3">
            {desc}
          </p>
        )}
      </div>
    </a>
  );
}
