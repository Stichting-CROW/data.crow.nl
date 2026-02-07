import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { mediaTypes } from "@hapi/accept";
import { redirectLocation, type RedirectContext } from "./RedirectLogic";

export const DEFAULT_TARGET = "https://datasets.crow.nl";

export async function redirect(
  request: HttpRequest,
): Promise<HttpResponseInit> {
  let headers = { Location: DEFAULT_TARGET };

  const urlPath = "/" + request.params.restOfPath;
  const acceptMediaTypes = mediaTypes(request.headers.get("Accept"));

  const data: RedirectContext = {
    urlPath,
    urlEscaped: encodeURIComponent(`https://data.crow.nl/${urlPath}`),
    acceptMediaTypes,
  };

  const target = (headers.Location =
    (await redirectLocation(data)) ?? DEFAULT_TARGET);

  return {
    status: 307,
    body: `<title>Redirecting…</title>
<p>Redirecting to <a href="${target}">${target}</a>...</p>`,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...headers,
      "Crow-Was-Default-Target": `${target == DEFAULT_TARGET}`,
    },
  };
}

app.http("redirect", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: redirect,
  route: "{*restOfPath}",
});
