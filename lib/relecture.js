import { generateStructured } from '@/lib/claude'
import { MENU_SCHEMA, REVIEW_SCHEMA } from '@/lib/schemas'
import { CHEF_SYSTEM } from '@/lib/prompts/chef'
import { RELECTEUR_SYSTEM, buildRelecteurPrompt, buildRevisionPrompt } from '@/lib/prompts/relecteur'

const key = (m) => `${m.date}|${m.service}`

/**
 * Fait relire le menu, puis fait réécrire par le Chef les seuls repas en rouge
 * (une seule révision). En cas d'échec, renvoie le menu d'origine : la relecture
 * améliore le menu mais ne doit jamais empêcher la famille d'en avoir un.
 */
export async function reviewAndRevise({ family, chefPrompt, meals, shoppingList }) {
  const t0 = Date.now()
  try {
    const review = await generateStructured({
      system: RELECTEUR_SYSTEM,
      prompt: buildRelecteurPrompt({ family, meals, shoppingList }),
      schema: REVIEW_SCHEMA,
      maxTokens: 16000,
      effort: 'medium',
    })

    const requested = new Set(meals.map(key))
    const redKeys = new Set(
      review.repas
        .filter(r => requested.has(key(r)) && (r.feu_nutrition === 'rouge' || r.feu_faisabilite === 'rouge'))
        .map(key)
    )
    const reviewSeconds = Math.round((Date.now() - t0) / 1000)

    if (redKeys.size === 0) {
      console.log(`[relecture] semaine ${review.feu_semaine}, aucun repas rouge (${reviewSeconds} s)`)
      return { meals, shoppingList, review, replaced: 0 }
    }

    const revision = await generateStructured({
      system: CHEF_SYSTEM,
      prompt: buildRevisionPrompt({ chefPrompt, meals, shoppingList, review, redKeys }),
      schema: MENU_SCHEMA,
      maxTokens: 32000,
      effort: 'medium',
    })

    // Ne remplacer que les repas demandés, une seule fois chacun
    const replacements = new Map()
    for (const m of revision.repas) {
      if (redKeys.has(key(m)) && !replacements.has(key(m))) replacements.set(key(m), m)
    }
    const revisedMeals = meals.map(m => replacements.get(key(m)) || m)

    // L'avis porte sur le plat d'origine : on signale ceux qui ont été remplacés
    const annotatedReview = {
      ...review,
      repas: review.repas.map(r => replacements.has(key(r)) ? { ...r, remplace: true } : r),
    }

    console.log(`[relecture] semaine ${review.feu_semaine}, ${redKeys.size} repas rouge(s), ${replacements.size} remplacé(s) en ${Math.round((Date.now() - t0) / 1000)} s (relecture ${reviewSeconds} s)`)
    return { meals: revisedMeals, shoppingList: revision.liste_courses, review: annotatedReview, replaced: replacements.size }
  } catch (err) {
    console.error(`[relecture] ignorée après ${Math.round((Date.now() - t0) / 1000)} s :`, err.message)
    return { meals, shoppingList, review: null, replaced: 0 }
  }
}
