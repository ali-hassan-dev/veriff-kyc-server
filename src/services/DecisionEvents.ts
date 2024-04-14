import { Response } from 'express';
import BaseWebhookHandler from './BaseWebhookHandler';
import { getRelavantSessionData } from '../utils/veriff-utils';
import { createFolderIfNotExistInSharepoint, uploadObjectAsJSON } from '../utils/sharepoint-utils';

class DecisionEvents extends BaseWebhookHandler {
  public async handleWebhook(payload: any, res: Response) {
    try {
      const { id: sessionId } = payload.verification;

      // Get all the data from Veriff
      const result = await getRelavantSessionData(DecisionEvents.veriffAPI, sessionId, DecisionEvents.version);
      if (Object.values(result).every(data => data.value === undefined || data.value === null)) {
        return res.status(404).json({ error: 'Data not found' });
      }
      const { sessionDecision, personInfo, mediaList, watchlistScreening, ineData, curpData, attempts } = result;

      let personName = `No Name`;
      if (personInfo?.value?.firstName)
        personName = `${personInfo.value.firstName} ${personInfo.value.lastName}`;
      else
        return res.status(404).json({ error: 'Sufficient data not found' });

      const decision = sessionDecision?.value?.verification?.code === 9001 ? 'Successful' : 'Unsuccessful';
      // Create folder for this session if does not exist
      const personFolderPath = `KYC Details/${decision}`;
      const objectFilesPath = `${personFolderPath}/${personName}_${sessionId}`;
      await createFolderIfNotExistInSharepoint(personFolderPath, this.accessToken, this.formDigestValue);
      await createFolderIfNotExistInSharepoint(objectFilesPath, this.accessToken, this.formDigestValue);
      const jsonUploadTasks = [
        { name: 'personInfo', data: personInfo },
        { name: 'mediaList', data: mediaList },
        { name: 'attempts', data: attempts },
        { name: 'sessionDecision', data: sessionDecision },
        { name: 'ineData', data: ineData },
        { name: 'curpData', data: curpData },
        { name: 'watchlistScreening', data: watchlistScreening }
      ];

      await Promise.all(jsonUploadTasks.map(async ({ name, data }) => {
        uploadObjectAsJSON(this.accessToken, this.formDigestValue, `${name}.json`, data.value, objectFilesPath);
      }));

      if (!attempts.value)
        return;

      for (const attempt of attempts.value) {
        // Create folder for this attempt
        const { id } = attempt;
        const folderPath = `${objectFilesPath}/${id}/DecisionEvent`;
        await createFolderIfNotExistInSharepoint(`${objectFilesPath}/${id}`, this.accessToken, this.formDigestValue);
        await createFolderIfNotExistInSharepoint(folderPath, this.accessToken, this.formDigestValue);
        // Upload payload and relevant data fetched
        const attemptMedia = await DecisionEvents.veriffAPI.getMediaForAttempt(id);
        await this.uploadMediaFiles(attemptMedia.images, folderPath);
        await this.uploadMediaFiles(attemptMedia.videos, folderPath);
        console.log(`Media for Attempt ID ${id}: `, attemptMedia);
      }
      return res.status(200).json({ message: 'success' });
    } catch (error) {
      console.error('Error handling decision webhook:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default DecisionEvents;