import { createClient } from '@supabase/supabase-js'
import { generateStructured } from '@/lib/claude'
import { RECIPE_DETAILS_SCHEMA } from '@/lib/schemas'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

// Génère et enregistre les étapes, temps et conseil d'une recette (appelé dans after())
export async function generateStepsForRecipe(recipe) {
  try {
    const prompt = `Tu es un chef cuisinier expert. Génère les étapes de préparation détaillées pour cette recette.

Recette : ${recipe.name}
Portions : ${recipe.portions} personnes

INSTRUCTIONS DE QUALITÉ :
- Base-toi sur des techniques culinaires classiques françaises et éprouvées
- Sois précis sur les températures (°C), les temps de cuisson et les gestes techniques
- Si tu mentionnes une température de four, indique aussi le thermostat (ex: 200°C / th.6-7)
- Les étapes doivent être dans l'ordre chronologique strict
- Évite les approximations — donne des indicateurs précis (couleur, texture, temps)
- Adapte les quantités exactement aux ${recipe.portions} portions

Entre 6 et 10 étapes. prep_time et cook_time en format court (ex: "20 min", "1h").
tip : conseil du chef en une phrase.
search_query : nom simple en français sans majuscules superflues, optimisé pour Marmiton (ex: "poulet rôti aux herbes").`

    const result = await generateStructured({
      prompt,
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
    return true

  } catch (err) {
    console.error(`Erreur génération steps pour ${recipe.name}:`, err.message)
    return false
  }
}
