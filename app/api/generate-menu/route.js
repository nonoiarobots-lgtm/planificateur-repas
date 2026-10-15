import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'
import { generateStructured, GenerationError } from '@/lib/claude'
import { MENU_SCHEMA, RECIPE_DETAILS_SCHEMA } from '@/lib/schemas'
import { CHEF_SYSTEM, buildChefPrompt } from '@/lib/prompts/chef'

// Laisse le temps à la génération (menu, puis étapes des recettes en arrière-plan)
export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

async function generateStepsForRecipe(recipe) {
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

const HISTORY_DAYS = 28

// Plats servis à la famille sur les 4 semaines précédant startDate (pour varier les menus).
// Si une semaine a été générée plusieurs fois, seul le dernier menu de chaque repas compte.
async function loadHistory(familyId, startDate) {
  const from = new Date(startDate)
  from.setDate(from.getDate() - HISTORY_DAYS)
  const { data, error } = await supabase
    .from('planning_slots')
    .select('slot_date, service, recipes(name), plannings!inner(family_id, generated_at)')
    .eq('plannings.family_id', familyId)
    .gte('slot_date', from.toISOString().slice(0, 10))
    .lt('slot_date', startDate)
  if (error) {
    console.error('Historique indisponible :', error.message)
    return []
  }

  const latest = new Map()
  for (const slot of data) {
    if (!slot.recipes?.name) continue
    const key = `${slot.slot_date}|${slot.service}`
    const current = latest.get(key)
    if (!current || slot.plannings.generated_at > current.plannings.generated_at) latest.set(key, slot)
  }

  const counts = new Map()
  for (const slot of latest.values()) {
    counts.set(slot.recipes.name, (counts.get(slot.recipes.name) || 0) + 1)
  }
  return [...counts].map(([plat, fois]) => ({ plat, fois }))
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_PLAN_LINES = 2000
const MAX_WEEK_CONSTRAINTS = 1000

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
  const { planLines, startDate, weekConstraints } = body

  if (typeof startDate !== 'string' || !ISO_DATE.test(startDate) || isNaN(new Date(startDate))) {
    return Response.json({ error: 'Date de début invalide' }, { status: 400 })
  }
  if (typeof planLines !== 'string' || !planLines.trim() || planLines.length > MAX_PLAN_LINES) {
    return Response.json({ error: 'Liste des repas invalide' }, { status: 400 })
  }
  if (weekConstraints != null && (typeof weekConstraints !== 'string' || weekConstraints.length > MAX_WEEK_CONSTRAINTS)) {
    return Response.json({ error: `Contraintes de la semaine trop longues (${MAX_WEEK_CONSTRAINTS} caractères max)` }, { status: 400 })
  }

  // La famille est relue en base à partir de l'utilisateur connecté
  const { data: family } = await supabase
    .from('families')
    .select('id, adults, children, children_ages, constraints, cuisines, preferences')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!family) return Response.json({ error: 'Profil famille introuvable : complétez votre profil.' }, { status: 404 })

  // Recettes dont les étapes seront générées une fois la réponse envoyée.
  // after() garde la fonction en vie (Vercel) jusqu'à la fin de ce travail.
  const recipesToGenerate = []
  after(async () => {
    console.log(`[generate-menu] étapes : ${recipesToGenerate.length} recette(s) à compléter`)
    if (recipesToGenerate.length === 0) return
    const t0 = Date.now()
    const results = await Promise.all(recipesToGenerate.map(r => generateStepsForRecipe(r)))
    const ok = results.filter(Boolean).length
    console.log(`[generate-menu] étapes : ${ok}/${results.length} enregistrées en ${Math.round((Date.now() - t0) / 1000)} s`)
  })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        const persons = family.adults + family.children
        const history = await loadHistory(family.id, startDate)
        const prompt = buildChefPrompt({ family, planLines, startDate, weekConstraints, history })

        const result = await generateStructured({
          system: CHEF_SYSTEM,
          prompt,
          schema: MENU_SCHEMA,
          maxTokens: 32000,
          effort: 'medium',
          onText: (text) => send({ type: 'progress', text }),
        })

        // Ne garder que les repas demandés, sans doublon
        const requestedDates = new Set([...planLines.matchAll(/\((\d{4}-\d{2}-\d{2})\)/g)].map(m => m[1]))
        const seen = new Set()
        const meals = result.repas.filter(m => {
          const key = `${m.date}|${m.service}`
          if (!requestedDates.has(m.date) || seen.has(key)) return false
          seen.add(key)
          return true
        })
        if (!meals.length) throw new GenerationError("Le menu généré ne correspond à aucun des jours demandés. Réessayez.")

        const { data: planning, error: planningError } = await supabase
          .from('plannings')
          .insert({ family_id: family.id, start_date: startDate })
          .select()
          .single()
        if (planningError) throw new Error('Enregistrement du planning impossible')

        await supabase
          .from('shopping_lists')
          .insert({ planning_id: planning.id, items: result.liste_courses, needs_refresh: false })

        // Sauvegarder toutes les recettes + slots

        for (const meal of meals) {
          const { data: recipe } = await supabase
            .from('recipes')
            .upsert({
              family_id: family.id,
              slug: meal.recette_id,
              name: meal.plat,
              portions: persons
            }, { onConflict: 'family_id,slug' })
            .select()
            .single()

          await supabase
            .from('planning_slots')
            .insert({
              planning_id: planning.id,
              recipe_id: recipe?.id || null,
              slot_date: meal.date,
              service: meal.service,
              emoji_unicode: meal.emoji_unicode || null
            })

          // Ne générer les steps que si pas encore générés
          if (recipe?.id && !recipe.steps) {
            recipesToGenerate.push(recipe)
          }
        }

        // Envoyer done immédiatement — le client navigue sans attendre les steps,
        // générés ensuite par le callback after() ci-dessus
        send({ type: 'done', planningId: planning.id })

      } catch (err) {
        console.error('Erreur generate-menu:', err)
        const message = err instanceof GenerationError ? err.message : 'La génération du menu a échoué. Réessayez.'
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
