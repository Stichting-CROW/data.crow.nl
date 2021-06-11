import * as fs from "fs/promises";
import { renderer } from "../renderer/renderer";

import { range } from "../utils/range";
import { AzureHttpResponse, SafeRequest } from "../utils/types";

/** Corresponds with entries in data/redirects-schema.json */
export interface RedirectCandidate {
  path: string;
  location: string;
  accept?: string[];
}

/** Substitute redirection location variables $1..$9 */
function substituteNumberedRegexGroupVariables(
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
 * @param location Redirect location string with substitutables
 * @param request Context information as SafeRequest
 */
function substituteNamedVariables(
  location: string,
  request: SafeRequest
): string {
  return location
    .replace("$ACCEPT_LANGUAGE", request.acceptLanguage1 ?? "nl")
    .replace("$REQUEST_URI_ESCAPED", request.urlEscaped);
}

/** Gather matching targets. */
async function preferredTargets(
  request: SafeRequest
): Promise<RedirectCandidate[]> {
  const dataJSON: { redirects: RedirectCandidate[] } = JSON.parse(
    await fs.readFile("data/redirects.json", { encoding: "utf-8" })
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
export async function redirectLocation(
  request: SafeRequest
): Promise<AzureHttpResponse> {
  const targets = await preferredTargets(request);

  if (targets.length !== 1) {
    console.warn(`Found ${targets.length} matches for "${request.urlPath}".`);
  }

  let location = targets[0]?.location;
  location = substituteNumberedRegexGroupVariables(
    location,
    request,
    targets[0].path
  );
  location = substituteNamedVariables(location, request);

  const r = renderer({ mimetype: request.acceptMediaTypes, request: request });
  return await r.render(location);
  const result: AzureHttpResponse = {
    status: 302,
    body: `<title>Redirecting…</title>
             <p>Redirecting to <a href="${location}">${location}</a>...</p>`,
    isRaw: true,
    headers: {
      location: location,
      "content-type": "text/html; charset=utf-8",
    },
  };

  return result;
}
