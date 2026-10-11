import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app';
import { createFolderIfNotExistInSharepoint, getAccessToken, getFormDigestValue, uploadFileToSharepoint, uploadObjectAsJSON } from '../src/utils/sharepoint-utils';
import { KEY_PAIRS, hmac } from './helpers/fixtures';
import { SESSION_ID, attempts, mediaContentType, serveSession, sessionCalls, sessionValues } from './helpers/session';

vi.mock('../src/utils/sharepoint-utils');

const ACCESS_TOKEN = 'sharepoint-access-token';
const FORM_DIGEST = 'sharepoint-form-digest';

const sendDecision = (code: number) => {
  const body = JSON.stringify({ status: 'success', verification: { id: SESSION_ID, code } });
  return request(app)
    .post('/webhooks/decision')
    .set('Content-Type', 'application/json')
    .set('X-HMAC-SIGNATURE', hmac(body, KEY_PAIRS[0].sharedSecretKey))
    .send(body);
};

const foldersCreated = () => vi.mocked(createFolderIfNotExistInSharepoint).mock.calls.map(([path]) => path);

const filesUploaded = () => [
  ...vi.mocked(uploadObjectAsJSON).mock.calls.map(([, , fileName, , folderPath]) => `${folderPath}/${fileName}`),
  ...vi.mocked(uploadFileToSharepoint).mock.calls.map(([fileName, , , , , folderPath]) => `${folderPath}/${fileName}`),
];

describe('Decision webhook output in SharePoint', () => {
  beforeEach(() => {
    vi.mocked(getAccessToken).mockResolvedValue(ACCESS_TOKEN);
    vi.mocked(getFormDigestValue).mockResolvedValue(FORM_DIGEST);
  });

  it.each([
    [9001, 'Successful'],
    [9102, 'Unsuccessful'],
    [9103, 'Unsuccessful'],
  ])('files decision %i under KYC Details/%s/Name_SessionID/AttemptID', async (code, outcome) => {
    serveSession(code);
    const sessionFolder = `KYC Details/${outcome}/Jane Doe_${SESSION_ID}`;

    const res = await sendDecision(code);

    expect(res.status).toBe(200);
    expect(foldersCreated()).toEqual([
      `KYC Details/${outcome}`,
      sessionFolder,
      `${sessionFolder}/attempt-1`,
      `${sessionFolder}/attempt-1/DecisionEvent`,
      `${sessionFolder}/attempt-2`,
      `${sessionFolder}/attempt-2/DecisionEvent`,
    ]);
  });

  it("uploads the session JSON, with every attempt's media in that attempt's folder beside it", async () => {
    serveSession(9001);
    const sessionFolder = `KYC Details/Successful/Jane Doe_${SESSION_ID}`;

    const res = await sendDecision(9001);

    expect(res.status).toBe(200);
    expect(filesUploaded().sort()).toEqual([
      `${sessionFolder}/attempt-1/DecisionEvent/document-back.jpeg`,
      `${sessionFolder}/attempt-1/DecisionEvent/document-front.jpeg`,
      `${sessionFolder}/attempt-1/DecisionEvent/face.jpeg`,
      `${sessionFolder}/attempt-1/DecisionEvent/selfid_video.webm`,
      `${sessionFolder}/attempt-2/DecisionEvent/document-front.jpeg`,
      `${sessionFolder}/attempt-2/DecisionEvent/face.jpeg`,
      `${sessionFolder}/attempts.json`,
      `${sessionFolder}/curpData.json`,
      `${sessionFolder}/ineData.json`,
      `${sessionFolder}/mediaList.json`,
      `${sessionFolder}/personInfo.json`,
      `${sessionFolder}/sessionDecision.json`,
      `${sessionFolder}/watchlistScreening.json`,
    ]);

    // Each JSON file holds what Veriff returned for that call
    const values = sessionValues(9001);
    for (const call of sessionCalls) {
      expect(uploadObjectAsJSON).toHaveBeenCalledWith(ACCESS_TOKEN, FORM_DIGEST, `${call}.json`, values[call], sessionFolder);
    }

    // Each media file is uploaded with the bytes and content type Veriff served
    for (const { id, images, videos } of attempts) {
      for (const kind of ['images', 'videos'] as const) {
        for (const media of { images, videos }[kind]) {
          const contentType = mediaContentType(kind);
          const fileName = `${media.context}.${contentType.split('/')[1]}`;
          expect(uploadFileToSharepoint).toHaveBeenCalledWith(fileName, Buffer.from(media.id), contentType, ACCESS_TOKEN, FORM_DIGEST, `${sessionFolder}/${id}/DecisionEvent`);
        }
      }
    }
  });
});
