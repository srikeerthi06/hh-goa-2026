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

function getShareId(url) {
  // 1. Normal query-string form:
  // /.netlify/functions/share?id=UUID
  const queryId = url.searchParams.get("id");
  if (queryId) return queryId.trim();

  // 2. Pretty public form:
  // /share/UUID
  const match = url.pathname.match(/^\/share\/([^/?#]+)\/?$/);

  if (match) {
    return decodeURIComponent(match[1]).trim();
  }

  return null;
}

export default async (req) => {
  const url = new URL(req.url);

  // ============================================================
  // CREATE SHARE
  // POST /.netlify/functions/share
  // ============================================================
  if (req.method === "POST") {
    try {
      const body = await req.json();

      if (!body.image || typeof body.image !== "string") {
        return new Response("Image is required.", {
          status: 400
        });
      }

      // Only accept PNG data URLs.
      const match = body.image.match(
        /^data:image\/png;base64,(.+)$/i
      );

      if (!match) {
        return new Response("Invalid PNG image.", {
          status: 400
        });
      }

      // Convert base64 PNG to bytes.
      const imageBytes = Uint8Array.from(
        atob(match[1]),
        (char) => char.charCodeAt(0)
      );

      const id = createId();

      // Store the generated card.
      await store.set(id, imageBytes, {
        metadata: {
          caption: String(body.caption || "").slice(0, 1000),
          createdAt: new Date().toISOString()
        }
      });

      // IMPORTANT:
      // Return the pretty public URL.
      return Response.json({
        id,
        url: `${url.origin}/share/${id}`
      });

    } catch (error) {
      console.error("Share creation error:", error);

      return new Response(
        "Could not create share link.",
        {
          status: 500,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        }
      );
    }
  }

  // ============================================================
  // READ SHARE
  // ============================================================

  const id = getShareId(url);

  if (!id) {
    return new Response("Not found.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  try {
    // Get image + metadata from Netlify Blobs.
    const result = await store.getWithMetadata(id, {
      type: "arrayBuffer"
    });

    if (!result || !result.data) {
      return new Response("Share card not found.", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    const imageData = result.data;

    const caption = escapeHtml(
      result.metadata?.caption ||
      "🌴 Built my Hacker House Goa 2026 Builder Card! 🌴\n\n#FrameInGoa #HHGoa2026"
    );

    // ============================================================
    // DIRECT IMAGE
    //
    // /share/UUID?image=1
    // ============================================================

    if (url.searchParams.get("image") === "1") {
      return new Response(imageData, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }

    // ============================================================
    // IMAGE URL
    //
    // This is what X/Twitter uses for the preview.
    // ============================================================

    const imageUrl =
      `${url.origin}/.netlify/functions/share` +
      `?id=${encodeURIComponent(id)}&image=1`;

    // Public share URL.
    const publicShareUrl =
      `${url.origin}/share/${encodeURIComponent(id)}`;

    // ============================================================
    // HTML SHARE PAGE
    // ============================================================

    const html = `<!DOCTYPE html>
<html lang="en">
<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>Hacker House Goa 2026 Builder Card</title>

<meta
  name="description"
  content="${caption.replace(/\n/g, " ")}"
>

<!-- =========================================================
     OPEN GRAPH
     ========================================================= -->

<meta
  property="og:title"
  content="Hacker House Goa 2026 Builder Card"
>

<meta
  property="og:description"
  content="${caption.replace(/\n/g, " ")}"
>

<meta
  property="og:type"
  content="website"
>

<meta
  property="og:url"
  content="${escapeHtml(publicShareUrl)}"
>

<meta
  property="og:image"
  content="${escapeHtml(imageUrl)}"
>

<meta
  property="og:image:type"
  content="image/png"
>

<meta
  property="og:image:alt"
  content="Hacker House Goa 2026 Builder Card"
>

<!-- =========================================================
     TWITTER / X
     ========================================================= -->

<meta
  name="twitter:card"
  content="summary_large_image"
>

<meta
  name="twitter:title"
  content="Hacker House Goa 2026 Builder Card"
>

<meta
  name="twitter:description"
  content="${caption.replace(/\n/g, " ")}"
>

<meta
  name="twitter:image"
  content="${escapeHtml(imageUrl)}"
>

<meta
  name="twitter:image:alt"
  content="Hacker House Goa 2026 Builder Card"
>

<style>

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;

  background:
    radial-gradient(
      ellipse 900px 500px at 15% -10%,
      rgba(255, 107, 69, 0.18),
      transparent 60%
    ),
    radial-gradient(
      ellipse 700px 500px at 110% 10%,
      rgba(35, 201, 192, 0.14),
      transparent 55%
    ),
    #071c19;

  color: #f4e9d0;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  display: flex;
  justify-content: center;
}

main {
  width: min(1000px, 94vw);

  padding:
    30px
    0
    60px;

  text-align: center;
}

.card {
  background: #101d30;

  border-radius: 18px;

  padding: 18px;

  box-shadow:
    0 20px 60px
    rgba(0, 0, 0, 0.35);
}

img {
  display: block;

  width: 100%;
  height: auto;

  border-radius: 12px;
}

h1 {
  margin:
    22px
    0
    10px;

  font-size: 22px;
}

.caption {
  white-space: pre-line;

  color: #c9c0aa;

  line-height: 1.6;

  font-size: 14px;

  margin:
    0
    auto;

  max-width: 700px;
}

.open {
  display: inline-block;

  margin-top: 22px;

  padding:
    12px
    20px;

  border-radius: 10px;

  background:
    linear-gradient(
      120deg,
      #d4ff3d,
      #23c9c0
    );

  color: #062018;

  font-weight: 700;

  text-decoration: none;
}

</style>

</head>

<body>

<main>

  <div class="card">

    <img
      src="${escapeHtml(imageUrl)}"
      alt="Hacker House Goa 2026 Builder Card"
    >

    <h1>
      Hacker House Goa 2026 Builder Card
    </h1>

    <p class="caption">${caption}</p>

    <a
      class="open"
      href="${escapeHtml(imageUrl)}"
      target="_blank"
      rel="noopener"
    >
      View Card Image
    </a>

  </div>

</main>

</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",

        // Let social crawlers fetch the page.
        "Cache-Control":
          "public, max-age=300"
      }
    });

  } catch (error) {

    console.error(
      "Share retrieval error:",
      error
    );

    return new Response(
      "Could not load share card.",
      {
        status: 500,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8"
        }
      }
    );
  }
};
