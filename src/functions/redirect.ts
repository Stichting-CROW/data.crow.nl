import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from "@azure/functions";
import { mediaTypes } from "@hapi/accept";
import { redirectLocation, type RedirectContext } from "./RedirectLogic";

export const DEFAULT_TARGET = "https://example.org";

/** How long clients and shared caches may store a redirect response.
 * The response is a pure function of (path, Accept) and only changes on deploy. */
const REDIRECT_MAX_AGE_SECONDS = 3600;

/** Bounded memoization of parsed Accept headers (low cardinality in practice). */
const ACCEPT_CACHE_MAX_ENTRIES = 500;
const acceptMediaTypesCache = new Map<string, string[]>();

function parseAcceptMediaTypes(acceptHeader: string): string[] {
  const cached = acceptMediaTypesCache.get(acceptHeader);
  if (cached) return cached;

  const parsed = mediaTypes(acceptHeader);
  if (acceptMediaTypesCache.size >= ACCEPT_CACHE_MAX_ENTRIES) {
    // Evict the oldest entry (Map preserves insertion order)
    const oldest = acceptMediaTypesCache.keys().next().value;
    acceptMediaTypesCache.delete(oldest);
  }
  acceptMediaTypesCache.set(acceptHeader, parsed);
  return parsed;
}

function htmlEscape(s) {
  let lookup = {
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
    "<": "&lt;",
    ">": "&gt;",
  };
  return s.replace(/[&"'<>]/g, (c) => lookup[c]);
}

export async function redirect(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    let redirectTarget = DEFAULT_TARGET;

    const restOfPath = request.params?.restOfPath;
    const urlPath = restOfPath ? `/${restOfPath.replace(/^\/+/, "")}` : "/";
    const acceptHeader = request.headers.get("Accept") ?? "*/*";
    const acceptMediaTypes = parseAcceptMediaTypes(acceptHeader);

    const info: RedirectContext = {
      urlPath,
      urlEscaped: encodeURIComponent("https://data.crow.nl" + urlPath),
      acceptMediaTypes,
    };

    redirectTarget = redirectLocation(info) ?? DEFAULT_TARGET;

    context.info(
      `${urlPath} (Accept: ${acceptMediaTypes.join(" ; ")}): ${redirectTarget}`,
    );

    return {
      status: 307,
      body: `<title>Redirecting…</title>
<p>307 Temporary Redirect <a href="${htmlEscape(redirectTarget)}"><code>${htmlEscape(redirectTarget)}</code></a></p>`,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        Location: redirectTarget,
        // Let browsers/CDNs cache the redirect; Vary is required because the
        // target depends on the Accept header.
        "Cache-Control": `public, max-age=${REDIRECT_MAX_AGE_SECONDS}`,
        Vary: "Accept",
      },
    };
  } catch (error) {
    console.error(error);
    return {
      status: 500,
      body: `<h1>Internal Server Error</h1>`,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    };
  }
}

app.http("redirect", {
  methods: ["GET", "HEAD"],
  authLevel: "anonymous",
  handler: redirect,
  route: "{*restOfPath}",
});
