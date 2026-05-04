import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeployDoctor",
  description: "Paste Vercel deployment logs and get a clear mocked diagnosis."
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
