import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout/layout-shell";
import { UserProvider } from "@/context/user-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IBANK — Gestão Financeira",
  description: "Gerencie seu cartão de crédito e investimentos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <UserProvider>
          <LayoutShell>{children}</LayoutShell>
        </UserProvider>
      </body>
    </html>
  );
}
