import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jinko ESS · Grid Ledger — Policy & Market Intelligence",
  description: "Jinko ESS 电力政策与市场动态看板：人工审核发布的全球政策与市场机制情报",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
