import "./globals.css";

export const metadata = {
  title: "Viceconsulado Honorario de España — Porlamar",
  description: "Panel de administración — Viceconsulado Honorario de España en Nueva Esparta",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
