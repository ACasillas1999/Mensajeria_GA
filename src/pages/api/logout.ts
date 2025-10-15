import type { APIRoute } from "astro";

export const POST: APIRoute = async () => {
  const headers = new Headers({
    "Content-Type": "application/json",
    // Clear cookie
    "Set-Cookie": [
      "auth=",
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      "Max-Age=0",
    ].join("; "),
  });
  return new Response(JSON.stringify({ ok: true }), { headers });
};

