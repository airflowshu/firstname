'use client';

import '@ant-design/v5-patch-for-react-19';
import zhCN from 'antd/locale/zh_CN';
import { App as AntdApp, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { useState } from 'react';
import { AuthProvider } from './auth-provider';

dayjs.locale('zh-cn');

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 15_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#7b1f1f',
            colorInfo: '#7b1f1f',
            borderRadius: 12,
            colorBgLayout: '#f5efe4',
            colorBgContainer: '#fffaf3',
            colorTextBase: '#3f2b1f',
            colorBorder: '#d9c6aa',
          },
        }}
      >
        <AntdApp>
          <AuthProvider>{children}</AuthProvider>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
