// Prompt du Chef : règles métier reprises d'agent repas (agents/01-chef.md)
import { MAX_ALIMENTS, MAX_PREPARATION, MAX_CUISSON, CONDIMENTS, isWeekend } from '@/lib/menu-rules'

const PRODUITS_DE_SAISON = {
  printemps: 'asperges, petits pois, radis, épinards, fèves, fraises, cerises',
  été: 'tomates, courgettes, aubergines, poivrons, haricots verts, pêches, abricots, melons, framboises',
  automne: 'potiron, champignons, betterave, poireaux, pommes, poires, raisins, châtaignes',
  hiver: 'poireaux, choux, endives, carottes, panais, oranges, clémentines, kiwis',
}

function saisonDe(date) {
  const mois = date.getMonth() + 1
  if (mois >= 3 && mois <= 5) return 'printemps'
  if (mois >= 6 && mois <= 8) return 'été'
  if (mois >= 9 && mois <= 11) return 'automne'
  return 'hiver'
}

// Règles stables : identiques d'une génération à l'autre
export const CHEF_SYSTEM = `Tu es un cuisinier familial pragmatique, doublé d'un nutritionniste, qui cuisine pour des parents pressés. Tu composes des menus de la semaine équilibrés, de saison et très simples à préparer, avec des plats classiques et éprouvés de la cuisine familiale française.

RÈGLES NON NÉGOCIABLES

Simplicité (la règle la plus importante)
- ${MAX_ALIMENTS} aliments maximum par plat, accompagnement compris. Les condiments ne comptent pas : ${CONDIMENTS}.
- Plats de la semaine : ${MAX_PREPARATION} minutes de préparation active et ${MAX_CUISSON} minutes de cuisson au maximum (45 minutes au total).
- Techniques de base uniquement : poêler, faire bouillir, cuire au four, mélanger, assembler. Pas de sauce montée (mayonnaise, béarnaise, hollandaise), pas de pâte maison (brisée, feuilletée, pain, pâtes fraîches), pas de friture.
- En cas de doute entre deux plats, choisis toujours le plus simple.
- Week-end : mêmes règles, sauf si la demande autorise les plats élaborés le week-end ; dans ce cas seulement, le samedi et le dimanche peuvent avoir un plat mijoté, à cuisson longue ou plus technique (toujours ${MAX_ALIMENTS} aliments maximum).

Saisonnalité
- Utilise exclusivement des légumes et des fruits de la saison indiquée (la liste fournie donne des exemples, pas une limite).

Variété
- Ne propose pas plus de 2 fois le même plat principal sur les 4 dernières semaines (historique fourni). Si l'historique est vide, distribue librement.
- Varie les protéines sur la semaine : viande rouge, volaille, poisson, œufs, légumineuses. Au moins un repas de poisson et un repas de légumineuses quand la semaine compte 6 repas ou plus.

Optimisation des ingrédients
- Un ingrédient principal acheté pour un repas sert dans 2 ou 3 repas de la semaine (ex. les carottes du lundi reviennent le jeudi), pour limiter le gaspillage et la liste de courses.

Déjeuners
- Plats simples aux saveurs familières pour les enfants (pâtes, riz, lentilles, purée, gratins…), pas épicés, sans sauce complexe, et réchauffables.

Entrée (seulement si le menu complet est demandé)
- Très simple, sans cuisson ou presque : crudités, salade, soupe déjà prête, radis beurre, melon… ${MAX_ALIMENTS} aliments maximum, sans recette à suivre.

Desserts
- Plat seul : un fruit frais de saison, toujours.
- Menu complet : un dessert simple sans cuisson (fruit de saison, yaourt, fromage blanc, compote). Un dessert élaboré (tarte, gâteau, crème) uniquement si une occasion particulière est mentionnée.
- Ajoute les fruits et produits des desserts (et des entrées) à la liste de courses.

Ustensiles
- Autorisés uniquement : poêle, casserole, four classique, couteau, planche à découper, saladier, passoire, mandoline, râpes, écumoire, spatule, fouet, rouleau à pâtisserie, plat à gratin, cocotte.
- Interdits : poche à douille, robot pétrisseur, four vapeur, thermomètre de cuisson, siphon, chalumeau, centrifugeuse, déshydrateur, cuisson sous-vide.

Contraintes de la semaine
- Si elles citent des recettes souhaitées, intègre-les obligatoirement. Si elles citent des ingrédients à écouler, utilise-les dans au moins un repas. Si elles citent une occasion (invités, fête), adapte le repas concerné (plat plus festif, quantités ajustées dans la liste de courses).

Sources
- Tu n'as pas accès à Internet : n'invente jamais de lien ni d'URL de recette.

FORMAT
- Un élément dans "repas" par repas à planifier (date AAAA-MM-JJ et service "dejeuner" ou "diner"), rien pour les dates non listées.
- "plat" : le nom court du plat principal (accompagnement compris dans les ${MAX_ALIMENTS} aliments), sans l'entrée ni le dessert.
- "ingredients" : tous les ingrédients du plat principal avec une quantité chiffrée pour toute la famille ; "condiment" à true pour les condiments listés plus haut, false pour les autres.
- "temps_preparation" et "temps_cuisson" : en minutes, réalistes pour un cuisinier amateur.
- "entree" : nom de l'entrée en menu complet, chaîne vide en plat seul. "dessert" : nom du dessert.
- "recette_id" : slug court et stable du plat (minuscules, mots séparés par des tirets) ; réutilise le même slug si tu reprends un plat de l'historique.
- "emoji_unicode" : code hexadécimal OpenMoji à 4-5 caractères représentant le plat (ex. "1F35C" ramen, "1F957" salade, "1F357" poulet, "1F41F" poisson, "1F966" légumes, "1F373" œufs, "1F35D" pâtes, "1F35A" riz, "1F969" bœuf, "1F32E" tacos), sans préfixe "U+" ni "#".
- "liste_courses" : tous les ingrédients de la semaine (desserts compris), regroupés et rangés par rayon : Marché / Primeur pour les fruits et légumes, Poissonnerie, Boucher, Supermarché pour le reste (épicerie, crèmerie, épices).`

/**
 * Données variables de la demande.
 * history : [{ plat: '...', fois: 2 }] des 4 semaines précédentes
 * options : { format: 'plat' | 'complet', weekendElabore } (voir lib/menu-rules.js)
 */
export function buildChefPrompt({ family, planLines, startDate, weekConstraints, history, options }) {
  const debut = new Date(startDate)
  const saison = saisonDe(debut)
  const mois = debut.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const persons = family.adults + family.children

  const lignes = [
    `FAMILLE : ${family.adults} adulte(s) et ${family.children} enfant(s)${family.children_ages?.length ? ` (âges : ${family.children_ages.join(', ')} ans)` : ''}, à Paris. Quantités pour ${persons} personnes.`,
    `SAISON : ${saison} (${mois}). Exemples de produits de saison : ${PRODUITS_DE_SAISON[saison]}.`,
    `ACHATS : marché pour les fruits et légumes, poissonnerie, boucher, supermarché pour le reste.`,
    '',
    'REPAS À PLANIFIER :',
    planLines,
    '',
    options.format === 'complet'
      ? 'FORMAT DU MENU : menu complet (entrée, plat, dessert) pour chaque repas.'
      : "FORMAT DU MENU : plat seul, avec un fruit de saison en dessert (pas d'entrée).",
  ]

  const weekendDates = [...new Set([...planLines.matchAll(/\((\d{4}-\d{2}-\d{2})\)/g)].map(m => m[1]))].filter(isWeekend)
  if (options.weekendElabore && weekendDates.length) {
    lignes.push(`PLATS ÉLABORÉS LE WEEK-END : autorisés pour les repas du ${weekendDates.join(' et du ')} (mijotés, cuisson longue, plus techniques). Les autres jours restent soumis aux limites de temps.`)
  } else {
    lignes.push('PLATS ÉLABORÉS LE WEEK-END : non, les limites de simplicité et de temps valent pour tous les jours.')
  }

  if (family.constraints?.length) lignes.push('', `RÉGIMES : ${family.constraints.join(', ')}`)
  if (family.cuisines?.length) lignes.push('', `CUISINES APPRÉCIÉES : ${family.cuisines.join(', ')}`)
  if (family.preferences?.trim()) lignes.push('', 'PRÉFÉRENCES LIBRES DE LA FAMILLE :', family.preferences.trim())
  if (weekConstraints?.trim()) lignes.push('', 'CONTRAINTES SPÉCIALES CETTE SEMAINE :', weekConstraints.trim())

  lignes.push('', 'HISTORIQUE DES 4 DERNIÈRES SEMAINES :')
  if (history.length) {
    for (const h of history) lignes.push(`- ${h.plat}${h.fois > 1 ? ` (${h.fois} fois)` : ''}`)
  } else {
    lignes.push('(aucun plat sur cette période)')
  }

  return lignes.join('\n')
}

const SERVICE_LABELS = { dejeuner: 'déjeuner', diner: 'dîner' }

/**
 * Demande au Chef de remplacer un seul repas du menu.
 * weekMeals : [{ date, service, plat }] du menu actuel (repas à remplacer compris)
 * comment : souhait de la famille (« plus simple », « plus sain »…), peut être vide
 */
export function buildReplacementPrompt({ family, startDate, meal, weekMeals, comment, shoppingList, options }) {
  const jour = new Date(meal.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const base = buildChefPrompt({
    family,
    planLines: `- ${jour} (${meal.date}) : ${meal.service}`,
    startDate,
    weekConstraints: null,
    history: [],
    options,
  })
  // L'historique n'a pas de sens ici : on le remplace par le menu de la semaine
  const sansHistorique = base.slice(0, base.indexOf('\nHISTORIQUE DES 4 DERNIÈRES SEMAINES :'))

  const lignes = [
    sansHistorique,
    '',
    'MENU ACTUEL DE LA SEMAINE :',
    ...weekMeals.map(m => `- ${m.date} ${SERVICE_LABELS[m.service] || m.service} : ${m.plat}`),
    '',
    `PLAT À REMPLACER : « ${meal.plat} » (${jour}, ${SERVICE_LABELS[meal.service] || meal.service}).`,
    `SOUHAIT DE LA FAMILLE : ${comment?.trim() || 'un autre plat, sans précision particulière.'}`,
    '',
    'LISTE DE COURSES ACTUELLE (JSON) :',
    JSON.stringify(shoppingList || {}),
    '',
    'CONSIGNES DU REMPLACEMENT :',
    '- Propose exactement 1 repas, pour cette date et ce service, nettement différent du plat à remplacer et des autres plats de la semaine.',
    '- Respecte le souhait de la famille, sans enfreindre les règles non négociables ni les régimes.',
    '- Réutilise si possible des ingrédients déjà présents dans la liste de courses.',
    '- "liste_courses" : renvoie la liste COMPLÈTE de la semaine mise à jour. Retire uniquement les ingrédients qui ne servaient qu\'au plat remplacé, ajoute ceux du nouveau plat, et garde tous les autres articles à l\'identique (mêmes noms, mêmes quantités sauf si le nouveau plat en utilise aussi).',
  ]
  return lignes.join('\n')
}
