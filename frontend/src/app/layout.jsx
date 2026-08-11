import "./globals.css";
// Metadata used by Next.js for the browser tab title.
export const metadata = {
  title: "RFS-Restaurant Forecasting System",
};
// Root layout applied to every page in the application.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
