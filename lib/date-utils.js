/**
 * Convertit une Date JS en chaîne ISO date locale (YYYY-MM-DD).
 * Évite le bug de décalage UTC de toISOString() en France.
 */
export function toLocalISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
