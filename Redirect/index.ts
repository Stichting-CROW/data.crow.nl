import { AzureFunction, Context, Cookie, HttpRequest } from "@azure/functions";
import { languages, mediaTypes } from "@hapi/accept";
import * as fs from "fs/promises";

/** Generates a range from (start-end] */
function* range(start: number, end: number): Generator<number> {
  yield start;
  if (start === end) return;
  yield* range(start + 1, end);
}

/** Corresponds with entries in data/redirects-schema.json */
interface RedirectCandidate {
  path: string;
  location: string;
  accept?: string[];
}

/** Request parameters for underlying functions. */
interface SafeRequest {
  urlPath: string;
  urlEscaped: string;
  acceptLanguage1: string;
  acceptMediaTypes: string[];
  webhookTarget?: string;
  body?: any;
}

/** Recognized keys for Context.res */
interface AzureHttpResponse {
  /** HTTP status code */
  status?: number;
  /** The body of the response */
  body?: Object;
  /** Indicates that formatting is skipped */
  isRaw?: boolean;
  /** Response headers */
  headers?: {
    location?: string;
    "content-type"?: string;
  };
  /** Cookie objects that are set in the response */
  cookies?: Cookie[];
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

async function teamsWebhook(request: SafeRequest): Promise<AzureHttpResponse> {
  const payload = {
    path: request.urlPath,
    webhookTarget: request.webhookTarget,
    body: request.body,
  };
  const [account, dataset] = ["a", "b"];
  const template = `{
    "type":"message",
    "attachments":[
       {
          "contentType":"application/vnd.microsoft.card.adaptive",
          "contentUrl":null,
          "content":{
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.2",
            "speak": "Dataset ${account}/${dataset} was updated",
            "body": [
              {
                "type": "TextBlock",
                "text": "Dataset \`${account}/${dataset}\` was updated",
                "size": "large",
                "weight": "bolder",
                "wrap": true,
                "style": "heading"
              },
              {
                "type": "TextBlock",
                "text": "\`\`\`json\n${JSON.stringify(
                  payload,
                  undefined,
                  2
                )}\n\`\`\`"
              }
            ]
          }
       }
    ]
 }`;

  await fetch(payload.webhookTarget, {
    body: template,
    headers: { "Content-Type": "application/json" },
  });

  return {
    status: 200,
    isRaw: true,
  };
}

/** Readable report for end users. */
async function zeroResults(request: SafeRequest): Promise<AzureHttpResponse> {
  const packageJSON = JSON.parse(
    await fs.readFile("package.json", { encoding: "utf-8" })
  );

  const newIssueURL =
    packageJSON.bugs.url +
    "/new?labels=bug&title=" +
    encodeURIComponent("Cannot resolve ") +
    request.urlEscaped;

  return {
    status: 404,
    body: `<head>
        <link rel="stylesheet" href="https://docs.crow.nl/respec-design/base.css" />
        <link rel="stylesheet" href="https://docs.crow.nl/respec-design/crow-base.css" />
        <link
          rel="stylesheet"
          media="(prefers-color-scheme: dark)"
          href="https://docs.crow.nl/respec-design/crow-dark.css"
        />
        <link
          rel="shortcut icon"
          href="https://docs.crow.nl/respec-design/logos/crow.ico"
          type="image/x-icon"
        />
      </head>
      <body>
        <title>Redirection not possible</title>
        <p>404: Path not found.</p>
        <p>
          <a href="${newIssueURL}">Submit an issue</a> if you think you need to
          notify us. Thanks!
        </p>
      </body>`,
    isRaw: true,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  };
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
async function redirectLocation(
  request: SafeRequest
): Promise<AzureHttpResponse> {
  const targets = await preferredTargets(request);

  if (targets.length !== 1) {
    console.warn(`Found ${targets.length} matches for "${request.urlPath}".`);
  }

  if (targets.length === 0) {
    return await zeroResults(request);
  }

  let location = targets[0].location;
  location = substituteNumberedRegexGroupVariables(
    location,
    request,
    targets[0].path
  );
  location = substituteNamedVariables(location, request);

  const result: AzureHttpResponse = {
    status: 307,
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

/** The Azure Function responder. */
const run: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  let response: AzureHttpResponse = {};

  const lang = languages(req.headers["accept-language"])[0]?.split("-")[0];
  const acpt = mediaTypes(req.headers["accept"]);
  const pathname = new URL(req.url).pathname;
  const request: SafeRequest = {
    urlPath: pathname,
    urlEscaped: encodeURIComponent("https://data.crow.nl" + pathname),
    acceptLanguage1: lang,
    acceptMediaTypes: acpt,
    webhookTarget: req.query["webhooktarget"],
    body: req.body,
  };

  console.info(JSON.stringify(acpt));

  if (!!req.query["webhooktarget"]) {
    response = await teamsWebhook(request);
  } else {
    response = await redirectLocation(request);
  }
  if (!!req.query["debug"]) {
    delete response.headers.location;
  }

  context.res = {
    status: 404,
    body: `<title>Not Found</title>
           <style>body { font-family: MuseoSans, Museo, "Museo Sans", sans-serif; } </style>
           <p>Not found.</p>`,
    isRaw: true,
    ...response,
  };
};

export default run;
