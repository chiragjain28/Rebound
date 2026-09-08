import './globals.css'
import { AuthProvider } from '../contexts/AuthContext'

export const metadata = {
  title: 'Rebound ERP - Gen-Z Gaming Lounge & Cafe Management',
  description: 'Billiards Lounge & Gaming Cafe Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#0a0d14] text-slate-100 font-sans antialiased min-h-screen selection:bg-cyan-500 selection:text-black">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

