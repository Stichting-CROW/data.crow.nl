import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { mediaTypes, languages } from "@hapi/accept";
const fs = require("fs");

/** Generates a range from (start-end] */
function* range(start: number, end: number): Generator<number> {
  yield start;
  if (start === end) return;
  yield* range(start + 1, end);
}

/** Corresponds with entries in data/redirects-schema.json */
export interface RedirectCandidate {
  path: string;
  location: string;
  accept?: string[];
}

/** Request parameters for underlying functions. */
export interface SafeRequest {
  urlPath: string;
  urlEscaped: string;
  acceptLanguage1: string;
  acceptMediaTypes: string[];
  isInDebugMode: boolean;
}

interface AzureHttpResponse {
  status?: number;
  body?: string;
  isRaw?: boolean;
  headers?: {
    location?: string;
    "content-type"?: string;
  };
}

const defaultResponse: AzureHttpResponse = {
  status: 404,
  body: `<p>Not found.</p>`,
  isRaw: true,
};

/** Substitute redirection location variables $1..$9 */
export function substituteNumberedVariables(
  location: string,
  request: SafeRequest,
  targetPath: string
): string {
  let result = location;

  const matches = request.urlPath.match(targetPath);
  for (const i of range(1, matches.length - 1)) {
    result = result.replace(/\$\d/, matches[i]);
  }

  return result;
}

/** Substitute a limited list of variables:
 *
 * - $ACCEPT_LANGUAGE     First preferred value of request header Accept-Language
 * - $REQUEST_URI_ESCAPED URL-encoded request URL
 */
export function substituteNamedVariables(
  location: string,
  request: SafeRequest
): string {
  return location
    .replace("$ACCEPT_LANGUAGE", request.acceptLanguage1 ?? "nl")
    .replace("$REQUEST_URI_ESCAPED", request.urlEscaped);
}

/** Readable report for end users. */
export function reportError(
  targetCount: number,
  request: SafeRequest
): AzureHttpResponse {
  let status: number;
  let body: string;
  let issueType: string;

  if (targetCount === 0) {
    status = 404;
    body = `<p>Not found.</p>`;
    issueType = "Cannot resolve ";
  }

  const packageJSON = JSON.parse(fs.readFileSync("package.json"));

  const newIssueURL =
    packageJSON.bugs.url +
    "/new?labels=bug&title=" +
    encodeURIComponent(issueType) +
    request.urlEscaped;

  throw {
    status: status,
    body: `${body}<p><a href="${newIssueURL}">Submit an issue</a> if you think you need to notify us. Thanks!</p>`,
    isRaw: true,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  };
}

/** Gather matching targets. */
export function preferredTargets(request: SafeRequest): RedirectCandidate[] {
  const dataJSON: { redirects: RedirectCandidate[] } = JSON.parse(
    fs.readFileSync("data/redirects.json")
  );

  const path = request.urlPath;
  let targets = dataJSON.redirects.filter((redirect) => {
    // Check url.pathname with redirect.path
    const pathMatches = new RegExp(redirect.path).test(path);
    if (!pathMatches) {
      return false;
    }

    // If there are no conditions
    if (!redirect.accept) {
      return true;
    }

    // Only one filter needs to match one of the Accept headers
    return redirect.accept.some((condition) => {
      return request.acceptMediaTypes.some((header) => {
        return new RegExp(condition).test(header);
      });
    });
  });

  // Prefer those with an Accept filter
  if (
    targets.some((redirect) => {
      return !!redirect.accept;
    })
  ) {
    targets = targets.filter((redirect) => {
      return !!redirect.accept;
    });
  }
  return targets;
}

/** Find redirection target */
export function redirectLocation(request: SafeRequest): AzureHttpResponse {
  const targets = preferredTargets(request);

  if (targets.length !== 1) {
    console.warn(`Found ${targets.length} matches for "${request.urlPath}".`);
  }

  if (targets.length === 0) {
    return reportError(targets.length, request);
  }

  let location = targets[0].location;
  location = substituteNumberedVariables(location, request, targets[0].path);
  location = substituteNamedVariables(location, request);

  const result: AzureHttpResponse = {
    status: 302,
    body: `<p>Redirecting to <a href="${location}">${location}</a>...</p>`,
    isRaw: true,
    headers: {
      location: location,
      "content-type": "text/html; charset=utf-8",
    },
  };

  return result;
}

/** The Azure Function responder. */
const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  let response: AzureHttpResponse = {};

  try {
    const lang = languages(req.headers["accept-language"])[0]?.split("-")[0];

    const request: SafeRequest = {
      urlPath: new URL(req.url).pathname,
      urlEscaped: encodeURIComponent(req.url),
      acceptLanguage1: lang,
      acceptMediaTypes: mediaTypes(req.headers["accept"]),
      isInDebugMode: !!req.query["debug"],
    };

    response = redirectLocation(request);

    if (request.isInDebugMode) {
      delete response.headers.location;
    }
  } catch (e) {
    response = e;
  }

  context.res = {
    ...defaultResponse,
    ...response,
  };
};

export default httpTrigger;
