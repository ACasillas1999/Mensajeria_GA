import type { APIRoute } from "astro";

export const POST: APIRoute = async () => {
  const base = import.meta.env.BASE_URL || "/";
  const headers = new Headers({
    "Content-Type": "application/json",
    // Clear cookie
    "Set-Cookie": [
      "auth=",
      "HttpOnly",
      `Path=${base}`,
      "SameSite=Lax",
      "Max-Age=0",
    ].join("; "),
  });
  return new Response(JSON.stringify({ ok: true }), { headers });
};

