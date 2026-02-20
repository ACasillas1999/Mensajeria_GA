import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url }) => {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    ["auth=", "HttpOnly", "Path=/", "SameSite=None", "Secure", "Max-Age=0"].join("; ")
  );

  const base = import.meta.env.BASE_URL || "/";
  const target = `${base}/login`.replace(/\/\//g, "/");

  headers.append("Location", new URL(target, url).toString());

  return new Response(null, {
    status: 302,
    headers,
  });
};

