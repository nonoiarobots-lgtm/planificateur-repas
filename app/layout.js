import { Baloo_2, Nunito } from 'next/font/google'
import './globals.css'
import Header from './components/Header'

const baloo = Baloo_2({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-baloo',
  display: 'swap',
})

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
})

export const metadata = {
  title: 'FamiliMeals — Planificateur de repas famille',
  description: "Planifiez vos repas en famille avec l'IA",
  // Nom et style sur l'écran d'accueil de l'iPhone (l'icône vient de app/apple-icon.png)
  appleWebApp: {
    capable: true,
    title: 'FamiliMeals',
    statusBarStyle: 'default',
  },
}

export const viewport = {
  themeColor: '#4CAF7D',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${baloo.variable} ${nunito.variable}`}>
      <body>
        <Header />
        {children}
      </body>
    </html>
  )
}
