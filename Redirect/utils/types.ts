import { Cookie } from "@azure/functions";

/** Request parameters for underlying functions. */
export interface SafeRequest {
  urlPath: string;
  urlEscaped: string;
  acceptLanguage1: string;
  acceptMediaTypes: string[];
}

/** Recognized keys for Context.res */
export interface AzureHttpResponse {
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
