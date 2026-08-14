import { join } from 'node:path';

/**
 * TEMPORARY LOCAL-DISK STORAGE — not production-grade (no CDN, doesn't
 * survive a redeploy, single-instance only). Deliberate scope decision,
 * same spirit as the in-memory DB: prove photo capture works end-to-end
 * first. Swap for S3/Cloud Storage + signed URLs once this needs to
 * survive anything beyond local dev.
 */
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
