import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MEET // NEURAL INTERFACE — AI / ML Engineer & Builder",
  description:
    "Meet — AI/ML Engineer & Builder. An interactive neural-network portfolio: AI trading systems, machine learning, and applied research.",
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='14' fill='%2300E5FF'/%3E%3Ccircle cx='50' cy='50' r='30' fill='none' stroke='%238A2BFF' stroke-width='3'/%3E%3C/svg%3E",
  },
  openGraph: {
    title: "MEET // NEURAL INTERFACE",
    description:
      "I don't just write code. I build intelligence. — Interactive portfolio of Meet, AI/ML Engineer & Builder.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
