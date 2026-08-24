import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Generic file upload, used by any feature that needs a photo (Seller
 * Stock's label/damage-evidence photos so far). Returns a URL; callers
 * store that URL string on their own record rather than embedding file
 * handling in every feature's DTOs.
 *
 * Storage backend (Cloudinary vs local disk) is chosen in
 * uploads.storage.ts, registered at the module level so it can depend
 * on ConfigService — see that file for why. Multer populates different
 * fields depending on which storage engine ran: Cloudinary's puts the
 * resulting secure URL in `file.path`; disk storage just puts the
 * generated basename in `file.filename`. Checking whether `path` looks
 * like a URL (rather than assuming based on config) keeps this correct
 * regardless of which stored the file.
 */
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    const url = /^https?:\/\//.test(file.path ?? '') ? file.path : `/uploads/${file.filename}`;
    return { url };
  }
}
