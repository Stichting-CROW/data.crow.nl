import { AzureHttpResponse, SafeRequest } from "../utils/types";

export abstract class Renderer {
  mimetypes: string[];
  /** Render the content for this target.
   *
   * @argument location The target location
   */
  async render(location: string): Promise<AzureHttpResponse> {
    throw Error(`render() not implemented`);
  }
}

import { HttpRenderer } from "./http";
import { LinkedDataRenderer } from "./linked-data";

type RendererArguments = {
  mimetype: string[];
  request: SafeRequest;
};

/** Returns the appropriate renderer for mimetype. */
export function renderer({ mimetype, request }: RendererArguments): Renderer {
  for (const r of [LinkedDataRenderer, HttpRenderer]) {
    for (const a of mimetype) {
      if (r.prototype.mimetypes.includes(a)) {
        return new r(request);
      }
    }
  }
}
