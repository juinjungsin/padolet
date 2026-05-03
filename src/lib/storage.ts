import { getStorage, ref, uploadBytesResumable, getDownloadURL, UploadTask } from "firebase/storage";
import { getApps } from "firebase/app";

function getStorageInstance() {
  const app = getApps()[0];
  if (!app) throw new Error("Firebase 앱이 초기화되지 않았습니다.");
  return getStorage(app);
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

export function uploadFile(
  sessionId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): { promise: Promise<UploadResult>; task: UploadTask } {
  const storage = getStorageInstance();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `padolet/${sessionId}/${timestamp}_${safeName}`;
  const storageRef = ref(storage, path);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  const promise = new Promise<UploadResult>((resolve, reject) => {
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
          mimeType: file.type,
        });
      }
    );
  });

  return { promise, task };
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
  "text/plain",
  "text/csv",
  "text/markdown",
]);

// SVG는 임의 스크립트를 실행할 수 있어 차단 (이미지로 보이지만 위험)
const BLOCKED_MIME_EXACT = new Set([
  "image/svg+xml",
  "text/html",
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
      errors.push(`${f.name} — 50MB 초과 (${(f.size / 1024 / 1024).toFixed(1)}MB)`);
      return false;
    }
    if (!isAllowedMime(f.type)) {
      errors.push(`${f.name} — 허용되지 않은 형식 (${f.type || "알 수 없음"})`);
      return false;
    }
    return true;
  });

  return { valid, errors };
}
