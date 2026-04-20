import { Baloo_2, Nunito } from 'next/font/google'
import './globals.css'

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
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${baloo.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  )
}
