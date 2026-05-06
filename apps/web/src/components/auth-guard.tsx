'use client';

import { Result, Spin } from 'antd';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './auth-provider';

export function AuthGuard({
  children,
  requireAdmin = false,
  requireSuper = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireSuper?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { initialized, token, isAdmin, isSuper, user } = useAuth();
  const hasOptimisticSession = !initialized && Boolean(token);
  const superNeedsTenantSelection = isSuper && !user?.activeFamilyId && pathname !== '/platform';

  useEffect(() => {
    if (initialized && !token) {
      const redirectTarget = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
    }
  }, [initialized, pathname, router, searchParams, token]);

  useEffect(() => {
    if (initialized && token && superNeedsTenantSelection) {
      router.replace('/platform');
    }
  }, [initialized, router, superNeedsTenantSelection, token]);

  if (!initialized && !hasOptimisticSession) {
    return (
      <div className="page-center">
        <Spin size="large" />
      </div>
    );
  }

  if (initialized && !token) {
    return (
      <div className="page-center">
        <Spin size="large" />
      </div>
    );
  }

  if (initialized && token && superNeedsTenantSelection) {
    return (
      <div className="page-center">
        <Spin size="large" />
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <Result
        status="403"
        title="仅管理员可访问"
        subTitle="当前账号仅有查看权限，请联系管理员开通维护权限。"
      />
    );
  }

  if (requireSuper && !isSuper) {
    return <Result status="403" title="仅超级管理员可访问" subTitle="当前账号没有平台管理权限。" />;
  }

  return <>{children}</>;
}
