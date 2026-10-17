import type { Metadata } from "next";
import "./globals.css";

const chunkRecovery = `(()=>{const key="ems_chunk_reload";const recover=(value)=>{const message=String(value?.message||value?.reason?.message||value?.reason||value||"");if(!/ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module/i.test(message))return;if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1");const url=new URL(location.href);url.searchParams.set("_app_refresh",Date.now().toString());location.replace(url.toString());};window.addEventListener("error",event=>recover(event.error||event.message));window.addEventListener("unhandledrejection",event=>recover(event));window.setTimeout(()=>sessionStorage.removeItem(key),8000);})();`;

export const metadata: Metadata = {
  title: "نظام إدارة عمليات الإسعاف والطوارئ",
  description: "إدخال بلاغات الإسعاف ومتابعة المؤشرات وإصدار التقارير",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: chunkRecovery }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
