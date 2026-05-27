import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator';
import type { Request } from 'express';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { validateImageUpload } from '../../application/security/fileTypeDetection';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// uploads/ klasörü yoksa oluştur
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Güvenli görsel yükleme endpoint'i.
 *
 * GÜVENLİK KATMANLARI:
 *   1. Multer memoryStorage → dosya disk'e yazılmadan önce magic byte kontrolü
 *   2. validateImageUpload() → SVG reject + JPEG/PNG/WebP/GIF whitelist
 *   3. Filename randomized (crypto.randomBytes) → path traversal yok
 *   4. Extension dosyanın gerçek tipinden (HTTP header DEĞİL)
 *   5. Max 5MB
 *   6. Roles guard ile auth zorunlu
 *
 * GELECEK (Sprint 8):
 *   - ClamAV virus scan (polyglot dosyalar için)
 *   - S3 pre-signed URL (uploads/ disk yerine object storage)
 */
@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  @Post('image')
  @Roles('CANDIDATE', 'EDUCATOR', 'ADMIN', 'WORKER')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(
    FileInterceptor('file', {
      // memoryStorage: magic byte check ÖNCE, disk yazma SONRA. Multer
      // diskStorage kullansaydık, geçersiz dosya zaten disk'e düşmüş olurdu.
      limits: { fileSize: MAX_SIZE_BYTES },
      // İlk filtre: HTTP MIME type'a güvenmiyoruz ama açıkça image/* dışını
      // erkenden reddet (bandwidth tasarrufu). Gerçek doğrulama controller'da.
      fileFilter: (_req: Request, file: Express.Multer.File, cb: (err: Error | null, accept: boolean) => void) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Sadece görsel dosyası yüklenebilir'), false);
        }
        cb(null, true);
      },
    }),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadImage(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Dosya bulunamadı');
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('Dosya içeriği okunamadı');
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(`Dosya boyutu ${MAX_SIZE_BYTES / 1024 / 1024}MB'dan büyük olamaz`);
    }

    // KRITIK: Magic byte detection — HTTP MIME header'a asla güvenme.
    const validation = validateImageUpload(file.buffer);
    if (!validation.ok) {
      throw new BadRequestException(validation.reason);
    }

    // Filename'i CRYPTO ile üret — kullanıcı originalName'i ile alakası yok.
    // Extension magic byte'tan geliyor → fake `.svg.jpg` gibi denemeler etkisiz.
    const randomName = randomBytes(16).toString('hex');
    const filename = `${Date.now()}-${randomName}${validation.detected.extension}`;
    const fullPath = join(UPLOAD_DIR, filename);

    // Buffer'ı disk'e yaz (memoryStorage kullandığımız için manuel)
    writeFileSync(fullPath, file.buffer);

    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${baseUrl}/uploads/${filename}`;

    return {
      url,
      filename,
      size: file.size,
      detectedType: validation.detected.type,
      mimeType: validation.detected.mimeType,
    };
  }
}
