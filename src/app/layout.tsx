import type { Metadata, Viewport } from "next";
import { TimeGradientProvider } from "@/components/time-gradient-provider";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ideamemo — 声で種を蒔く。つながりが芽を出す。",
  description: "音声メモ → AI構造化 → 意外な繋がり発見。アイデアが育つ個人思考ツール。",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400&family=Noto+Sans+JP:wght@400;500&family=Noto+Serif+JP:wght@300;400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <TimeGradientProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </TimeGradientProvider>
      </body>
    </html>
  );
}
