import { AzureHttpResponse, SafeRequest } from "../utils/types";
import { Renderer } from "./renderer";
import * as fs from "fs/promises";

export class HttpRenderer extends Renderer {
  mimetypes = ["text/html"];
  private request: SafeRequest;
  private contentType = "text/html; charset=utf-8";

  constructor(request: SafeRequest) {
    super();
    this.request = request;
  }

  async render(location: string): Promise<AzureHttpResponse> {
    if (!location) {
      return await this.render404();
    } else {
      return await this.render302(location);
    }
  }

  async render302(location: string): Promise<AzureHttpResponse> {
    return {
      status: 302,
      body: `<title>Redirecting...
            <p>Redirecting to <a href="${location}">${location}</a>...</p>`,
      isRaw: true,
      headers: {
        location: location,
        "content-type": this.contentType,
      },
    };
  }

  async render404(): Promise<AzureHttpResponse> {
    const packageJSON = JSON.parse(
      await fs.readFile("package.json", { encoding: "utf-8" })
    );

    /// <https://docs.github.com/en/issues/tracking-your-work-with-issues/creating-issues/about-automation-for-issues-and-pull-requests-with-query-parameters>
    const newIssueURL =
      packageJSON.bugs.url +
      "/new?labels=bug&title=" +
      encodeURIComponent("Cannot resolve ") +
      this.request.urlEscaped;

    return {
      status: 404,
      body: `<title>Not Found</title>
          <h1>Not found.</h1>
          <p><a href="${newIssueURL}">Submit an issue</a> if you think you need to notify us. Thanks!</p>`,
      isRaw: true,
      headers: {
        "content-type": this.contentType,
      },
    };
  }
}
