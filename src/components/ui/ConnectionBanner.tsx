"use client";

import { useSyncExternalStore } from "react";
import { RiWifiOffLine } from "react-icons/ri";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** 브라우저 네트워크 연결 상태 (서버 렌더 시에는 연결됨으로 간주) */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}

/**
 * 실시간 연결 끊김 안내 (요구사항 5.3).
 * Firestore는 끊긴 동안 쓰기를 기기에 보관했다가 다시 연결되면 자동 전송·동기화한다.
 */
export default function ConnectionBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 px-4 py-2 border-b border-silver-mist bg-warn-bg text-warn text-sm"
    >
      <RiWifiOffLine size={16} aria-hidden />
      <span className="font-semibold">인터넷 연결이 끊겼습니다.</span>
      <span className="hidden sm:inline">다시 연결되면 자동으로 최신 내용이 반영됩니다. 작성 중인 내용은 그대로 남아 있습니다.</span>
    </div>
  );
}
