UPDATE "Family"
SET
  "familyType" = 'DEMO',
  "resetTemplateKey" = 'default-demo'
WHERE "name" = '默认家族';

INSERT INTO "Family" (
  "id",
  "name",
  "status",
  "familyType",
  "createdAt",
  "updatedAt"
)
SELECT
  'system-template-family',
  '系统设置模板家族',
  'ACTIVE',
  'TEMPLATE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "Family"
  WHERE "familyType" = 'TEMPLATE'
);

WITH template_family AS (
  SELECT "id"
  FROM "Family"
  WHERE "familyType" = 'TEMPLATE'
  ORDER BY "createdAt" ASC
  LIMIT 1
),
source_family AS (
  SELECT "id"
  FROM "Family"
  WHERE "name" = '默认家族'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
INSERT INTO "KinshipAlias" (
  "id",
  "familyId",
  "relationCode",
  "standardTerm",
  "familyAlias",
  "enabled",
  "createdAt",
  "updatedAt"
)
SELECT
  'tmpl_ka_' || substr(md5(random()::text || clock_timestamp()::text || alias."relationCode"), 1, 18),
  template_family."id",
  alias."relationCode",
  alias."standardTerm",
  alias."familyAlias",
  alias."enabled",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM template_family
CROSS JOIN source_family
JOIN "KinshipAlias" alias
  ON alias."familyId" = source_family."id"
WHERE NOT EXISTS (
  SELECT 1
  FROM "KinshipAlias"
  WHERE "familyId" = template_family."id"
);

WITH template_family AS (
  SELECT "id"
  FROM "Family"
  WHERE "familyType" = 'TEMPLATE'
  ORDER BY "createdAt" ASC
  LIMIT 1
),
source_family AS (
  SELECT "id"
  FROM "Family"
  WHERE "name" = '默认家族'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
INSERT INTO "AssetTag" (
  "id",
  "familyId",
  "name",
  "enabled",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'tmpl_tag_' || substr(md5(random()::text || clock_timestamp()::text || tag."name"), 1, 17),
  template_family."id",
  tag."name",
  tag."enabled",
  tag."sortOrder",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM template_family
CROSS JOIN source_family
JOIN "AssetTag" tag
  ON tag."familyId" = source_family."id"
WHERE NOT EXISTS (
  SELECT 1
  FROM "AssetTag"
  WHERE "familyId" = template_family."id"
);

WITH template_family AS (
  SELECT "id"
  FROM "Family"
  WHERE "familyType" = 'TEMPLATE'
  ORDER BY "createdAt" ASC
  LIMIT 1
),
source_family AS (
  SELECT "id"
  FROM "Family"
  WHERE "name" = '默认家族'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
INSERT INTO "AssetSource" (
  "id",
  "familyId",
  "name",
  "enabled",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'tmpl_src_' || substr(md5(random()::text || clock_timestamp()::text || source."name"), 1, 17),
  template_family."id",
  source."name",
  source."enabled",
  source."sortOrder",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM template_family
CROSS JOIN source_family
JOIN "AssetSource" source
  ON source."familyId" = source_family."id"
WHERE NOT EXISTS (
  SELECT 1
  FROM "AssetSource"
  WHERE "familyId" = template_family."id"
);
