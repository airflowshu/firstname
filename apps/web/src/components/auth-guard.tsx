'use client';

import { Result, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './auth-provider';

export function AuthGuard({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const router = useRouter();
  const { initialized, token, isAdmin } = useAuth();

  useEffect(() => {
    if (initialized && !token) {
      router.replace('/login');
    }
  }, [initialized, router, token]);

  if (!initialized || !token) {
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

  return <>{children}</>;
}
