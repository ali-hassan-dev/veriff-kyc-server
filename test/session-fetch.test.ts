import { describe, expect, it, vi } from 'vitest';
import VeriffAPI from '../src/services/VeriffAPI';
import { getRelavantSessionData } from '../src/utils/veriff-utils';
import { fakeVeriff } from './helpers/fake-veriff';
import { BASE_URL, KEY_PAIRS, VERSION } from './helpers/fixtures';
import { SESSION_ID, sessionCalls, sessionResponses, sessionUrls, sessionValues } from './helpers/session';

/**
 * Serve the seven session calls, but hold every response back until release() is called.
 * @returns {() => void} - Function that lets the held responses through.
 */
const serveSessionOnHold = () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const responses = sessionResponses();
  for (const call of sessionCalls) {
    fakeVeriff.route(sessionUrls[call], async () => {
      await held;
      return { data: responses[call] };
    });
  }
  return release;
};

const fetchSession = () => getRelavantSessionData(new VeriffAPI(KEY_PAIRS, BASE_URL), SESSION_ID, VERSION);

describe('getRelavantSessionData', () => {
  it('makes the seven Veriff calls in parallel', async () => {
    const release = serveSessionOnHold();
    const result = fetchSession();

    // All seven requests reach Veriff before any of them has been answered
    await vi.waitFor(() => expect(fakeVeriff.requests).toHaveLength(7));
    expect(fakeVeriff.requests.map(({ url }) => url).sort()).toEqual(Object.values(sessionUrls).sort());

    release();
    const values = sessionValues();
    await expect(result).resolves.toEqual(Object.fromEntries(sessionCalls.map((call) => [call, { status: 'fulfilled', value: values[call] }])));
  });

  it.each(sessionCalls)("doesn't let a failing %s call stop the others", async (failingCall) => {
    const release = serveSessionOnHold();
    fakeVeriff.route(sessionUrls[failingCall], { status: 500, data: { status: 'fail', message: 'Internal server error' } });
    const result = fetchSession();

    // The failing call has used up every key pair while the other six are still waiting
    await vi.waitFor(() => expect(fakeVeriff.requests.filter(({ url }) => url === sessionUrls[failingCall])).toHaveLength(KEY_PAIRS.length));
    expect(fakeVeriff.requests).toHaveLength(6 + KEY_PAIRS.length);

    release();
    const data = await result;
    const values = sessionValues();
    for (const call of sessionCalls) {
      if (call === failingCall) {
        expect(data[call].value).toBeNull();
      } else {
        expect(data[call]).toEqual({ status: 'fulfilled', value: values[call] });
      }
    }
  });
});
