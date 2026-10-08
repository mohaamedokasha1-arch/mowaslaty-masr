import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://mowaslaty-masr.example.com'),
  title: {
    default: 'مواصلاتي مصر | دليل مواصلات مصر الشامل — خطوط، محطات، وأسعار',
    template: '%s | مواصلاتي مصر',
  },
  description:
    'منصة مواصلاتي مصر: خطط رحلتك بالأتوبيس والميكروباص والمترو والقطار في القاهرة والزقازيق والإسماعيلية. أسعار محدّثة، مواعيد التشغيل، وأفضل المسارات مع أقل تبديلات.',
  keywords: [
    'مواصلات مصر',
    'مواصلات الزقازيق',
    'مواصلات القاهرة',
    'ميكروباص',
    'أتوبيس',
    'مترو الأنفاق',
    'قطارات مصر',
    'تخطيط الرحلات',
  ],
  openGraph: {
    title: 'مواصلاتي مصر — المنصة الشاملة لمواصلات مصر',
    description:
      'خطط رحلتك في مصر: قارن بين الأسرع والأرخص وأقل تبديلات، مع أسعار ومواعيد محدّثة.',
    locale: 'ar_EG',
    type: 'website',
    siteName: 'مواصلاتي مصر',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="logo">
              <span className="logo-icon">🚌</span>
              <span>
                مواصلاتي مصر
                <small>MOWASLATY EGYPT</small>
              </span>
            </Link>
            <nav className="main-nav">
              <Link href="/">تخطيط رحلة</Link>
              <Link href="/routes">الخطوط</Link>
              <Link href="/cities">المدن</Link>
              <Link href="/report">بلاغ جديد</Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="container">
            <div>
              <strong>🚌 مواصلاتي مصر</strong>
              <p>
                منصة مجتمعية لمعلومات النقل العام في مصر — الأسعار والمواعيد استرشادية وقد
                تتغيّر، ساعدنا في تحديثها من خلال البلاغات.
              </p>
            </div>
            <div>
              <p>
                <Link href="/routes">تصفح الخطوط</Link> · <Link href="/report">أرسل بلاغًا</Link> ·{' '}
                <Link href="/cities">المدن المتاحة</Link>
              </p>
              <p style={{ opacity: 0.7 }}>© 2026 مواصلاتي مصر</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
