import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { languages, mediaTypes } from "@hapi/accept";
import { redirectLocation } from "./redirection/redirect";
import { AzureHttpResponse, SafeRequest } from "./utils/types";

/** The Azure Function responder. */
const run: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  let response: AzureHttpResponse = {};

  const lang = languages(req.headers["accept-language"])[0]?.split("-")[0];
  const acpt = mediaTypes(req.headers["accept"]);
  const request: SafeRequest = {
    urlPath: new URL(req.url).pathname,
    urlEscaped: encodeURIComponent(req.url),
    acceptLanguage1: lang,
    acceptMediaTypes: acpt,
  };

  console.info(JSON.stringify(acpt));

  response = await redirectLocation(request);

  if (!!req.query["debug"]) {
    delete response.headers.location;
  }

  context.res = response;
};

export default run;
