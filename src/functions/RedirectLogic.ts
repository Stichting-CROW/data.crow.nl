import * as fs from "fs/promises";

/** Generates a range from (start-end] */
function* range(start: number, end: number): Generator<number> {
  yield start;
  if (start >= end) return;
  yield* range(start + 1, end);
}

/** Corresponds with entries in data/redirects-schema.json */
interface RedirectCandidate {
  path: string;
  location: string;
  accept?: string[];
}

/** Request parameters for underlying functions. */
export interface RedirectContext {
  urlPath: string;
  urlEscaped: string;
  acceptMediaTypes: string[];
}

/** Substitute redirection location variables
 *
 * - $1..$9
 * - $REQUEST_URI_ESCAPED URL-encoded request URL
 * */
function interpolatePathVariables(
  location: string,
  request: RedirectContext,
  targetPath: string,
): string {
  let result = location;

  const matches = request.urlPath.match(targetPath);
  for (const i of range(1, matches.length - 1))
    result = result.replace(/\$\d/, matches[i]);

  result = result.replace("$REQUEST_URI_ESCAPED", request.urlEscaped);

  return result;
}

/** Gather matching targets. */
async function preferredTargets(
  request: RedirectContext,
): Promise<RedirectCandidate[]> {
  const dataJSON: { redirects: RedirectCandidate[] } = JSON.parse(
    await fs.readFile("data/redirects.json", { encoding: "utf-8" }),
  );

  const path = request.urlPath;
  let targets = dataJSON.redirects.filter((redirect) => {
    // Check url.pathname with redirect.path
    const pathMatches = new RegExp(redirect.path).test(path);
    if (!pathMatches) return false;

    // If there are no conditions
    if (!redirect.accept) return true;

    // Only one filter needs to match one of the Accept headers
    return redirect.accept.some((condition) => {
      return request.acceptMediaTypes.some((header) => {
        return new RegExp(condition).test(header);
      });
    });
  });

  // Prefer those with an Accept filter
  if (targets.some((redirect) => !!redirect.accept))
    targets = targets.filter((redirect) => !!redirect.accept);

  return targets;
}

/** Find redirection target */
export async function redirectLocation(
  request: RedirectContext,
): Promise<string> {
  if (request.urlPath == "/undefined") return undefined;
  const targets = await preferredTargets(request);

  // This usually is the result of the last-resort redirect
  if (targets.length !== 1)
    console.info(
      `Found ${targets.length} matches for "${request.urlPath}": ${targets.map((t) => t.location)}`,
    );

  if (targets.length === 0) return undefined;

  const target = targets[0];
  return interpolatePathVariables(target.location, request, target.path);
}
