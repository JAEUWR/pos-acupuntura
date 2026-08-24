import './globals.css'
import { LanguageProvider } from '../context/LanguageContext';

export const metadata = {
  title: 'Acupuntura HK - POS',
  description: 'Sistema Administrativo y Clínico',
}

export default function RootLayout({ children }) {
  return (
    // ESTOS DOS SUPPRESSHYDRATIONWARNING SON LA CURA DEFINITIVA
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}