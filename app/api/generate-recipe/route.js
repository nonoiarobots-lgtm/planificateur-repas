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

    if (recipe.steps) return Response.json({ steps: recipe.steps })

    const ingredientsList = (recipe.recipe_ingredients || [])
      .map(i => `- ${i.quantity} ${i.unit} ${i.name}`)
      .join('\n')

    const prompt = `Tu es un chef cuisinier. Génère les étapes de préparation détaillées pour cette recette.

Recette : ${recipe.name}
Portions : ${recipe.portions} personnes${recipe.prep_time ? `\nTemps de préparation : ${recipe.prep_time}` : ''}${recipe.cook_time ? `\nTemps de cuisson : ${recipe.cook_time}` : ''}${recipe.tip ? `\nConseil : ${recipe.tip}` : ''}

Ingrédients :
${ingredientsList || '(non renseignés)'}

Retourne UNIQUEMENT un JSON valide, sans texte avant ni après, avec ce format :
{
  "steps": [
    {"numero": 1, "instruction": "..."},
    {"numero": 2, "instruction": "..."}
  ]
}

Entre 6 et 10 étapes. Instructions claires, précises, adaptées à un cuisinier amateur.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = message.content[0].text
    const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(clean)

    await supabaseAdmin
      .from('recipes')
      .update({ steps: result.steps })
      .eq('id', recipeId)

    return Response.json({ steps: result.steps })

  } catch (err) {
    console.error('Erreur generate-recipe:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
