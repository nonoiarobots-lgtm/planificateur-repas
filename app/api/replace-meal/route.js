import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'
import { generateStructured, GenerationError } from '@/lib/claude'
import { MENU_SCHEMA } from '@/lib/schemas'
import { CHEF_SYSTEM, buildReplacementPrompt } from '@/lib/prompts/chef'
import { generateStepsForRecipe, saveIngredients } from '@/lib/recipe-steps'
import { normalizeOptions, applyFormat, mealProblems } from '@/lib/menu-rules'

// Laisse le temps au remplacement, puis aux étapes de la recette en arrière-plan
export const maxDuration = 120

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_COMMENT = 300

export async function POST(request) {
  // Identifier l'utilisateur par sa session (cookies), jamais par un id envoyé par le navigateur
  const supabaseServer = await createSupabaseServer()
  const { data: { user } } = await supabaseServer.auth.getUser()
  if (!user) return Response.json({ error: 'Non authentifié' }, { status: 401 })

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Requête invalide' }, { status: 400 })
  }
  const { slotId, comment } = body
  if (typeof slotId !== 'string' || !UUID.test(slotId)) {
    return Response.json({ error: 'Repas invalide' }, { status: 400 })
  }
  if (comment != null && (typeof comment !== 'string' || comment.length > MAX_COMMENT)) {
    return Response.json({ error: `Commentaire trop long (${MAX_COMMENT} caractères max)` }, { status: 400 })
  }

  const { data: family } = await supabase
    .from('families')
    .select('id, adults, children, children_ages, constraints, cuisines, preferences')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!family) return Response.json({ error: 'Profil famille introuvable' }, { status: 404 })

  const { data: slot } = await supabase
    .from('planning_slots')
    .select('id, slot_date, service, planning_id, recipes(name), plannings(id, family_id, start_date, review, options, shopping_lists(id, items))')
    .eq('id', slotId)
    .maybeSingle()
  // Même réponse si le repas n'existe pas ou appartient à une autre famille
  if (!slot || slot.plannings?.family_id !== family.id) {
    return Response.json({ error: 'Repas introuvable' }, { status: 404 })
  }
  if (!slot.recipes?.name) return Response.json({ error: 'Aucun plat à remplacer sur ce créneau' }, { status: 400 })

  try {
    const t0 = Date.now()
    const planning = slot.plannings
    const shoppingList = planning.shopping_lists
    // Choix faits à la création du menu (anciens menus : plat seul, sans plats élaborés)
    const options = normalizeOptions(planning.options)

    const { data: weekSlots } = await supabase
      .from('planning_slots')
      .select('slot_date, service, recipes(name)')
      .eq('planning_id', planning.id)
      .order('slot_date')
    const weekMeals = (weekSlots || [])
      .filter(s => s.recipes?.name)
      .map(s => ({ date: s.slot_date, service: s.service, plat: s.recipes.name }))

    const meal = { date: slot.slot_date, service: slot.service, plat: slot.recipes.name }
    const basePrompt = buildReplacementPrompt({
      family,
      startDate: planning.start_date,
      meal,
      weekMeals,
      comment,
      shoppingList: shoppingList?.items,
      options,
    })

    // Une seconde tentative si le plat proposé ne respecte pas les règles de simplicité
    let result, newMeal, problems = []
    for (let attempt = 0; attempt < 2; attempt++) {
      result = await generateStructured({
        system: CHEF_SYSTEM,
        prompt: problems.length
          ? `${basePrompt}\n\nTA PROPOSITION PRÉCÉDENTE « ${newMeal.plat} » NE CONVIENT PAS : ${problems.join(', ')}. Propose un plat plus simple.`
          : basePrompt,
        schema: MENU_SCHEMA,
        maxTokens: 16000,
        effort: 'medium',
      })
      const found = result.repas.find(m => m.date === meal.date && m.service === meal.service) || result.repas[0]
      if (!found) throw new GenerationError("Le chef n'a pas proposé de plat. Réessayez.")
      newMeal = applyFormat({ ...found, date: meal.date, service: meal.service }, options)
      problems = mealProblems(newMeal, options)
      if (!problems.length) break
    }
    if (problems.length) console.log(`[replace-meal] plat gardé malgré : ${problems.join(', ')}`)

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .upsert({
        family_id: family.id,
        slug: newMeal.recette_id,
        name: newMeal.plat,
        portions: family.adults + family.children,
      }, { onConflict: 'family_id,slug' })
      .select()
      .single()
    if (recipeError) throw new Error(`recette : ${recipeError.message}`)

    const emoji = newMeal.emoji_unicode || null
    const { error: slotError } = await supabase
      .from('planning_slots')
      .update({
        recipe_id: recipe.id,
        emoji_unicode: emoji,
        entree: newMeal.entree?.trim() || null,
        dessert: newMeal.dessert?.trim() || null,
      })
      .eq('id', slot.id)
    if (slotError) throw new Error(`créneau : ${slotError.message}`)

    if (shoppingList?.id) {
      const { error } = await supabase
        .from('shopping_lists')
        .update({ items: result.liste_courses })
        .eq('id', shoppingList.id)
      if (error) console.error('[replace-meal] liste de courses non mise à jour :', error.message)
    }

    // L'avis du relecteur portait sur l'ancien plat : on retire sa pastille
    let review = planning.review
    if (review?.repas) {
      review = { ...review, repas: review.repas.filter(r => !(r.date === meal.date && r.service === meal.service)) }
      const { error } = await supabase.from('plannings').update({ review }).eq('id', planning.id)
      if (error) console.error('[replace-meal] avis non mis à jour :', error.message)
    }

    if (!recipe.steps) {
      recipe.prep_time = `${newMeal.temps_preparation} min`
      recipe.cook_time = `${newMeal.temps_cuisson} min`
      await supabase.from('recipes').update({ prep_time: recipe.prep_time, cook_time: recipe.cook_time }).eq('id', recipe.id)
      await saveIngredients(recipe.id, newMeal.ingredients)
      after(() => generateStepsForRecipe(recipe))
    }

    console.log(`[replace-meal] « ${meal.plat} » → « ${recipe.name} » en ${Math.round((Date.now() - t0) / 1000)} s`)
    return Response.json({
      recipe: { id: recipe.id, name: recipe.name },
      emoji_unicode: emoji,
      entree: newMeal.entree?.trim() || null,
      dessert: newMeal.dessert?.trim() || null,
      items: shoppingList?.id ? result.liste_courses : null,
      review,
    })
  } catch (err) {
    console.error('Erreur replace-meal:', err)
    const message = err instanceof GenerationError ? err.message : 'Le remplacement du plat a échoué. Réessayez.'
    return Response.json({ error: message }, { status: 500 })
  }
}
