import { generateStructured } from '@/lib/claude'
import { MENU_SCHEMA, REVIEW_SCHEMA } from '@/lib/schemas'
import { CHEF_SYSTEM } from '@/lib/prompts/chef'
import { RELECTEUR_SYSTEM, buildRelecteurPrompt, buildRevisionPrompt } from '@/lib/prompts/relecteur'
import { mealProblems, applyFormat } from '@/lib/menu-rules'

const key = (m) => `${m.date}|${m.service}`

/**
 * Fait relire le menu, puis fait réécrire par le Chef (une seule révision) les repas
 * en rouge et ceux qui ne respectent pas les règles de simplicité (contrôle du serveur).
 * En cas d'échec, renvoie le menu tel quel : la relecture améliore le menu mais ne doit
 * jamais empêcher la famille d'en avoir un.
 */
export async function reviewAndRevise({ family, chefPrompt, meals, shoppingList, options }) {
  const t0 = Date.now()

  let review = null
  try {
    review = await generateStructured({
      system: RELECTEUR_SYSTEM,
      prompt: buildRelecteurPrompt({ family, meals, shoppingList, options }),
      schema: REVIEW_SCHEMA,
      maxTokens: 16000,
      effort: 'medium',
    })
  } catch (err) {
    console.error(`[relecture] avis indisponible après ${Math.round((Date.now() - t0) / 1000)} s :`, err.message)
  }
  const reviewSeconds = Math.round((Date.now() - t0) / 1000)

  // Repas à corriger : rouges du Relecteur + règles non respectées
  const requested = new Set(meals.map(key))
  const problems = new Map()
  for (const r of review?.repas || []) {
    if (requested.has(key(r)) && (r.feu_nutrition === 'rouge' || r.feu_faisabilite === 'rouge')) {
      problems.set(key(r), `${r.raison}${r.suggestion ? ` Suggestion : ${r.suggestion}` : ''}`)
    }
  }
  let ruleCount = 0
  for (const m of meals) {
    const found = mealProblems(m, options)
    if (!found.length) continue
    ruleCount++
    const text = `Règles de simplicité non respectées : ${found.join(', ')}.`
    problems.set(key(m), problems.has(key(m)) ? `${problems.get(key(m))} ${text}` : text)
  }

  const feu = review?.feu_semaine || 'sans avis'
  if (problems.size === 0) {
    console.log(`[relecture] semaine ${feu}, aucun repas à corriger (${reviewSeconds} s)`)
    return { meals, shoppingList, review, replaced: 0 }
  }

  try {
    const revision = await generateStructured({
      system: CHEF_SYSTEM,
      prompt: buildRevisionPrompt({ chefPrompt, meals, shoppingList, problems, synthese: review?.synthese }),
      schema: MENU_SCHEMA,
      maxTokens: 32000,
      effort: 'medium',
    })

    // Ne remplacer que les repas demandés, une seule fois chacun
    const replacements = new Map()
    for (const m of revision.repas) {
      if (problems.has(key(m)) && !replacements.has(key(m))) replacements.set(key(m), applyFormat(m, options))
    }
    const revisedMeals = meals.map(m => replacements.get(key(m)) || m)
    const stillWrong = revisedMeals.filter(m => mealProblems(m, options).length).length

    // L'avis porte sur le plat d'origine : on signale ceux qui ont été remplacés
    const annotatedReview = review && {
      ...review,
      repas: review.repas.map(r => replacements.has(key(r)) ? { ...r, remplace: true } : r),
    }

    console.log(`[relecture] semaine ${feu}, ${problems.size} repas à corriger (dont ${ruleCount} hors règles), ${replacements.size} remplacé(s), ${stillWrong} encore hors règles, en ${Math.round((Date.now() - t0) / 1000)} s (relecture ${reviewSeconds} s)`)
    return { meals: revisedMeals, shoppingList: revision.liste_courses, review: annotatedReview, replaced: replacements.size }
  } catch (err) {
    console.error(`[relecture] révision ignorée après ${Math.round((Date.now() - t0) / 1000)} s :`, err.message)
    return { meals, shoppingList, review, replaced: 0 }
  }
}
