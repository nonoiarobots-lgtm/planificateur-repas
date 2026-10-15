import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'
import { generateStructured, GenerationError } from '@/lib/claude'
import { MENU_SCHEMA, RECIPE_DETAILS_SCHEMA } from '@/lib/schemas'

// Laisse le temps à la génération (réflexion + 14 repas + courses)
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

    await supabase
      .from('recipes')
      .update({
        steps: result.steps,
        prep_time: result.prep_time || null,
        cook_time: result.cook_time || null,
        tip: result.tip || null,
        search_query: result.search_query || null,
      })
      .eq('id', recipe.id)

  } catch (err) {
    console.error(`Erreur génération steps pour ${recipe.name}:`, err.message)
  }
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
    .select('id, adults, children, constraints, cuisines, preferences')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!family) return Response.json({ error: 'Profil famille introuvable : complétez votre profil.' }, { status: 404 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        const persons = family.adults + family.children
        const mois = new Date(startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

        const prompt = `Tu es un nutritionniste et chef cuisinier expert. Génère un plan repas pour ${family.adults} adultes et ${family.children} enfants à Paris.

REPAS À PLANIFIER :
${planLines}

CONTRAINTES : saison ${mois}, marché pour légumes/fruits, poissonnerie, boucher, supermarché pour épices. Repas équilibrés, peu sucrés, peu gras.${family.constraints?.length ? '\nRégimes : ' + family.constraints.join(', ') : ''}${family.cuisines?.length ? '\nCuisines : ' + family.cuisines.join(', ') : ''}${family.preferences?.trim() ? '\n\nPRÉFÉRENCES LIBRES DE LA FAMILLE :\n' + family.preferences.trim() : ''}${weekConstraints?.trim() ? '\n\nCONTRAINTES SPÉCIALES CETTE SEMAINE :\n' + weekConstraints.trim() : ''}

FORMAT : un élément dans "repas" par repas à planifier (date AAAA-MM-JJ et service "dejeuner" ou "diner"), et la liste de courses de toute la semaine rangée par rayon.
N'inclus que les dates listées. Quantités pour ${persons} personnes.
emoji_unicode : code hexadécimal OpenMoji à 4-5 caractères représentant le plat (ex: "1F35C" ramen, "1F957" salade, "1F357" poulet, "1F41F" poisson, "1F966" légumes, "1F373" oeufs, "1F35D" pâtes, "1F35A" riz, "1F969" boeuf, "1F32E" tacos). Sans préfixe "U+" ni "#".`

        const result = await generateStructured({
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
        const recipesToGenerate = []

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

        // Envoyer done immédiatement — le client navigue sans attendre les steps
        send({ type: 'done', planningId: planning.id })

        // Générer les steps en arrière-plan (fire & forget)
        if (recipesToGenerate.length > 0) {
          Promise.all(recipesToGenerate.map(r => generateStepsForRecipe(r)))
            .catch(err => console.error('Background step generation error:', err))
        }

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
