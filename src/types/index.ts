export interface KeyPair {
  apiKey: string;
  sharedSecretKey: string;
}

export interface MediaItem {
  context: string; // Context type of the image/video.
  id: string; // Image/Video Id (UUID-v4 format).
  name: string; // Image/Video name.
  duration?: string; // Video duration in seconds.
  url: string; // Image/Video download URL.
  size: string; // Image/Video size in bytes.
  timestamp: object | null; // Timestamp object (deprecated, may be null).
  mimetype: string; // Format of the media file.
}