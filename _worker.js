const TRYHACKME_BADGE_URL = "https://tryhackme-badges.s3.amazonaws.com/fardinahamed.png";
const FALLBACK_BADGE_PATH = "/assets/images/tryhackme-badge-fallback.svg";

async function serveFallbackBadge(request, env) {
  const fallbackUrl = new URL(FALLBACK_BADGE_PATH, request.url);
  const fallbackRequest = new Request(fallbackUrl.toString(), request);
  const fallbackResponse = await env.ASSETS.fetch(fallbackRequest);

  const headers = new Headers(fallbackResponse.headers);
  headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(fallbackResponse.body, {
    status: fallbackResponse.status,
    headers
  });
}

async function serveTryHackMeBadge(request, env) {
  try {
    const upstream = await fetch(TRYHACKME_BADGE_URL, {
      cf: {
        cacheTtl: 900,
        cacheEverything: true
      }
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.toLowerCase().startsWith("image/")) {
      return serveFallbackBadge(request, env);
    }

    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "public, max-age=900, stale-while-revalidate=3600");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(upstream.body, {
      status: upstream.status,
      headers
    });
  } catch {
    return serveFallbackBadge(request, env);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/tryhackme-badge") {
      return serveTryHackMeBadge(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
