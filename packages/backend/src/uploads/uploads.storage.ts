import { type ConfigService } from '@nestjs/config';
import { type MulterModuleOptions } from '@nestjs/platform-express';
import { v2 as cloudinary } from 'cloudinary';
import { diskStorage, type StorageEngine } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { UPLOADS_DIR } from './uploads.constants';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * A small hand-written Multer StorageEngine rather than pulling in
 * multer-storage-cloudinary — that package's latest release only
 * supports Cloudinary SDK v1 (peer dep `cloudinary@^1.21.0`), and this
 * project uses the current v2 SDK. Piping the file stream straight into
 * `cloudinary.uploader.upload_stream` is a handful of lines and avoids
 * depending on an adapter that isn't compatible with the SDK version we
 * actually want.
 */
class CloudinaryStorageEngine implements StorageEngine {
  _handleFile(
    _req: unknown,
    file: Express.Multer.File,
    callback: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ): void {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'warehouse-hq', public_id: randomUUID(), resource_type: 'image' },
      (error, result) => {
        if (error || !result) {
          callback(error ?? new Error('Cloudinary upload returned no result'));
          return;
        }
        // `path` carries the resulting URL — uploads.controller.ts checks
        // whether it looks like a URL to decide how to use it, so this
        // is the one field that matters; the rest just keep the shape
        // close to what disk storage would have produced.
        callback(undefined, { path: result.secure_url, filename: result.public_id, size: result.bytes });
      },
    );
    file.stream.pipe(uploadStream);
  }

  _removeFile(_req: unknown, _file: Express.Multer.File, callback: (error: Error | null) => void): void {
    // Not implemented — same as disk storage, which also doesn't clean
    // up a partially-written file if a later part of the request fails.
    // Acceptable at this scale; revisit if orphaned Cloudinary uploads
    // ever become a real cost/clutter concern.
    callback(null);
  }
}

/**
 * Cloudinary when configured (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET
 * all set) — the real hosted-backend path, since a free PaaS tier (e.g.
 * Render) has no persistent disk: anything saved locally is lost on the
 * next restart. Local disk otherwise (dev machine, e2e tests) — no
 * external network call and no Cloudinary account needed just to run
 * the app or the test suite. See uploads.controller.ts for how the
 * returned URL shape (absolute vs relative) is handled either way.
 */
export function buildMulterOptions(config: ConfigService): MulterModuleOptions {
  const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
  const apiKey = config.get<string>('CLOUDINARY_API_KEY');
  const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    return {
      storage: new CloudinaryStorageEngine(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    };
  }

  return {
    storage: diskStorage({
      destination: UPLOADS_DIR,
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
  };
}
