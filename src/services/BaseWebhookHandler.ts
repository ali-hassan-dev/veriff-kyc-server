import VeriffAPI from '../services/VeriffAPI';
import { getAccessToken, getFormDigestValue, uploadFileToSharepoint } from '../utils/sharepoint-utils';
import { MediaItem } from '../types';

const { VERSION, BASE_URL, API_KEYS } = process.env;
if (!API_KEYS) throw new Error('API keys not found');
if (!BASE_URL) throw new Error('API version not found');
if (!VERSION) throw new Error('API version not found');
const obj = new VeriffAPI(JSON.parse(API_KEYS), BASE_URL);

class BaseWebhookHandler {
  protected static veriffAPI = obj;
  protected static version = VERSION || '1.0.0';
  protected accessToken: string;
  protected formDigestValue: string;

  constructor() {
    throw new Error('Please use the new() method to create an instance.');
  }

  public static async new() {
    let instance = Object.create(BaseWebhookHandler.prototype);
    await instance.init();
    return instance;
  }

  private async init() {
    this.accessToken = await getAccessToken();
    this.formDigestValue = await getFormDigestValue(this.accessToken);
  }

  protected async uploadMediaFiles(mediaItems: MediaItem[], folderPath: string) {
    for (const mediaItem of mediaItems) {
      const { id, context } = mediaItem;
      const data = await BaseWebhookHandler.veriffAPI.getMediaById(id);
      const fileExtension = data?.contentType.split('/')[1];
      const fileName = `${context}.${fileExtension}`;
      await uploadFileToSharepoint(fileName, data?.media, data?.contentType, this.accessToken, this.formDigestValue, folderPath);
    }
  }
}

export default BaseWebhookHandler;