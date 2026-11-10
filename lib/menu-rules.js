// Règles de simplicité des plats, partagées par le Chef, le contrôle serveur et le Relecteur

export const MAX_ALIMENTS = 5
export const MAX_PREPARATION = 15 // minutes de préparation active
export const MAX_CUISSON = 30 // minutes de cuisson

// Ne comptent pas dans les 5 aliments
export const CONDIMENTS = 'sel, poivre, huile, beurre, vinaigre, moutarde, épices, herbes, ail, oignon, échalote, bouillon'

/**
 * Options choisies à la création du menu.
 * - format : 'plat' (plat seul + fruit en dessert) ou 'complet' (entrée, plat, dessert)
 * - weekendElabore : plats mijotés ou plus techniques autorisés le samedi et le dimanche
 */
export function normalizeOptions(raw) {
  return {
    format: raw?.format === 'complet' ? 'complet' : 'plat',
    weekendElabore: raw?.weekendElabore === true,
  }
}

export function isWeekend(date) {
  const day = new Date(`${date}T12:00:00`).getDay()
  return day === 0 || day === 6
}

// Les limites de temps s'appliquent-elles à ce repas ?
export function timeLimitsApply(date, options) {
  return !(options.weekendElabore && isWeekend(date))
}

export function countAliments(meal) {
  return (meal.ingredients || []).filter(i => !i.condiment).length
}

// Problèmes d'un repas au regard des règles (liste vide si tout va bien)
export function mealProblems(meal, options) {
  const problems = []
  const aliments = countAliments(meal)
  if (aliments > MAX_ALIMENTS) problems.push(`${aliments} aliments hors condiments (${MAX_ALIMENTS} maximum)`)
  if (timeLimitsApply(meal.date, options)) {
    if (meal.temps_preparation > MAX_PREPARATION) problems.push(`${meal.temps_preparation} min de préparation (${MAX_PREPARATION} maximum)`)
    if (meal.temps_cuisson > MAX_CUISSON) problems.push(`${meal.temps_cuisson} min de cuisson (${MAX_CUISSON} maximum)`)
  }
  if (!meal.dessert?.trim()) problems.push('pas de dessert')
  if (options.format === 'complet' && !meal.entree?.trim()) problems.push("pas d'entrée alors que le menu complet est demandé")
  return problems
}

// Le plat seul n'a pas d'entrée, quoi que le modèle ait renvoyé
export function applyFormat(meal, options) {
  return options.format === 'plat' ? { ...meal, entree: '' } : meal
}
