import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeployDoctor",
  description: "Turn failed Vercel deployments into evidence-backed incident reports."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
