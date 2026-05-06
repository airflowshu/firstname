import { BadRequestException } from '@nestjs/common';
import { MemberAssetCategory } from '@prisma/client';
import { validateMemberAssetFile } from './asset-file.util';

function mockFile(originalname: string, mimetype: string): Express.Multer.File {
  return {
    originalname,
    mimetype,
    buffer: Buffer.from('test'),
    size: 4,
  } as Express.Multer.File;
}

describe('validateMemberAssetFile', () => {
  it('accepts docx files even when the browser reports a generic mime type', () => {
    expect(() =>
      validateMemberAssetFile(
        mockFile('族谱资料.docx', 'application/octet-stream'),
        MemberAssetCategory.DOCUMENT,
      ),
    ).not.toThrow();
  });

  it('rejects unsupported document extensions with a Chinese message', () => {
    expect(() =>
      validateMemberAssetFile(
        mockFile('可执行文件.exe', 'application/octet-stream'),
        MemberAssetCategory.DOCUMENT,
      ),
    ).toThrow(BadRequestException);
  });
});
