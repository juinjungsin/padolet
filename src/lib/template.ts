// 세션 템플릿 복제 (P2-02) — 안내·모듈·강사 자료 구조를 재사용하고, 교육생 활동은 복사하지 않는다
import type { Post } from "./firestore";
import type { Module } from "./practice";
import { getPostKind, isInstructorPost } from "./post-kind";

export interface TemplateOptions {
  /** 실습 안내(모듈) 복사 */
  copyModules: boolean;
  /** 강사가 올린 자료·프롬프트·공지·일반 글 복사 (질문 제외) */
  copyInstructorPosts: boolean;
}

export const TEMPLATE_EXCLUDED_NOTICE =
  "교육생 글·질문·대화·제출물·참여자·투표는 복사하지 않습니다. 강사 글의 리액션·댓글도 새로 시작합니다.";

/** 복사 대상 강사 게시물 — 세션 소유자(또는 강사 표시)가 쓴 글 중 질문이 아닌 것 */
export function templatePosts(posts: Post[], sessionOwnerId: string): Post[] {
  return posts.filter((p) => isInstructorPost(p, sessionOwnerId) && getPostKind(p) !== "question");
}

export interface TemplatePlan {
  modules: { newId: string; data: Omit<Module, "id"> }[];
  posts: { newId: string; data: Record<string, unknown> }[];
}

/**
 * 복제 계획 — 새 문서 id를 미리 정해 모듈의 '보드 자료 연결'을 새 게시물 id로 바꿔 둔다.
 * newId는 Firestore 자동 id 생성기를 넘겨받는다 (테스트에서는 결정적 생성기).
 */
export function planTemplateCopy(
  source: { posts: Post[]; modules: Module[]; ownerId: string },
  options: TemplateOptions,
  author: { uid: string; name: string },
  newId: () => string
): TemplatePlan {
  const postIdMap = new Map<string, string>();
  const moduleIdMap = new Map<string, string>();

  const sourcePosts = options.copyInstructorPosts ? templatePosts(source.posts, source.ownerId) : [];
  sourcePosts.forEach((p) => p.id && postIdMap.set(p.id, newId()));
  if (options.copyModules) source.modules.forEach((m) => m.id && moduleIdMap.set(m.id, newId()));

  const modules = options.copyModules
    ? source.modules
        .filter((m) => m.id)
        .map((m) => ({
          newId: moduleIdMap.get(m.id!)!,
          data: {
            title: m.title,
            order: m.order,
            practiceTitle: m.practiceTitle,
            description: m.description ?? "",
            links: m.links ?? [],
            // 복사하지 않은 자료는 연결에서 뺀다
            materialPostIds: (m.materialPostIds ?? []).map((id) => postIdMap.get(id)).filter((id): id is string => !!id),
            dueAt: null, // 마감 시각은 회차마다 다르므로 비운다
            submitUrl: m.submitUrl ?? null,
            submissionEnabled: !!m.submissionEnabled,
          },
        }))
    : [];

  const posts = sourcePosts
    .sort((a, b) => a.gridIndex - b.gridIndex)
    .map((p, i) => {
      const data: Record<string, unknown> = {
        authorId: author.uid,
        authorName: author.name,
        authorRole: "admin",
        kind: getPostKind(p),
        isQuestion: false,
        content: p.content ?? "",
        type: p.type,
        gridIndex: i,
        color: p.color ?? "yellow",
      };
      if (p.title) data.title = p.title;
      if (p.purpose) data.purpose = p.purpose;
      if (p.fileUrl) data.fileUrl = p.fileUrl;
      if (p.fileMeta) data.fileMeta = p.fileMeta;
      if (p.pinned) data.pinned = true;
      const mappedModule = p.moduleId ? moduleIdMap.get(p.moduleId) : undefined;
      if (mappedModule) data.moduleId = mappedModule;
      return { newId: postIdMap.get(p.id!)!, data };
    });

  return { modules, posts };
}
