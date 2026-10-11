import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import VeriffAPI from '../src/services/VeriffAPI';
import { BASE_URL, KEY_PAIRS, hmac } from './helpers/fixtures';

const veriffAPI = new VeriffAPI(KEY_PAIRS, BASE_URL);
const payload = { status: 'success', verification: { id: 'session-1', code: 9001 } };
const body = JSON.stringify(payload);
const validSignature = hmac(body, KEY_PAIRS[0].sharedSecretKey);

describe('VeriffAPI.isSignatureValid', () => {
  it.each(KEY_PAIRS.map(({ sharedSecretKey }, index) => [index + 1, sharedSecretKey]))('accepts a signature made with key pair %i', (_, sharedSecretKey) => {
    expect(veriffAPI.isSignatureValid({ signature: hmac(body, sharedSecretKey), payload })).toBe(true);
  });

  it('rejects a signature made with a secret that is not configured', () => {
    expect(veriffAPI.isSignatureValid({ signature: hmac(body, 'not-a-configured-secret'), payload })).toBe(false);
  });

  it('rejects a valid signature sent with a different payload', () => {
    expect(veriffAPI.isSignatureValid({ signature: validSignature, payload: { ...payload, status: 'tampered' } })).toBe(false);
  });

  it('compares equal-length signatures with crypto.timingSafeEqual', () => {
    const timingSafeEqual = vi.spyOn(crypto, 'timingSafeEqual');

    expect(veriffAPI.isSignatureValid({ signature: hmac(body, 'not-a-configured-secret'), payload })).toBe(false);
    expect(timingSafeEqual).toHaveBeenCalledTimes(KEY_PAIRS.length);
  });

  it.each([
    ['empty', ''],
    ['one character short', validSignature.slice(0, -1)],
    ['one character long', `${validSignature}0`],
    ['twice as long', validSignature.repeat(2)],
    ['64 characters but 65 bytes', `é${validSignature.slice(1)}`],
  ])('rejects a signature that is %s without throwing', (_, signature) => {
    // timingSafeEqual throws on buffers of different lengths, so they must never reach it
    const timingSafeEqual = vi.spyOn(crypto, 'timingSafeEqual');
    let isValid: boolean | undefined;

    expect(() => {
      isValid = veriffAPI.isSignatureValid({ signature, payload });
    }).not.toThrow();
    expect(isValid).toBe(false);
    expect(timingSafeEqual).not.toHaveBeenCalled();
  });
});
