import { Response } from 'express';
import BaseWebhookHandler from './BaseWebhookHandler';
import { getRelavantSessionData } from '../utils/veriff-utils';
import { createFolderIfNotExistInSharepoint, uploadObjectAsJSON } from '../utils/sharepoint-utils';

class VerificationEvents extends BaseWebhookHandler {
  public async handleWebhook(payload: any, res: Response) {
    try {
      const { id: sessionId, code } = payload.verification;
      const event = code === 7001 ? 'Started' : code === 7002 ? 'Submitted' : 'VerificationEvent';

      // Get all the data from Veriff
      const { sessionDecision, personInfo, mediaList, watchlistScreening, attempts } = await getRelavantSessionData(VerificationEvents.veriffAPI, sessionId, VerificationEvents.version);

      // Ensure person information is available
      let personName = `No Name`;
      if (personInfo?.value?.firstName)
        personName = `${personInfo.value.firstName} ${personInfo.value.lastName}`;
      else
        return;

      // Create folders for session and attempts
      const personFolderPath = `KYC Details/${event}`;
      const objectFilesPath = `${personFolderPath}/${personName}_${sessionId}`;
      await createFolderIfNotExistInSharepoint(personFolderPath, this.accessToken, this.formDigestValue);
      await createFolderIfNotExistInSharepoint(objectFilesPath, this.accessToken, this.formDigestValue);

      // Upload JSON data to SharePoint
      const jsonUploadTasks = [
        { name: 'personInfo', data: personInfo },
        { name: 'mediaList', data: mediaList },
        { name: 'attempts', data: attempts },
        { name: 'sessionDecision', data: sessionDecision },
        { name: 'watchlistScreening', data: watchlistScreening }
      ];

      await Promise.all(jsonUploadTasks.map(async ({ name, data }) => {
        uploadObjectAsJSON(this.accessToken, this.formDigestValue, `${name}.json`, data.value, objectFilesPath);
      }));

      // Upload media files for attempts
      if (!attempts.value)
        return;

      for (const attempt of attempts.value) {
        const { id } = attempt;
        const folderPath = `${objectFilesPath}/${id}/VerificationEvent`;
        await createFolderIfNotExistInSharepoint(`${objectFilesPath}/${id}`, this.accessToken, this.formDigestValue);
        await createFolderIfNotExistInSharepoint(folderPath, this.accessToken, this.formDigestValue);

        const attemptMedia = await VerificationEvents.veriffAPI.getMediaForAttempt(id);
        await this.uploadMediaFiles(attemptMedia.images, folderPath);
        await this.uploadMediaFiles(attemptMedia.videos, folderPath);
        console.log(`Media for Attempt ID ${id}: `, attemptMedia);
      }

      return res.status(200).json({ message: 'success' });

    } catch (error) {
      console.error('Error handling verification event webhook:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default VerificationEvents;