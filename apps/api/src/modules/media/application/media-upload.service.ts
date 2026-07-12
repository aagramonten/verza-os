import { randomUUID } from 'node:crypto';
import type { StorageProvider } from './storage.port.js';

export const MAX_PHOTOS_PER_LEAD = 8;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export class MediaRejectedError extends Error {
  constructor(public readonly reason: 'type' | 'too_large' | 'too_many' | 'empty') {
    super(`Photo rejected: ${reason}`);
    this.name = 'MediaRejectedError';
  }
}

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface LeadMediaRepository {
  create(input: {
    leadId: string;
    sessionId: string;
    storageKey: string;
    mime: string;
    sizeBytes: number;
  }): Promise<{ id: string }>;
  countPhotos(leadId: string): Promise<number>;
}

/**
 * Validates and stores a customer photo. Type is checked by BOTH the declared
 * mime and the file's magic bytes (a declared image/png must actually be a
 * PNG); size and per-lead count are capped. The bytes go through the storage
 * port and a lead_media row records the reference.
 */
export class MediaUploadService {
  constructor(
    private readonly storage: StorageProvider,
    private readonly leadMedia: LeadMediaRepository,
  ) {}

  async store(input: {
    leadId: string;
    sessionId: string;
    file: UploadedFile;
  }): Promise<{ mediaId: string; photoCount: number }> {
    const { file, leadId, sessionId } = input;

    if (file.size === 0 || file.buffer.length === 0) {
      throw new MediaRejectedError('empty');
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new MediaRejectedError('too_large');
    }
    const ext = ALLOWED[file.mimetype];
    if (ext === undefined || !magicBytesMatch(file.buffer, file.mimetype)) {
      throw new MediaRejectedError('type');
    }

    const existing = await this.leadMedia.countPhotos(leadId);
    if (existing >= MAX_PHOTOS_PER_LEAD) {
      throw new MediaRejectedError('too_many');
    }

    const storageKey = `leads/${leadId}/${randomUUID()}.${ext}`;
    await this.storage.put(storageKey, file.buffer, file.mimetype);
    const media = await this.leadMedia.create({
      leadId,
      sessionId,
      storageKey,
      mime: file.mimetype,
      sizeBytes: file.size,
    });

    return { mediaId: media.id, photoCount: existing + 1 };
  }
}

/** Verify the declared image type against the file's leading bytes. */
export function magicBytesMatch(buffer: Buffer, mimetype: string): boolean {
  if (buffer.length < 12) return false;
  switch (mimetype) {
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return (
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
      );
    case 'image/webp':
      return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    case 'image/heic':
    case 'image/heif':
      return buffer.toString('ascii', 4, 8) === 'ftyp';
    default:
      return false;
  }
}
