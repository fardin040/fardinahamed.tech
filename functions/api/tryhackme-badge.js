const TRYHACKME_BADGE_URL = "https://tryhackme-badges.s3.amazonaws.com/fardinahamed.png";
const FALLBACK_PATH = "/assets/images/tryhackme-badge-fallback.svg";

export async function onRequestGet(context) {
  const { request } = context;

  try {
    const upstream = await fetch(TRYHACKME_BADGE_URL, {
      cf: {
        cacheTtl: 900,
        cacheEverything: true
      }
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.toLowerCase().startsWith("image/")) {
      throw new Error("Upstream badge response is not a valid image.");
    }

    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "public, max-age=900, stale-while-revalidate=3600");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(upstream.body, {
      status: upstream.status,
      headers
    });
  } catch {
    const fallbackUrl = new URL(FALLBACK_PATH, request.url);
    return Response.redirect(fallbackUrl.toString(), 302);
  }
}
