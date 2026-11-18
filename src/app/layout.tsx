import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Tipografías del prototipo: Atkinson Hyperlegible (lectura fácil, accesible) para el
// texto y Space Grotesk para títulos.
const bodyFont = Atkinson_Hyperlegible({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const headingFont = Space_Grotesk({
  variable: "--font-heading-src",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Paso de Lanchas", template: "%s · Paso de Lanchas" },
  description: "Paso de lanchas y transbordador Coatzacoalcos ⇄ Villa Allende",
  applicationName: "Paso de Lanchas",
};

export const viewport: Viewport = {
  themeColor: "#0B3C5D",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
