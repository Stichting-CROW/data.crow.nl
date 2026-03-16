import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from "@azure/functions";
import { mediaTypes } from "@hapi/accept";
import { redirectLocation, type RedirectContext } from "./RedirectLogic";

export const DEFAULT_TARGET = "https://example.org";

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
    const acceptMediaTypes = mediaTypes(acceptHeader);

    const info: RedirectContext = {
      urlPath,
      urlEscaped: encodeURIComponent("https://data.crow.nl" + urlPath),
      acceptMediaTypes,
    };

    redirectTarget = (await redirectLocation(info)) ?? DEFAULT_TARGET;

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
      },
    };
  } catch (error) {
    console.error(error);
    return {
      status: 500,
      body: `<h1>Internal Server Error</h1><p>${error?.message}</p>`,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    };
  }
}

app.http("redirect", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: redirect,
  route: "{*restOfPath}",
});
