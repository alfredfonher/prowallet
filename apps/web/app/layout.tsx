import type React from "react";
import type { Metadata, Viewport } from "next";
// NOTE: removed import from next/font/google to avoid build-time fetch
// of Google Fonts (fails in offline or restricted network). Use
// system font stack via Tailwind `font-sans` and/or local fonts.
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { WalletProvider } from "@/components/wallet-provider";
import { DebugPanel } from "@/components/debug-panel";
import { ServerSwitcher } from "@/components/dev/server-switcher";
import "./globals.css";

// const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ProWallet - Plataforma de Trading",
  description: "Compra, vende y transfiere tokens en la red de Solana",
  generator: "v0.app",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#9945FF" },
    { media: "(prefers-color-scheme: dark)", color: "#14F195" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <div id="modal-root"></div>
        <Toaster position="top-right" />
        <WalletProvider>
          <AuthProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem={false}
              disableTransitionOnChange
            >
              {children}
              <DebugPanel />
              <ServerSwitcher />
            </ThemeProvider>
          </AuthProvider>
        </WalletProvider>
        {!isDev && <Analytics />}
      </body>
    </html>
  );
}
