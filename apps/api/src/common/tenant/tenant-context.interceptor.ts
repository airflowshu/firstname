import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { runWithTenantContext } from './tenant-context';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const tenantContext = {
      familyId: user?.activeFamilyId ?? null,
      bypassFamilyScope: user?.platformRole === PlatformRole.SUPER && !user.activeFamilyId,
    };

    return new Observable((subscriber) =>
      runWithTenantContext(tenantContext, () => next.handle().subscribe(subscriber)),
    );
  }
}
