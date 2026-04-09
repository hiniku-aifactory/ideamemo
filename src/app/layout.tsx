import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { RecordingProvider } from "@/components/recording-context";
import { TabBar } from "@/components/tab-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "ideamemo",
  description: "声で気づきを貯める。AIが外の知識と紐づける。",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FAFAFA",
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
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <RecordingProvider>
          <AuthProvider>
            {children}
            <TabBar />
          </AuthProvider>
        </RecordingProvider>
      </body>
    </html>
  );
}
