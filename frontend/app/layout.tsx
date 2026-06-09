import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets:  ["latin"],
  variable: "--font-inter",
  display:  "swap",
});

export const metadata: Metadata = {
  title:       "Neural Ink — EMNIST Digit Recogniser",
  description:
    "Draw any digit (0–9) and watch a convolutional neural network identify it in real time. Powered by PyTorch, FastAPI, and Next.js.",
  keywords: [
    "digit recognition", "EMNIST", "PyTorch", "machine learning",
    "neural network", "computer vision", "AI demo",
  ],
  authors: [{ name: "Manideepsai" }],
  openGraph: {
    title:       "Neural Ink — EMNIST Digit Recogniser",
    description: "Draw a digit, get an instant AI prediction.",
    type:        "website",
  },
};

export const viewport: Viewport = {
  width:            "device-width",
  initialScale:     1,
  maximumScale:     1, // Prevent pinch-zoom interfering with canvas drawing
  themeColor:       "#ffffff",
  colorScheme:      "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white text-[#1f2328] antialiased">
        {children}
      </body>
    </html>
  );
}
