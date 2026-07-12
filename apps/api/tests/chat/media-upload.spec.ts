import { describe, expect, it } from 'vitest';
import {
  magicBytesMatch,
  MediaRejectedError,
  MediaUploadService,
  type LeadMediaRepository,
} from '../../src/modules/media/application/media-upload.service.js';
import type { StorageProvider } from '../../src/modules/media/application/storage.port.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);

class FakeStorage implements StorageProvider {
  puts: string[] = [];
  put(key: string): Promise<void> {
    this.puts.push(key);
    return Promise.resolve();
  }
}

function repo(count: number): LeadMediaRepository & { created: number } {
  return {
    created: 0,
    create() {
      this.created += 1;
      return Promise.resolve({ id: `media-${this.created}` });
    },
    countPhotos() {
      return Promise.resolve(count);
    },
  };
}

describe('magic-byte detection', () => {
  it('accepts a real png declared as png', () => {
    expect(magicBytesMatch(PNG, 'image/png')).toBe(true);
  });
  it('rejects a jpeg body declared as png', () => {
    expect(magicBytesMatch(JPEG, 'image/png')).toBe(false);
  });
});

describe('media upload service', () => {
  it('stores a valid photo and returns the new count', async () => {
    const storage = new FakeStorage();
    const svc = new MediaUploadService(storage, repo(2));
    const result = await svc.store({
      leadId: 'lead-1',
      sessionId: 'sess-1',
      file: { buffer: PNG, mimetype: 'image/png', size: PNG.length },
    });
    expect(result.photoCount).toBe(3);
    expect(storage.puts[0]).toMatch(/^leads\/lead-1\/.+\.png$/);
  });

  it('rejects an unsupported / spoofed type', async () => {
    const svc = new MediaUploadService(new FakeStorage(), repo(0));
    await expect(
      svc.store({
        leadId: 'l',
        sessionId: 's',
        file: { buffer: JPEG, mimetype: 'image/png', size: JPEG.length },
      }),
    ).rejects.toBeInstanceOf(MediaRejectedError);
    await expect(
      svc.store({
        leadId: 'l',
        sessionId: 's',
        file: { buffer: Buffer.from('hello world!!'), mimetype: 'text/plain', size: 13 },
      }),
    ).rejects.toBeInstanceOf(MediaRejectedError);
  });

  it('rejects when the per-lead photo limit is reached', async () => {
    const svc = new MediaUploadService(new FakeStorage(), repo(8));
    await expect(
      svc.store({
        leadId: 'l',
        sessionId: 's',
        file: { buffer: PNG, mimetype: 'image/png', size: PNG.length },
      }),
    ).rejects.toMatchObject({ reason: 'too_many' });
  });

  it('rejects an empty file', async () => {
    const svc = new MediaUploadService(new FakeStorage(), repo(0));
    await expect(
      svc.store({
        leadId: 'l',
        sessionId: 's',
        file: { buffer: Buffer.alloc(0), mimetype: 'image/png', size: 0 },
      }),
    ).rejects.toMatchObject({ reason: 'empty' });
  });
});
