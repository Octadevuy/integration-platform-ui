import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";

import { AuthProvider } from "@/components/providers/auth-provider";
import { BrandToggle } from "@/components/brand-toggle";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EnLaMano - Operaciones",
  description:
    "Administración de integraciones, API keys, usuarios y consultas de deudores para BCU API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('bcu-brand')==='legacy'){document.documentElement.setAttribute('data-brand','legacy')}}catch(e){}",
          }}
        />
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
        <BrandToggle />
      </body>
    </html>
  );
}
