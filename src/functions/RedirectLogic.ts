import redirectsData from "../../data/redirects.json";

/** Corresponds with entries in data/redirects-schema.json */
interface RedirectCandidate {
  path: string;
  location: string;
  accept?: string[];
}

/** A segment of a pre-compiled location template:
 * literal text, a regex capture group ($1..$9), or the escaped request URI. */
type LocationSegment =
  | { kind: "literal"; value: string }
  | { kind: "group"; index: number }
  | { kind: "requestUriEscaped" };

/** RedirectCandidate with pre-compiled regexes and location template for performance */
interface CompiledRedirect extends RedirectCandidate {
  pathRegex: RegExp;
  acceptRegexes?: RegExp[];
  locationSegments: LocationSegment[];
}

/** Request parameters for underlying functions. */
export interface RedirectContext {
  urlPath: string;
  urlEscaped: string;
  acceptMediaTypes: string[];
}

/** Pre-compile a location template into segments, so no regexes are
 * constructed per request. Supports $1..$9 and $REQUEST_URI_ESCAPED. */
function compileLocation(location: string): LocationSegment[] {
  const segments: LocationSegment[] = [];
  const pattern = /\$(\d)|\$REQUEST_URI_ESCAPED/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(location)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        kind: "literal",
        value: location.slice(lastIndex, match.index),
      });
    }
    if (match[1] !== undefined) {
      segments.push({ kind: "group", index: Number(match[1]) });
    } else {
      segments.push({ kind: "requestUriEscaped" });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < location.length) {
    segments.push({ kind: "literal", value: location.slice(lastIndex) });
  }

  return segments;
}

/** Substitute redirection location variables using a pre-compiled template
 * and the match produced while filtering (no per-request RegExp construction). */
function interpolateLocation(
  redirect: CompiledRedirect,
  request: RedirectContext,
  matches: RegExpExecArray | null,
): string {
  let result = "";
  for (const segment of redirect.locationSegments) {
    switch (segment.kind) {
      case "literal":
        result += segment.value;
        break;
      case "group":
        result += matches?.[segment.index] ?? "";
        break;
      case "requestUriEscaped":
        result += request.urlEscaped;
        break;
    }
  }
  return result;
}

/** Compiled redirects are built once at module load: the JSON is bundled
 * into the deployment package, so there is no disk I/O or async loading. */
const compiledRedirects: CompiledRedirect[] = (
  redirectsData as { redirects: RedirectCandidate[] }
).redirects.map((redirect) => ({
  ...redirect,
  pathRegex: new RegExp(redirect.path),
  acceptRegexes: redirect.accept?.map((pattern) => new RegExp(pattern)),
  locationSegments: compileLocation(redirect.location),
}));

/** Gather matching targets together with their path matches. */
function preferredTargets(
  request: RedirectContext,
): { redirect: CompiledRedirect; matches: RegExpExecArray | null }[] {
  const path = request.urlPath;
  let targets = compiledRedirects
    .map((redirect) => ({
      redirect,
      matches: redirect.pathRegex.exec(path),
    }))
    .filter(({ redirect, matches }) => {
      // Check url.pathname with redirect.path using pre-compiled regex
      if (!matches) return false;

      // If there are no conditions
      if (!redirect.acceptRegexes) return true;

      // Only one filter needs to match one of the Accept headers using pre-compiled regexes
      return redirect.acceptRegexes.some((acceptRegex) => {
        return request.acceptMediaTypes.some((header) => {
          return acceptRegex.test(header);
        });
      });
    });

  // Prefer those with an Accept filter
  if (targets.some(({ redirect }) => !!redirect.acceptRegexes))
    targets = targets.filter(({ redirect }) => !!redirect.acceptRegexes);

  return targets;
}

/** Find redirection target */
export function redirectLocation(request: RedirectContext): string | undefined {
  const targets = preferredTargets(request);

  // This usually is the result of the last-resort redirect
  if (targets.length !== 1)
    console.info(
      `Found ${targets.length} matches for "${request.urlPath}": ${targets.map((t) => t.redirect.location)}`,
    );

  if (targets.length === 0) return undefined;

  const target = targets[0];
  return interpolateLocation(target.redirect, request, target.matches);
}
