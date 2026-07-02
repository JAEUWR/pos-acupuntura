import './globals.css'

export const metadata = {
  title: 'Acupuntura HK - POS',
  description: 'Punto de venta multisede',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      {/* Agregamos suppressHydrationWarning aquí abajo */}
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  )
}