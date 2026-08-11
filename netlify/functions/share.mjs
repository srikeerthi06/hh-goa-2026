import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const STORE_NAME = "hh-goa-share-images";

function htmlEscape(value = "") {
  return value.replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
}

// Reads width/height straight from a PNG's IHDR chunk (bytes 16-23).
function getPngDimensions(bytes) {
  try {
    if (bytes.length < 24) return null;
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (!width || !height) return null;
    return { width, height };
  } catch {
    return null;
  }
}

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  const store = getStore(STORE_NAME);

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const dataUrl = String(body?.image || "");

      if (!/^data:image\/png;base64,/i.test(dataUrl)) {
        return new Response("Only generated PNG images are accepted.", { status: 400 });
      }

      // Keep the request safely below common serverless body limits.
      if (dataUrl.length > 6_500_000) {
        return new Response("Generated image is too large.", { status: 413 });
      }

      const base64 = dataUrl.replace(/^data:image\/png;base64,/i, "");
      const bytes = Buffer.from(base64, "base64");

      if (bytes.length === 0 || bytes.length > 5_000_000) {
        return new Response("Generated image is too large.", { status: 413 });
      }

      const key = crypto.randomUUID();
      const dims = getPngDimensions(bytes) || { width: 1000, height: 1400 };

      await store.set(key, bytes, {
        metadata: {
          contentType: "image/png",
          caption: String(body?.caption || "").slice(0, 500),
          width: dims.width,
          height: dims.height,
          createdAt: new Date().toISOString()
        }
      });

      return Response.json({
        url: `${url.origin}/share/${key}`,
        id: key
      }, {
        headers: { "Cache-Control": "no-store" }
      });
    } catch (error) {
      console.error(error);
      return new Response("Could not prepare the share image.", { status: 500 });
    }
  }

  if (req.method !== "GET" || !id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Not found.", { status: 404 });
  }

  const entry = await store.getWithMetadata(id, { type: "arrayBuffer" });

  if (!entry) {
    return new Response("This share link has expired or does not exist.", { status: 404 });
  }

  const shareUrl = `${url.origin}/share/${encodeURIComponent(id)}`;
  const imageUrl = `${url.origin}/.netlify/functions/share?id=${encodeURIComponent(id)}&image=1`;
  const caption = htmlEscape(entry.metadata?.caption || "Hacker House Goa 2026 #FrameInGoa");

  if (url.searchParams.get("image") === "1") {
    return new Response(entry.data, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hacker House Goa 2026 Builder Card</title>
<meta name="description" content="${caption}">
<meta property="og:url" content="${htmlEscape(shareUrl)}">
<meta property="og:title" content="Hacker House Goa 2026 Builder Card">
<meta property="og:description" content="${caption}">
<meta property="og:type" content="website">
<meta property="og:image" content="${htmlEscape(imageUrl)}">
<meta property="og:image:secure_url" content="${htmlEscape(imageUrl)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${entry.metadata?.width || 1000}">
<meta property="og:image:height" content="${entry.metadata?.height || 1400}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Hacker House Goa 2026 Builder Card">
<meta name="twitter:description" content="${caption}">
<meta name="twitter:image" content="${htmlEscape(imageUrl)}">
<style>
body{margin:0;background:#0b1420;color:#f4e9d0;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}
main{text-align:center;padding:24px} img{max-width:min(900px,92vw);height:auto;border-radius:14px}
p{opacity:.8}
</style>
</head>
<body><main><img src="${htmlEscape(imageUrl)}" alt="Hacker House Goa 2026 Builder Card"><p>${caption}</p></main></body>
</html>`;

  return new Response(page, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
};
