import { describe, expect, it } from 'vitest';
import VeriffAPI from '../src/services/VeriffAPI';
import { VeriffRequest, fakeVeriff } from './helpers/fake-veriff';
import { BASE_URL, KEY_PAIRS, hmac } from './helpers/fixtures';
import { SESSION_ID, sessionUrls, sessionValues } from './helpers/session';

const decision = sessionValues().sessionDecision;
const unauthorized = { status: 401, data: { status: 'fail', message: 'Unauthorized' } };

/** A Veriff endpoint that rejects the given API key and answers every other key. */
const rejectKey = (apiKey: string) => (request: VeriffRequest) => (request.apiKey === apiKey ? unauthorized : { data: decision });

const signedWith = ({ apiKey, sharedSecretKey }: { apiKey: string, sharedSecretKey: string }) =>
  expect.objectContaining({ apiKey, signature: hmac(SESSION_ID, sharedSecretKey) });

describe('VeriffAPI key failover', () => {
  it('tries the next key pair when a Veriff API key fails', async () => {
    fakeVeriff.route(sessionUrls.sessionDecision, rejectKey(KEY_PAIRS[0].apiKey));
    const veriffAPI = new VeriffAPI(KEY_PAIRS, BASE_URL);

    await expect(veriffAPI.getSessionDecision(SESSION_ID)).resolves.toEqual(decision);
    // The retry carries the second key and is signed with the second key's secret
    expect(fakeVeriff.requests).toEqual([signedWith(KEY_PAIRS[0]), signedWith(KEY_PAIRS[1])]);
  });

  it('keeps using the key pair that worked for later requests', async () => {
    fakeVeriff.route(sessionUrls.sessionDecision, rejectKey(KEY_PAIRS[0].apiKey));
    const veriffAPI = new VeriffAPI(KEY_PAIRS, BASE_URL);

    await veriffAPI.getSessionDecision(SESSION_ID);
    await veriffAPI.getSessionDecision(SESSION_ID);

    expect(fakeVeriff.requests.map(({ apiKey }) => apiKey)).toEqual([KEY_PAIRS[0].apiKey, KEY_PAIRS[1].apiKey, KEY_PAIRS[1].apiKey]);
  });

  it('tries each key pair once, then gives up with null', async () => {
    fakeVeriff.route(sessionUrls.sessionDecision, unauthorized);
    const veriffAPI = new VeriffAPI(KEY_PAIRS, BASE_URL);

    await expect(veriffAPI.getSessionDecision(SESSION_ID)).resolves.toBeNull();
    expect(fakeVeriff.requests).toEqual(KEY_PAIRS.map(signedWith));
  });
});
