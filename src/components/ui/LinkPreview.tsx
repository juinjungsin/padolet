"use client";

import { useEffect, useState, useRef } from "react";

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
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const fetchedRef = useRef(false);

  useEffect(() => {
    // 중복 fetch 방지
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    async function fetchOg() {
      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          setStatus("error");
          return;
        }

        const data: OgData = await res.json();

        if (data.title === url && !data.description && !data.image) {
          setStatus("error");
          return;
        }

        setOg(data);
        setStatus("done");
      } catch {
        setStatus("error");
      }
    }

    fetchOg();

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [url]);

  if (status === "loading") {
    return (
      <div className="mt-2 rounded-xl border border-chalk bg-powder p-3 animate-pulse text-left">
        <div className="h-3 bg-chalk rounded w-3/4 mb-2" />
        <div className="h-2 bg-chalk rounded w-full mb-1" />
        <div className="h-2 bg-chalk rounded w-2/3" />
      </div>
    );
  }

  if (status === "error" || !og) return null;

  const desc = og.description
    ? og.description.split(/\n/).slice(0, 3).join(" ").slice(0, 150)
    : "";

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
        <div className="w-full h-32 bg-powder overflow-hidden">
          <img
            src={og.image}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
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
