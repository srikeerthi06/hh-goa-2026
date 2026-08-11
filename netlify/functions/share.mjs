import { getStore } from "@netlify/blobs";

const store = getStore("hh-goa-2026-shares");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function createId() {
  return crypto.randomUUID();
}

export default async (req) => {
  const url = new URL(req.url);

  // CREATE SHARE LINK
  if (req.method === "POST") {
    try {
      const body = await req.json();

      if (!body.image || typeof body.image !== "string") {
        return new Response("Image is required.", {
          status: 400
        });
      }

      const match = body.image.match(
        /^data:image\/png;base64,(.+)$/i
      );

      if (!match) {
        return new Response("Invalid PNG image.", {
          status: 400
        });
      }

      const imageBytes = Uint8Array.from(
        atob(match[1]),
        (char) => char.charCodeAt(0)
      );

      const id = createId();

      await store.set(id, imageBytes, {
        metadata: {
          caption: String(body.caption || "").slice(0, 1000),
          createdAt: new Date().toISOString()
        }
      });

      return Response.json({
        url: `${url.origin}/share/${id}`,
        id
      });

    } catch (error) {
      console.error("Share creation error:", error);

      return new Response(
        "Could not create share link.",
        { status: 500 }
      );
    }
  }

  // READ SHARE PAGE
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Not found.", {
      status: 404
    });
  }

  try {
    const result = await store.getWithMetadata(id, {
      type: "arrayBuffer"
    });

    if (!result || !result.data) {
      return new Response("Share card not found.", {
        status: 404
      });
    }

    const imageData = result.data;
    const caption = escapeHtml(
      result.metadata?.caption ||
      "Hacker House Goa 2026 #FrameInGoa"
    );

    // Direct image request
    if (url.searchParams.get("image") === "1") {
      return new Response(imageData, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000"
        }
      });
    }

    const imageUrl =
      `${url.origin}/.netlify/functions/share` +
      `?id=${encodeURIComponent(id)}&image=1`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1">

<title>Hacker House Goa 2026 Builder Card</title>

<meta name="description"
      content="${caption}">

<meta property="og:title"
      content="Hacker House Goa 2026 Builder Card">

<meta property="og:description"
      content="${caption}">

<meta property="og:type"
      content="website">

<meta property="og:image"
      content="${escapeHtml(imageUrl)}">

<meta name="twitter:card"
      content="summary_large_image">

<meta name="twitter:title"
      content="Hacker House Goa 2026 Builder Card">

<meta name="twitter:description"
      content="${caption}">

<meta name="twitter:image"
      content="${escapeHtml(imageUrl)}">

<style>

body {
  margin: 0;
  min-height: 100vh;
  background: #071c19;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: Arial, sans-serif;
}

main {
  width: min(1000px, 94vw);
  text-align: center;
  padding: 30px 0;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0,0,0,.35);
}

p {
  color: #f4e8ca;
  margin-top: 20px;
  line-height: 1.6;
}

</style>

</head>

<body>

<main>

<img
  src="${escapeHtml(imageUrl)}"
  alt="Hacker House Goa 2026 Builder Card">

<p>${caption}</p>

</main>

</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      }
    });

  } catch (error) {

    console.error("Share retrieval error:", error);

    return new Response(
      "Could not load share card.",
      { status: 500 }
    );
  }
};
