/**
 * Storage abstraction. The MVP binds a local-disk adapter; a cloud
 * (S3/R2) adapter can replace it later behind the same port without touching
 * the upload use-case. Keys are opaque, hierarchical paths (e.g.
 * `leads/<leadId>/<uuid>.jpg`).
 */
export interface StorageProvider {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
}
