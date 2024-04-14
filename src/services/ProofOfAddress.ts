import { Response } from 'express';
import BaseWebhookHandler from './BaseWebhookHandler';
import { MediaItem } from '../types';
import { getRelavantSessionData } from '../utils/veriff-utils';
import { createFolderIfNotExistInSharepoint, uploadObjectAsJSON } from '../utils/sharepoint-utils';

class ProofOfAddress extends BaseWebhookHandler {
  public async handleWebhook(payload: any, res: Response) {
    try {
      const { id: sessionId, addressId } = payload;

      // Get all the data from Veriff
      const { sessionDecision, personInfo, mediaList, watchlistScreening, attempts } = await getRelavantSessionData(ProofOfAddress.veriffAPI, sessionId, ProofOfAddress.version);
      const personName = `${personInfo.value.firstName} ${personInfo.value.lastName}`;

      // Create folders for session and attempts
      const objectFilesPath = `KYC Details/${personName}_${sessionId}`;
      await createFolderIfNotExistInSharepoint(objectFilesPath, this.accessToken, this.formDigestValue);

      // Upload JSON data to SharePoint
      await Promise.all([
        uploadObjectAsJSON(this.accessToken, this.formDigestValue, `personInfo.json`, personInfo.value, objectFilesPath),
        uploadObjectAsJSON(this.accessToken, this.formDigestValue, `mediaList.json`, mediaList.value, objectFilesPath),
        uploadObjectAsJSON(this.accessToken, this.formDigestValue, `sessionDecision.json`, sessionDecision.value, objectFilesPath),
        uploadObjectAsJSON(this.accessToken, this.formDigestValue, `watchlistScreening.json`, watchlistScreening.value, objectFilesPath)
      ]);

      // Upload media files for address
      if (addressId) {
        const addressMedia = await ProofOfAddress.veriffAPI.getAddressMedia(addressId);
        if (addressMedia) {
          const addressMediaPath = `KYC Details/${personName}_KYC/${addressId}/ProofOfAddress`;
          await createFolderIfNotExistInSharepoint(`KYC Details/${personName}_KYC/${addressId}`, this.accessToken, this.formDigestValue);
          await createFolderIfNotExistInSharepoint(addressMediaPath, this.accessToken, this.formDigestValue);
          await this.uploadMediaFiles(addressMedia.images, addressMediaPath);
          await this.uploadMediaFiles(addressMedia.videos, addressMediaPath);
        }
      }

      // Upload media files for attempts
      if (attempts.value) {
        for (const attempt of attempts.value) {
          const folderPath = `KYC Details/${personName}_KYC/${attempt.id}/ProofOfAddress`;
          await createFolderIfNotExistInSharepoint(`KYC Details/${personName}_KYC/${attempt.id}`, this.accessToken, this.formDigestValue);
          await createFolderIfNotExistInSharepoint(folderPath, this.accessToken, this.formDigestValue);
          const attemptMedia = await ProofOfAddress.veriffAPI.getMediaForAttempt(attempt.id);
          await this.uploadMediaFiles(attemptMedia.images, folderPath);
          await this.uploadMediaFiles(attemptMedia.videos, folderPath);
        }
      }

      return res.status(200).json({ message: "success" });

    } catch (error) {
      console.error('Error handling proof of address event webhook:', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

export default ProofOfAddress;
