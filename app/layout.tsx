import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MasterAI Pro — Studio-grade audio mastering",
  description:
    "Masteriza tu música en el navegador. Análisis espectral, cadena DSP profesional, medición LUFS y exportación lista para streaming.",
  applicationName: "MasterAI Pro",
};

export const viewport: Viewport = {
  themeColor: "#07080b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
