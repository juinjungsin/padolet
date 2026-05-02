import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url 파라미터 필요" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; padolet/1.0)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ title: url, description: "", image: "" });
    }

    const html = await res.text();
    const maxLen = 50000;
    const head = html.slice(0, maxLen);

    const title =
      getMetaContent(head, "og:title") ||
      getMetaContent(head, "twitter:title") ||
      getTitleTag(head) ||
      url;

    const description =
      getMetaContent(head, "og:description") ||
      getMetaContent(head, "twitter:description") ||
      getMetaContent(head, "description") ||
      "";

    const image =
      getMetaContent(head, "og:image") ||
      getMetaContent(head, "twitter:image") ||
      "";

    const siteName = getMetaContent(head, "og:site_name") || "";

    // 상대 경로 이미지 처리
    let absoluteImage = image;
    if (image && !image.startsWith("http")) {
      try {
        absoluteImage = new URL(image, url).href;
      } catch {
        absoluteImage = "";
      }
    }

    return NextResponse.json({
      title: title.slice(0, 200),
      description: description.slice(0, 300),
      image: absoluteImage,
      siteName,
    });
  } catch {
    return NextResponse.json({ title: url, description: "", image: "", siteName: "" });
  }
}

function getMetaContent(html: string, property: string): string {
  // og:*, twitter:* → property 속성
  const propRegex = new RegExp(
    `<meta[^>]*(?:property|name)=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const match = html.match(propRegex);
  if (match) return decodeHtmlEntities(match[1]);

  // content가 앞에 오는 경우
  const reverseRegex = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapeRegex(property)}["']`,
    "i"
  );
  const reverseMatch = html.match(reverseRegex);
  if (reverseMatch) return decodeHtmlEntities(reverseMatch[1]);

  return "";
}

function getTitleTag(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
