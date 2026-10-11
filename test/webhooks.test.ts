import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app';
import DecisionEvents from '../src/services/DecisionEvents';
import ProofOfAddress from '../src/services/ProofOfAddress';
import VerificationEvents from '../src/services/VerificationEvents';
import * as sharepoint from '../src/utils/sharepoint-utils';
import { fakeVeriff } from './helpers/fake-veriff';
import { KEY_PAIRS, hmac } from './helpers/fixtures';

vi.mock('../src/utils/sharepoint-utils');

const endpoints = [
  { path: '/webhooks/decision', handler: DecisionEvents },
  { path: '/webhooks/verification-event', handler: VerificationEvents },
  { path: '/webhooks/proof-of-address', handler: ProofOfAddress },
];

const payload = { status: 'success', verification: { id: 'session-1', code: 9001 } };
const body = JSON.stringify(payload);

const post = (path: string, { signature, contentType = 'application/json', data = body }: { signature?: string, contentType?: string, data?: string } = {}) => {
  const req = request(app).post(path).set('Content-Type', contentType);
  if (signature !== undefined) req.set('X-HMAC-SIGNATURE', signature);
  return req.send(data);
};

describe.each(endpoints)('POST $path', ({ path, handler }) => {
  const handleWebhook = vi.fn(async (_payload: unknown, res: any) => res.status(200).json({ message: 'success' }));

  beforeEach(() => {
    vi.spyOn(handler, 'new').mockResolvedValue({ handleWebhook });
  });

  const expectNoWork = () => {
    expect(handler.new).not.toHaveBeenCalled();
    expect(handleWebhook).not.toHaveBeenCalled();
    expect(fakeVeriff.requests).toEqual([]);
    for (const fn of Object.values(sharepoint)) {
      expect(fn).not.toHaveBeenCalled();
    }
  };

  it('returns 401 for a missing signature and does no work', async () => {
    const res = await post(path);

    expect(res.status).toBe(401);
    expectNoWork();
  });

  it('returns 401 for an invalid signature and does no work', async () => {
    const res = await post(path, { signature: hmac(body, 'not-a-configured-secret') });

    expect(res.status).toBe(401);
    expectNoWork();
  });

  it('returns 401 for a signature of a different length and does no work', async () => {
    const res = await post(path, { signature: hmac(body, KEY_PAIRS[0].sharedSecretKey).slice(0, 32) });

    expect(res.status).toBe(401);
    expectNoWork();
  });

  it('returns 401 for a non-JSON body, even when it is correctly signed, and does no work', async () => {
    const text = 'status=success&id=session-1';
    const res = await post(path, { signature: hmac(text, KEY_PAIRS[0].sharedSecretKey), contentType: 'text/plain', data: text });

    expect(res.status).toBe(401);
    expectNoWork();
  });

  it('accepts a request signed with the second configured key pair', async () => {
    const res = await post(path, { signature: hmac(body, KEY_PAIRS[1].sharedSecretKey) });

    expect(res.status).toBe(200);
    expect(handler.new).toHaveBeenCalledOnce();
    expect(handleWebhook).toHaveBeenCalledOnce();
    expect(handleWebhook).toHaveBeenCalledWith(payload, expect.anything());
  });
});
