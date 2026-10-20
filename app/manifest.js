// Manifeste : permet d'ajouter FamiliMeals à l'écran d'accueil du téléphone
// avec sa propre icône et une ouverture en plein écran
export default function manifest() {
  return {
    name: 'FamiliMeals',
    short_name: 'FamiliMeals',
    description: "Planifiez vos repas en famille avec l'IA",
    lang: 'fr',
    start_url: '/planning',
    display: 'standalone',
    background_color: '#FDF8F0',
    theme_color: '#4CAF7D',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
