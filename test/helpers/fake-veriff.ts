import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { BASE_URL } from './fixtures';

export interface VeriffRequest {
  method: string;
  url: string; // Path and query, relative to BASE_URL.
  apiKey: string; // X-AUTH-CLIENT header.
  signature: string; // X-HMAC-SIGNATURE header.
}

export interface VeriffReply {
  status?: number; // Defaults to 200.
  data?: unknown;
  headers?: Record<string, string>;
}

export type VeriffRoute = VeriffReply | ((request: VeriffRequest) => VeriffReply | Promise<VeriffReply>);

/**
 * In-memory stand-in for the Veriff API. test/setup.ts installs its adapter as the
 * default axios adapter, so every axios request lands here instead of the network.
 * Anything that is not a Veriff call (SharePoint, for example) is rejected.
 */
class FakeVeriff {
  public requests: VeriffRequest[] = [];
  private routes = new Map<string, VeriffRoute>();

  public reset() {
    this.requests = [];
    this.routes.clear();
  }

  /**
   * Answer requests to a URL. Unknown URLs get a 404.
   * @param {string} url - Path and query, relative to BASE_URL.
   * @param {VeriffRoute} route - A fixed reply, or a function of the request.
   */
  public route(url: string, route: VeriffRoute) {
    this.routes.set(url, route);
  }

  public adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const method = (config.method || 'get').toUpperCase();
    if (config.baseURL !== BASE_URL) {
      throw new Error(`Unexpected request outside the fake Veriff API: ${method} ${config.url}`);
    }

    const headers = AxiosHeaders.from(config.headers);
    const request: VeriffRequest = {
      method,
      url: config.url || '',
      apiKey: String(headers.get('x-auth-client')),
      signature: String(headers.get('x-hmac-signature')),
    };
    this.requests.push(request);

    const route = this.routes.get(request.url) || { status: 404, data: { status: 'fail', message: 'Not found' } };
    const reply = typeof route === 'function' ? await route(request) : route;
    const response: AxiosResponse = {
      status: reply.status || 200,
      statusText: '',
      data: reply.data,
      headers: reply.headers || { 'content-type': 'application/json' },
      config,
    };

    // Same outcome as axios' own adapters: anything outside 2xx is rejected
    if (response.status >= 300) {
      const code = response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST;
      throw new AxiosError(`Request failed with status code ${response.status}`, code, config, null, response);
    }
    return response;
  };
}

export const fakeVeriff = new FakeVeriff();
