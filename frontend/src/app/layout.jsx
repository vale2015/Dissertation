import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
// Load the Inter font and expose it as a CSS variable.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
// Load the Montserrat font and expose it as a CSS variable.
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});
// Metadata used by Next.js for the browser tab title.
export const metadata = {
  title: "RFS-Restaurant Forecasting System",
};
// Root layout applied to every page in the application.
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
