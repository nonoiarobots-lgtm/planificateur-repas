import { createClient } from '@supabase/supabase-js'
import { generateStructured } from '@/lib/claude'
import { RECIPE_DETAILS_SCHEMA } from '@/lib/schemas'
import { MAX_ALIMENTS, MAX_PREPARATION, MAX_CUISSON, CONDIMENTS } from '@/lib/menu-rules'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function formatQuantity(i) {
  return [i.quantity, i.unit, i.name].filter(v => v != null && v !== '').join(' ')
}

// Enregistre les ingrédients prévus par le Chef pour une recette (remplace les anciens)
export async function saveIngredients(recipeId, ingredients) {
  if (!ingredients?.length) return
  await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)
  const rows = ingredients.map(i => ({
    recipe_id: recipeId,
    name: i.nom,
    quantity: Number.isFinite(i.quantite) && i.quantite > 0 ? i.quantite : null,
    unit: i.unite || null,
  }))
  const { error } = await supabase.from('recipe_ingredients').insert(rows)
  if (error) console.error(`Ingrédients non enregistrés pour la recette ${recipeId} :`, error.message)
}

function buildStepsPrompt(recipe, ingredients) {
  const ingredientLines = ingredients.length
    ? ['Ingrédients prévus :', ...ingredients.map(i => `- ${formatQuantity(i)}`), '',
      "N'utilise que ces ingrédients, plus si besoin sel, poivre, huile ou beurre. N'ajoute aucun autre ingrédient."]
    : [`Ingrédients : choisis-en ${MAX_ALIMENTS} au maximum hors condiments (${CONDIMENTS}).`]

  const timeLines = recipe.prep_time || recipe.cook_time
    ? [`Temps prévus : préparation ${recipe.prep_time || 'non précisée'}, cuisson ${recipe.cook_time || 'non précisée'}. Respecte-les.`]
    : [`Temps : ${MAX_PREPARATION} minutes de préparation active et ${MAX_CUISSON} minutes de cuisson au maximum.`]

  return [
    "Tu es un cuisinier familial qui explique une recette à quelqu'un de pressé, sans formation culinaire.",
    '',
    `Recette : ${recipe.name}`,
    `Portions : ${recipe.portions} personnes`,
    '',
    ...ingredientLines,
    ...timeLines,
    '',
    'CONSIGNES :',
    '- Entre 3 et 6 étapes, dans l\'ordre ; une seule action par étape, en une ou deux phrases courtes.',
    '- Mots de tous les jours, aucun geste technique de chef. Techniques de base : poêler, faire bouillir, cuire au four, mélanger.',
    '- Pour le four, indique la température et le thermostat (ex. 200 °C / th. 6-7).',
    '- Donne un repère simple pour savoir quand c\'est prêt (couleur, texture, temps).',
    '- Quantités adaptées aux portions indiquées.',
    '',
    'prep_time et cook_time en format court (ex. "10 min", "25 min").',
    'tip : une astuce pratique pour gagner du temps, en une phrase.',
    'search_query : nom du plat en français, simple et direct, sans majuscules superflues, sans "maison" ni "façon" (ex. "poulet rôti aux herbes").',
  ].join('\n')
}

/**
 * Rédige et enregistre les étapes, temps et astuce d'une recette.
 * Utilisée en arrière-plan après un menu ou un remplacement, et à l'ouverture d'une recette.
 * Renvoie le résultat, ou null en cas d'échec.
 */
export async function generateStepsForRecipe(recipe) {
  try {
    const { data: ingredients } = await supabase
      .from('recipe_ingredients')
      .select('name, quantity, unit')
      .eq('recipe_id', recipe.id)

    const result = await generateStructured({
      prompt: buildStepsPrompt(recipe, ingredients || []),
      schema: RECIPE_DETAILS_SCHEMA,
      maxTokens: 8000,
      effort: 'low',
    })

    const { error } = await supabase
      .from('recipes')
      .update({
        steps: result.steps,
        prep_time: result.prep_time || null,
        cook_time: result.cook_time || null,
        tip: result.tip || null,
        search_query: result.search_query || null,
      })
      .eq('id', recipe.id)
    if (error) throw new Error(`enregistrement impossible : ${error.message}`)
    return result

  } catch (err) {
    console.error(`Erreur génération steps pour ${recipe.name}:`, err.message)
    return null
  }
}
