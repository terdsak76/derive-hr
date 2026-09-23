import type { Metadata } from 'next';
import { Prompt } from 'next/font/google';
import './globals.css';

// Using Google Prompt font for optimal Thai & English legibility
const promptFont = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-prompt',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DeRIVE HR - ระบบบริหารจัดการทรัพยากรบุคคล',
  description: 'ระบบบันทึก ขาด ลา การเดินทาง Onsite พร้อมการจัดการข้อมูล SQLite',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={promptFont.variable}>
      <body className="font-sans antialiased bg-slate-900 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}