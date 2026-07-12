import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { StorageProvider } from '../application/storage.port.js';

/**
 * Local filesystem storage for development and the single-node MVP. Files live
 * under a configured root directory (`STORAGE_LOCAL_DIR`) which is gitignored
 * and never served directly from the web root.
 */
export class LocalDiskStorage implements StorageProvider {
  private readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    // Reject path traversal in keys before touching the filesystem.
    if (key.includes('..')) {
      throw new Error('Invalid storage key');
    }
    const fullPath = join(this.root, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, bytes);
  }
}
