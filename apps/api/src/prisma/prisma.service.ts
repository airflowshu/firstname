import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getTenantContext } from '../common/tenant/tenant-context';

const FAMILY_SCOPED_DELEGATES = [
  'member',
  'marriage',
  'memberAsset',
  'memberEvent',
  'supplementRequest',
  'supplementRequestAsset',
  'assetTag',
  'assetSource',
  'kinshipAlias',
  'auditLog',
];

const FAMILY_SCOPED_WHERE_ACTIONS = new Set([
  'findUnique',
  'findFirst',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

const FAMILY_SCOPED_CREATE_ACTIONS = new Set(['create', 'createMany']);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super();

    this.installTenantScopes();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  private installTenantScopes() {
    for (const delegateName of FAMILY_SCOPED_DELEGATES) {
      const delegate = (this as unknown as Record<string, Record<string, unknown>>)[delegateName];

      if (!delegate) {
        continue;
      }

      for (const action of FAMILY_SCOPED_WHERE_ACTIONS) {
        const original = delegate[action];
        if (typeof original !== 'function') {
          continue;
        }

        delegate[action] = ((args?: Record<string, unknown>) => {
          const familyId = this.currentScopedFamilyId();
          return original.call(
            delegate,
            familyId ? this.addFamilyScopeToWhere(args, familyId) : args,
          );
        }) as unknown;
      }

      for (const action of FAMILY_SCOPED_CREATE_ACTIONS) {
        const original = delegate[action];
        if (typeof original !== 'function') {
          continue;
        }

        delegate[action] = ((args?: Record<string, unknown>) => {
          const familyId = this.currentScopedFamilyId();
          return original.call(
            delegate,
            familyId ? this.addFamilyScopeToCreate(args, familyId) : args,
          );
        }) as unknown;
      }

      const originalUpsert = delegate.upsert;
      if (typeof originalUpsert === 'function') {
        delegate.upsert = ((args?: Record<string, unknown>) => {
          const familyId = this.currentScopedFamilyId();
          if (!familyId) {
            return originalUpsert.call(delegate, args);
          }

          const nextArgs =
            this.addFamilyScopeToCreate(this.addFamilyScopeToWhere(args, familyId), familyId) ?? {};
          const update = (nextArgs.update ?? {}) as Record<string, unknown>;
          nextArgs.update = {
            ...update,
            familyId: update.familyId ?? familyId,
          };

          return originalUpsert.call(delegate, nextArgs);
        }) as unknown;
      }
    }
  }

  private currentScopedFamilyId() {
    const tenantContext = getTenantContext();
    if (!tenantContext?.familyId || tenantContext.bypassFamilyScope) {
      return null;
    }

    return tenantContext.familyId;
  }

  private addFamilyScopeToWhere(args: Record<string, unknown> | undefined, familyId: string) {
    return {
      ...args,
      where: {
        ...((args?.where as Record<string, unknown> | undefined) ?? {}),
        familyId,
      },
    };
  }

  private addFamilyScopeToCreate(args: Record<string, unknown> | undefined, familyId: string) {
    if (!args?.data) {
      return args;
    }

    if (Array.isArray(args.data)) {
      return {
        ...args,
        data: args.data.map((item: Record<string, unknown>) => ({
          ...item,
          familyId: item.familyId ?? familyId,
        })),
      };
    }

    return {
      ...args,
      data: {
        ...(args.data as Record<string, unknown>),
        familyId: (args.data as Record<string, unknown>).familyId ?? familyId,
      },
    };
  }
}
