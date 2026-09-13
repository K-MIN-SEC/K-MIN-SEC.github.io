import { defineMiddleware } from "astro:middleware";
export const onRequest = defineMiddleware(async (_ctx, next) => {
  const response = await next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
});
