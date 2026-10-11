import { fakeVeriff } from './fake-veriff';
import { VERSION } from './fixtures';

export const SESSION_ID = '5f1b7c2e-4a9d-4c3b-8e6f-0d2a1b3c4d5e';

export const person = { firstName: 'Jane', lastName: 'Doe', idNumber: 'X1234567' };

export const attempts = [
  {
    id: 'attempt-1',
    images: [
      { id: 'media-1', context: 'document-front' },
      { id: 'media-2', context: 'document-back' },
      { id: 'media-3', context: 'face' },
    ],
    videos: [{ id: 'media-4', context: 'selfid_video' }],
  },
  {
    id: 'attempt-2',
    images: [
      { id: 'media-5', context: 'document-front' },
      { id: 'media-6', context: 'face' },
    ],
    videos: [],
  },
];

// The seven session calls, keyed by the names getRelavantSessionData returns them under
export const sessionUrls = {
  sessionDecision: `/sessions/${SESSION_ID}/decision`,
  personInfo: `/sessions/${SESSION_ID}/person`,
  mediaList: `/sessions/${SESSION_ID}/media`,
  watchlistScreening: `/sessions/${SESSION_ID}/watchlist-screening`,
  ineData: `/sessions/${SESSION_ID}/decision/ine-registry?version=${VERSION}`,
  curpData: `/sessions/${SESSION_ID}/decision/curp-registry?version=${VERSION}`,
  attempts: `/sessions/${SESSION_ID}/attempts`,
};

export type SessionCall = keyof typeof sessionUrls;
export const sessionCalls = Object.keys(sessionUrls) as SessionCall[];

/**
 * What getRelavantSessionData returns for each call: the response body, or the part of it the client unwraps.
 * @param {number} decisionCode - Veriff decision code (9001 approved, 9102 declined, 9103 resubmission requested).
 */
export const sessionValues = (decisionCode = 9001) => ({
  sessionDecision: { status: 'success', verification: { id: SESSION_ID, code: decisionCode } },
  personInfo: person,
  mediaList: { status: 'success', images: attempts.flatMap(({ images }) => images), videos: attempts.flatMap(({ videos }) => videos) },
  watchlistScreening: { status: 'success', data: { matchStatus: 'no_match' } },
  ineData: { status: 'success', data: { valid: true } },
  curpData: { status: 'success', data: { curp: 'DOEJ900101MDFXXX09' } },
  attempts: attempts.map(({ id }) => ({ id, status: 'done' })),
});

/**
 * The Veriff response body for each of the seven session calls.
 * @param {number} decisionCode - Veriff decision code.
 */
export const sessionResponses = (decisionCode = 9001): Record<SessionCall, unknown> => {
  const values = sessionValues(decisionCode);
  return {
    ...values,
    personInfo: { status: 'success', person: values.personInfo },
    attempts: { status: 'success', verifications: values.attempts },
  };
};

export const mediaContentType = (kind: 'images' | 'videos') => (kind === 'images' ? 'image/jpeg' : 'video/webm');

/**
 * Serve a complete session from the fake Veriff API: the seven session calls,
 * each attempt's media list and every media file.
 * @param {number} decisionCode - Veriff decision code.
 */
export const serveSession = (decisionCode = 9001) => {
  const responses = sessionResponses(decisionCode);
  for (const call of sessionCalls) {
    fakeVeriff.route(sessionUrls[call], { data: responses[call] });
  }

  for (const { id, images, videos } of attempts) {
    fakeVeriff.route(`/attempts/${id}/media`, { data: { status: 'success', images, videos } });
    for (const kind of ['images', 'videos'] as const) {
      for (const media of { images, videos }[kind]) {
        fakeVeriff.route(`/media/${media.id}`, { data: Buffer.from(media.id), headers: { 'content-type': mediaContentType(kind) } });
      }
    }
  }
};
