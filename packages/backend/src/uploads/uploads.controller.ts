import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { diskStorage } from 'multer';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UPLOADS_DIR } from './uploads.constants';

/**
 * Generic file upload, used by any feature that needs a photo (Seller
 * Stock's label/damage-evidence photos so far). Returns a URL; callers
 * store that URL string on their own record rather than embedding file
 * handling in every feature's DTOs.
 */
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return { url: `/uploads/${file.filename}` };
  }
}
