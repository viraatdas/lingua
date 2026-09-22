import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Shell } from "@/components/Shell";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const ui = Instrument_Sans({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lingua",
  description: "Speak Spanish and Mandarin out loud, every day. Live conversations, spaced repetition, pronunciation feedback.",
  applicationName: "Lingua",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
