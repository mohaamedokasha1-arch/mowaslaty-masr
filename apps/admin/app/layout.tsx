import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'لوحة التحكم | مواصلاتي مصر',
    template: '%s | لوحة تحكم مواصلاتي مصر',
  },
  description: 'لوحة تحكم إدارة بيانات مواصلات مصر: الخطوط، المحطات، البلاغات، وسجل التغييرات.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
