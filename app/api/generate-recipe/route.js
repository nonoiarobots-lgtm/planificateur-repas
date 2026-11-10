import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'
import { GenerationError } from '@/lib/claude'
import { generateStepsForRecipe } from '@/lib/recipe-steps'

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
      .select('*')
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

    const result = await generateStepsForRecipe(recipe)
    if (!result) throw new GenerationError('La génération de la recette a échoué. Réessayez.')

    return Response.json({ steps: result.steps, search_query: result.search_query })

  } catch (err) {
    console.error('Erreur generate-recipe:', err)
    const message = err instanceof GenerationError ? err.message : 'La génération de la recette a échoué. Réessayez.'
    return Response.json({ error: message }, { status: 500 })
  }
}
