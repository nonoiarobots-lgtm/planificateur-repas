import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  try {
    const supabaseServer = await createSupabaseServer()
    const { data: { user } } = await supabaseServer.auth.getUser()
    if (!user) return Response.json({ error: 'Non authentifié' }, { status: 401 })

    const { recipeId } = await request.json()

    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .eq('id', recipeId)
      .single()

    if (!recipe) return Response.json({ error: 'Recette introuvable' }, { status: 404 })

    const { data: family } = await supabaseAdmin
      .from('families')
      .select('id, user_id')
      .eq('id', recipe.family_id)
      .single()

    if (!family || family.user_id !== user.id) {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    if (recipe.steps) return Response.json({ steps: recipe.steps, search_query: recipe.search_query })

    const ingredientsList = (recipe.recipe_ingredients || [])
      .map(i => `- ${i.quantity} ${i.unit} ${i.name}`)
      .join('\n')

    const prompt = `Tu es un chef cuisinier expert. Génère les étapes de préparation détaillées pour cette recette.

Recette : ${recipe.name}
Portions : ${recipe.portions} personnes${recipe.prep_time ? `\nTemps de préparation : ${recipe.prep_time}` : ''}${recipe.cook_time ? `\nTemps de cuisson : ${recipe.cook_time}` : ''}${recipe.tip ? `\nConseil : ${recipe.tip}` : ''}

Ingrédients :
${ingredientsList || '(non renseignés)'}

INSTRUCTIONS DE QUALITÉ :
- Base-toi sur des techniques culinaires classiques françaises et éprouvées
- Sois précis sur les températures (°C), les temps de cuisson et les gestes techniques
- Si tu mentionnes une température de four, indique aussi le thermostat (ex: 200°C / th.6-7)
- Les étapes doivent être dans l'ordre chronologique strict
- Évite les approximations comme "cuire jusqu'à ce que ce soit cuit" — donne des indicateurs précis (couleur, texture, temps)
- Adapte les quantités exactement aux ${recipe.portions} portions indiquées

Retourne UNIQUEMENT un JSON valide, sans texte avant ni après, avec ce format :
{
  "steps": [
    {"numero": 1, "instruction": "..."},
    {"numero": 2, "instruction": "..."}
  ],
  "search_query": "nom du plat optimisé pour Marmiton"
}

Entre 6 et 10 étapes. Instructions claires, précises, adaptées à un cuisinier amateur.
Pour search_query : nom du plat en français, simple et direct, sans majuscules superflues, sans "maison" ni "façon" (ex: "poulet rôti aux herbes", "blanquette de veau").`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = message.content[0].text
    const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(clean)

    await supabaseAdmin
      .from('recipes')
      .update({ steps: result.steps, search_query: result.search_query || null })
      .eq('id', recipeId)

    return Response.json({ steps: result.steps, search_query: result.search_query })

  } catch (err) {
    console.error('Erreur generate-recipe:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
