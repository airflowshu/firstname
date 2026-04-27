import { AntdRegistry } from '@ant-design/nextjs-registry';
import type { Metadata } from 'next';
import { Noto_Sans_SC } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const notoSansSc = Noto_Sans_SC({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '中国家族姓氏血亲管理系统',
  description: '用于维护家族成员、血缘图谱与亲戚称呼的后台系统',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={notoSansSc.variable}>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
