import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://radar-de-leads-locais.leadsbr.workers.dev"),
  title: { default: "ALEGON | Radar de Leads Locais", template: "%s | ALEGON" },
  description: "ALEGON: plataforma de prospecção local, geração de sites e cardápios digitais. Acesso mediante cadastro e aprovação.",
  applicationName: "Radar de Leads Locais ALEGON",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className="antialiased">{children}</body></html>;
}
