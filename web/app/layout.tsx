import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '科研工作台',
  description: '轻量、清晰的科研灵感与资料工作台',
  openGraph: {
    title: '科研工作台',
    description: '灵感 · 便利贴 · 标签 · 截图',
    images: [{ url: '/og.png', width: 1680, height: 945, alt: '科研工作台' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '科研工作台',
    description: '灵感 · 便利贴 · 标签 · 截图',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
