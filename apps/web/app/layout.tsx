import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sistema Integral SVB", template: "%s · Sistema Integral SVB" },
  description: "Plataforma integral de Vincular Business: infraestructura, contratos, CRM, caja, RRHH, CMS y portal de clientes.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#07090D", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className="dark">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
