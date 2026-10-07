// A stand-in for utils/api that answers from the stateful fake of the people endpoints. A test sets `apiMock.server`
// before rendering and reads `apiMock.calls` to see what the screen sent.
import type { PeopleServer } from './peopleServer';

type Payload = Record<string, unknown> | undefined;

export const apiMock: { server: PeopleServer | null; calls: Array<{ method: string; url: string; payload?: unknown }> } = {
  server: null,
  calls: [],
};

async function send(method: string, url: string, payload?: Payload) {
  apiMock.calls.push({ method, url, payload });
  return apiMock.server!.handle(method, url, payload);
}

/** The module shape of utils/api, for `vi.mock('.../utils/api', async () => (await import('.../apiMock')).apiModule)`. */
export const apiModule = {
  apiClient: {
    get: async (url: string, params?: Payload) => (await send('GET', url, params)).body,
    post: async (url: string, body?: Payload) => (await send('POST', url, body)).body,
    put: async (url: string, body?: Payload) => (await send('PUT', url, body)).body,
    patch: async (url: string, body?: Payload) => (await send('PATCH', url, body)).body,
    delete: async (url: string) => {
      const response = await send('DELETE', url);
      return response.body ?? { success: true };
    },
  },
  axiosInstance: {
    delete: async (url: string) => {
      const response = await send('DELETE', url);
      return { status: response.status, data: response.body };
    },
  },
};
