import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { mediaTypes } from "@hapi/accept";
import { redirectLocation, type RedirectContext } from "./RedirectLogic";

export const DEFAULT_TARGET = "https://example.org";

function escape(s) {
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
): Promise<HttpResponseInit> {
  let headers = { Location: DEFAULT_TARGET };

  const restOfPath = request.params?.restOfPath;
  const urlPath = restOfPath ? `/${restOfPath.replace(/^\/+/, "")}` : "/";
  const acceptHeader = request.headers.get("Accept") ?? "*/*";
  const acceptMediaTypes = mediaTypes(acceptHeader);

  const data: RedirectContext = {
    urlPath,
    urlEscaped: encodeURIComponent("https://data.crow.nl" + urlPath),
    acceptMediaTypes,
  };

  const target = (headers.Location =
    (await redirectLocation(data)) ?? DEFAULT_TARGET);

  return {
    status: 307,
    body: `<title>Redirecting…</title>
<p>Redirecting to <a href="${escape(target)}">${escape(target)}</a>...</p>`,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...headers,
    },
  };
}

app.http("redirect", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: redirect,
  route: "{*restOfPath}",
});
