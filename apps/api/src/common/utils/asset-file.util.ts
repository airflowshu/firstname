import { BadRequestException } from '@nestjs/common';
import { MemberAssetCategory } from '@prisma/client';
import { extname } from 'node:path';

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'application/x-msdownload',
]);

const DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.zip',
]);

const PHOTO_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
]);

function getFileExtension(filename: string) {
  return extname(filename || '').toLowerCase();
}

export function validateMemberAssetFile(file: Express.Multer.File, category: MemberAssetCategory) {
  const extension = getFileExtension(file.originalname);

  if (category === MemberAssetCategory.PHOTO) {
    if (file.mimetype.startsWith('image/') || PHOTO_EXTENSIONS.has(extension)) {
      return;
    }

    throw new BadRequestException(`文件 ${file.originalname} 不是合法的图片类型。`);
  }

  if (
    (!file.mimetype || DOCUMENT_MIME_TYPES.has(file.mimetype)) &&
    DOCUMENT_EXTENSIONS.has(extension)
  ) {
    return;
  }

  throw new BadRequestException(
    `文件 ${file.originalname} 不是支持的附件类型，请上传 PDF、Word、Excel、PPT、TXT 或 ZIP 文件。`,
  );
}
