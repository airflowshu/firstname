import type {
  Gender,
  MarriageStatus,
  MemberAssetCategory,
  MemberEventType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { defaultDemoTemplate } from './default-demo';

export type DemoTemplateSettings = {
  kinshipAliases: Array<{
    relationCode: string;
    standardTerm: string;
    familyAlias: string;
    enabled?: boolean;
  }>;
  assetTags: Array<{
    name: string;
    enabled?: boolean;
    sortOrder?: number;
  }>;
  assetSources: Array<{
    name: string;
    enabled?: boolean;
    sortOrder?: number;
  }>;
};

export type DemoTemplateUser = {
  username: string;
  phone: string;
  displayName: string;
  password: string;
  role: UserRole;
  status: UserStatus;
};

export type DemoResetTemplate = {
  key: string;
  familyName: string;
  settings: DemoTemplateSettings;
  users: DemoTemplateUser[];
  data: {
    members: Array<{
      code: string;
      name: string;
      gender: Gender;
      birthDate?: string;
      deathDate?: string;
      generationName?: string;
      birthOrder?: number;
      nativePlace?: string;
      notes?: string;
      fatherCode?: string;
      motherCode?: string;
    }>;
    marriages: Array<{
      memberCode: string;
      spouseCode: string;
      status: MarriageStatus;
      startDate?: string;
      endDate?: string;
    }>;
    events: Array<{
      memberCode: string;
      eventType: MemberEventType;
      title: string;
      description?: string;
      eventDate: string;
      createdByUsername?: string;
    }>;
    assets: Array<{
      memberCode: string;
      category: MemberAssetCategory;
      filePath: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      checksum?: string;
      title?: string;
      sourceType?: string;
      source?: string;
      description?: string;
      tags?: string[];
      uploadedByUsername?: string;
    }>;
  };
};

export const demoResetTemplates: Record<string, DemoResetTemplate> = {
  [defaultDemoTemplate.key]: defaultDemoTemplate,
};

export function getDemoResetTemplate(templateKey: string) {
  return demoResetTemplates[templateKey];
}
