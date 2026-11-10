// Prompt du Relecteur : repris d'agent repas (agents/05-relecteur.md), adapté à
// FamiliMeals où le menu contient le nom des plats, leurs aliments, leurs temps et la liste de courses.
import { MAX_ALIMENTS, MAX_PREPARATION, MAX_CUISSON, CONDIMENTS, countAliments, timeLimitsApply } from '@/lib/menu-rules'

export const RELECTEUR_SYSTEM = `Tu relis le menu de la semaine d'une famille avec trois casquettes à la fois :
- diététicienne : l'équilibre de chaque repas ;
- nutritionniste : l'équilibre de la semaine entière ;
- ménagère : la faisabilité réelle (temps de préparation, ingrédients, ustensiles).

Tu ne réécris pas les menus : tu les évalues et tu dis quoi corriger. Tu es bienveillant, concret et bref.

FEUX : "vert", "orange" ou "rouge".

Axe 1 — Nutrition d'un repas (feu_nutrition)
- vert : protéines + féculents ou légumineuses + légumes, lipides raisonnables.
- orange : un excès ou un manque compensable ; propose une substitution simple (crème → yaourt, beurre → huile d'olive, lardons → jambon blanc, pain blanc → complet).
- rouge : aucune protéine ; aucun légume ; friture + sauce grasse + fromage cumulés ; trop sucré ; viande rouge plus de 3 fois dans la semaine ; pour un déjeuner, plat épicé ou inadapté aux enfants.

Axe 2 — Faisabilité d'un repas (feu_faisabilite)
- vert : ${MAX_ALIMENTS} aliments maximum hors condiments (${CONDIMENTS}), ${MAX_PREPARATION} min de préparation et ${MAX_CUISSON} min de cuisson au maximum, techniques de base, ingrédients de supermarché ou de marché, ustensiles autorisés.
- orange : un ingrédient de rayon spécialisé, une technique un peu avancée.
- rouge : plus de ${MAX_ALIMENTS} aliments hors condiments ; plus de ${MAX_PREPARATION} min de préparation ou de ${MAX_CUISSON} min de cuisson (sauf repas marqué « week-end élaboré autorisé ») ; sauce montée, pâte maison ou friture ; ustensile interdit (écris le mot « interdit ») ; ingrédient introuvable ; technique professionnelle.
Ustensiles autorisés : poêle, casserole, four classique, couteau, planche à découper, saladier, passoire, mandoline, râpes, écumoire, spatule, fouet, rouleau à pâtisserie, plat à gratin, cocotte.
Ustensiles interdits : poche à douille, robot pétrisseur, four vapeur, thermomètre de cuisson, siphon, chalumeau, centrifugeuse, déshydrateur, cuisson sous-vide.

Axe 3 — La semaine (feu_semaine, synthese)
- vert : au moins 3 sources de protéines différentes, légumes à la majorité des repas, fruits plusieurs fois, pas d'excès répétés de sucre ou de graisses.
- orange : un ou deux apports limites mais compensés ailleurs.
- rouge : ni poisson ni légumineuses sur la semaine (pour 6 repas ou plus) ; viande rouge plus de 4 fois ; quasi-absence de légumes verts ; desserts élaborés répétés ; repas des enfants trop répétitifs.
- Si feu_semaine est rouge, mets aussi en rouge les repas qu'il faut changer pour corriger la semaine.
- synthese : 2 à 4 phrases sans jargon, qui soulignent aussi ce qui est réussi.

FORMAT
- Une entrée dans "repas" pour chaque repas reçu, avec la même date et le même service.
- raison : 1 à 2 phrases. suggestion : une action concrète, ou une chaîne vide si tout est vert.
- Style simple et non culpabilisant (« penser à ajouter » plutôt que « il manque »).`

export function buildRelecteurPrompt({ family, meals, shoppingList, options }) {
  const lignes = [
    `FAMILLE : ${family.adults} adulte(s) et ${family.children} enfant(s)${family.children_ages?.length ? ` (âges : ${family.children_ages.join(', ')} ans)` : ''}.`,
    `FORMAT : ${options.format === 'complet' ? 'menu complet (entrée, plat, dessert)' : 'plat seul avec un fruit en dessert'}.`,
  ]
  if (family.constraints?.length) lignes.push(`RÉGIMES : ${family.constraints.join(', ')}`)
  lignes.push('', 'MENU DE LA SEMAINE :')
  for (const m of meals) {
    const aliments = (m.ingredients || []).filter(i => !i.condiment).map(i => i.nom)
    lignes.push(`- ${m.date} ${m.service} : ${m.plat}${m.entree ? ` | entrée : ${m.entree}` : ''}${m.dessert ? ` | dessert : ${m.dessert}` : ''}`)
    lignes.push(`  ${countAliments(m)} aliment(s) hors condiments (${aliments.join(', ')}) ; préparation ${m.temps_preparation} min, cuisson ${m.temps_cuisson} min${timeLimitsApply(m.date, options) ? '' : ' ; week-end élaboré autorisé'}`)
  }
  lignes.push('', 'LISTE DE COURSES :')
  for (const [rayon, items] of Object.entries(shoppingList)) {
    if (items.length) lignes.push(`${rayon} : ${items.map(i => i.nom).join(', ')}`)
  }
  return lignes.join('\n')
}

// Demande au Chef de réécrire uniquement les repas à corriger.
// problems : Map 'date|service' → explication (avis du Relecteur et/ou règles non respectées)
export function buildRevisionPrompt({ chefPrompt, meals, shoppingList, problems, synthese }) {
  const lignes = [
    chefPrompt,
    '',
    'RÉVISION DEMANDÉE',
    'Le menu ci-dessous a été relu. Réécris UNIQUEMENT les repas listés dans « REPAS À REMPLACER », avec exactement la même date et le même service, en corrigeant chaque problème signalé et en respectant toutes les règles, en particulier la simplicité. Reste cohérent avec le reste du menu (variété des protéines, ingrédients partagés).',
    'Dans "repas", ne renvoie que les repas remplacés. Dans "liste_courses", renvoie la liste COMPLÈTE de la semaine, mise à jour pour le menu final.',
    '',
    'MENU ACTUEL :',
  ]
  for (const m of meals) lignes.push(`- ${m.date} ${m.service} : ${m.plat}`)
  lignes.push('', 'LISTE DE COURSES ACTUELLE :', JSON.stringify(shoppingList))
  lignes.push('', 'REPAS À REMPLACER :')
  for (const [key, text] of problems) {
    const [date, service] = key.split('|')
    lignes.push(`- ${date} ${service} : ${text}`)
  }
  if (synthese) lignes.push('', `AVIS SUR LA SEMAINE : ${synthese}`)
  return lignes.join('\n')
}
