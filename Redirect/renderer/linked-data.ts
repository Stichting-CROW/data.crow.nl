import { AzureHttpResponse } from "../utils/types";
import { Renderer } from "./renderer";

export class LinkedDataRenderer extends Renderer {
  mimetypes = [
    "application/ld+json",
    "application/n-quads",
    "application/n-triples",
    "application/rdf+xml",
    "application/trig",
    "text/turtle",
  ];

  async render(location: string): Promise<AzureHttpResponse> {
    if (!location) {
      return await this.render404();
    } else {
      return await this.render302(location);
    }
  }

  async render302(location: string): Promise<AzureHttpResponse> {
    return null
  }

  async render404(): Promise<AzureHttpResponse> {
    return {
        status: 404,
    }
  }
}
