import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  FirebaseStorage,
  UploadMetadata,
} from "firebase/storage";
import { getApps } from "firebase/app";
import { USE_EMULATOR, EMULATOR_HOST, EMULATOR_PORTS } from "./firebase";
import { formatBytes } from "./format";

let storageInstance: FirebaseStorage | null = null;

function getStorageInstance() {
  if (storageInstance) return storageInstance;
  const app = getApps()[0];
  if (!app) throw new Error("Firebase 앱이 초기화되지 않았습니다.");
  storageInstance = getStorage(app);
  if (USE_EMULATOR) connectStorageEmulator(storageInstance, EMULATOR_HOST, EMULATOR_PORTS.storage);
  return storageInstance;
}

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface UploadProgress {
  progress: number; // 0~100
  status: "uploading" | "done" | "error";
}

// Windows는 .md 등 일부 확장자에 file.type을 비워 보내므로 확장자로 보정
const MIME_BY_EXTENSION: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",
};

function resolveMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "";
}

/**
 * 텍스트 파일의 실제 인코딩 판별.
 * Content-Type에 charset이 없으면 브라우저가 인코딩을 추측하다 한글이 깨진다.
 * 원본 바이트는 그대로 두고 charset만 명시한다 (CP949로 저장된 메모장·엑셀 파일 포함).
 */
async function detectCharset(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer());
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) return "utf-8";
  if (head[0] === 0xff && head[1] === 0xfe) return "utf-16le";
  if (head[0] === 0xfe && head[1] === 0xff) return "utf-16be";
  for (const charset of ["utf-8", "euc-kr"]) {
    try {
      // stream: 1MB 경계에서 잘린 멀티바이트 문자를 오류로 보지 않음
      new TextDecoder(charset, { fatal: true }).decode(head, { stream: true });
      return charset;
    } catch {
      // 다음 후보 인코딩 시도
    }
  }
  return null;
}

// 다운로드 시 저장 경로의 "_" 치환 이름 대신 원래 한글 파일명이 쓰이도록 (RFC 5987)
function contentDispositionFor(name: string): string {
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `inline; filename*=UTF-8''${encoded}`;
}

async function buildMetadata(file: File): Promise<UploadMetadata> {
  const mime = resolveMime(file);
  const charset = mime.startsWith("text/") ? await detectCharset(file) : null;
  return {
    contentType: charset ? `${mime}; charset=${charset}` : mime,
    contentDisposition: contentDispositionFor(file.name),
  };
}

export function uploadFile(
  sessionId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): { promise: Promise<UploadResult> } {
  const storage = getStorageInstance();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `padolet/${sessionId}/${timestamp}_${safeName}`;
  const storageRef = ref(storage, path);

  const promise = buildMetadata(file).then((metadata) => new Promise<UploadResult>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, metadata);
    task.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.({ progress, status: "uploading" });
      },
      (error) => {
        onProgress?.({ progress: 0, status: "error" });
        reject(error);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        onProgress?.({ progress: 100, status: "done" });
        resolve({
          url,
          name: file.name,
          size: file.size,
          mimeType: resolveMime(file),
        });
      }
    );
  }));

  return { promise };
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILES_AT_ONCE = 20;

// XSS / 악성코드 배포 통로가 될 수 있는 형식은 차단. 강의장에서 흔히 쓰는 안전한 포맷만 허용.
export const ALLOWED_MIME_PREFIXES = [
  "image/",
  "audio/",
  "video/",
];
export const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.hancom.hwp",
  "application/x-hwp",
  "application/haansofthwp",
  "application/vnd.hancom.hwpx",
  "application/haansofthwpx",
  "application/x-hwpx",
  "text/plain",
  "text/csv",
  "text/markdown",
  // HTML은 firebasestorage.googleapis.com 출처에서 열리므로 padolet 로그인·데이터에 접근 불가
  "text/html",
]);

// SVG는 임의 스크립트를 실행할 수 있어 차단 (이미지로 보이지만 위험)
const BLOCKED_MIME_EXACT = new Set([
  "image/svg+xml",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-sh",
]);

function isAllowedMime(mime: string): boolean {
  if (!mime) return false;
  if (BLOCKED_MIME_EXACT.has(mime)) return false;
  if (ALLOWED_MIME_EXACT.has(mime)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p)) && !BLOCKED_MIME_EXACT.has(mime);
}

export function validateFiles(files: File[]): { valid: File[]; errors: string[] } {
  const errors: string[] = [];
  const limited = files.slice(0, MAX_FILES_AT_ONCE);

  if (files.length > MAX_FILES_AT_ONCE) {
    errors.push(`한 번에 최대 ${MAX_FILES_AT_ONCE}개까지 업로드 가능합니다. (${files.length}개 선택됨)`);
  }

  const valid = limited.filter((f) => {
    if (f.size > MAX_FILE_SIZE) {
      errors.push(`${f.name} — 50MB 초과 (${formatBytes(f.size)})`);
      return false;
    }
    const mime = resolveMime(f);
    if (!isAllowedMime(mime)) {
      errors.push(`${f.name} — 허용되지 않은 형식 (${mime || "알 수 없음"})`);
      return false;
    }
    return true;
  });

  return { valid, errors };
}
