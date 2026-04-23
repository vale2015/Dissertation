import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export const metadata = {
  title: "RFS-Restaurant Forecasting System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
