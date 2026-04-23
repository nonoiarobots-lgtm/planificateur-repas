import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

Retourne UNIQUEMENT un JSON valide, sans texte avant ni après :
{
  "steps": [{"numero": 1, "instruction": "..."}, ...],
  "prep_time": "15 min",
  "cook_time": "30 min",
  "tip": "conseil du chef en une phrase",
  "search_query": "nom du plat optimisé pour Marmiton"
}

Entre 6 et 10 étapes. prep_time et cook_time en format court (ex: "20 min", "1h").
search_query : nom simple en français sans majuscules superflues (ex: "poulet rôti aux herbes").`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = message.content[0].text
    const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(clean)

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

export async function POST(request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        const { family, planLines, startDate, weekConstraints } = await request.json()

        const persons = family.adults + family.children
        const mois = new Date(startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

        const prompt = `Tu es un nutritionniste et chef cuisinier expert. Génère un plan repas pour ${family.adults} adultes et ${family.children} enfants à Paris.

REPAS À PLANIFIER :
${planLines}

CONTRAINTES : saison ${mois}, marché pour légumes/fruits, poissonnerie, boucher, supermarché pour épices. Repas équilibrés, peu sucrés, peu gras.${family.constraints?.length ? '\nRégimes : ' + family.constraints.join(', ') : ''}${family.cuisines?.length ? '\nCuisines : ' + family.cuisines.join(', ') : ''}${family.preferences?.trim() ? '\n\nPRÉFÉRENCES LIBRES DE LA FAMILLE :\n' + family.preferences.trim() : ''}${weekConstraints?.trim() ? '\n\nCONTRAINTES SPÉCIALES CETTE SEMAINE :\n' + weekConstraints.trim() : ''}

RÉPONDS UNIQUEMENT EN JSON VALIDE SANS BACKTICKS NI MARKDOWN :
{
  "menu": {
    "2026-04-19": {
      "dejeuner": {"plat": "Nom du plat", "recette_id": "slug_unique", "emoji_unicode": "1F35C"},
      "diner": {"plat": "Nom du plat", "recette_id": "slug_unique", "emoji_unicode": "1F957"}
    }
  },
  "liste_courses": {
    "Marché / Primeur": [{"nom":"...","quantite":"...","unite":"..."}],
    "Poissonnerie": [{"nom":"...","quantite":"...","unite":"..."}],
    "Boucher": [{"nom":"...","quantite":"...","unite":"..."}],
    "Supermarché": [{"nom":"...","quantite":"...","unite":"..."}]
  }
}
N'inclus que les dates listées. Quantités pour ${persons} personnes.
Pour emoji_unicode : code hexadécimal OpenMoji à 4-5 caractères représentant le plat (ex: "1F35C" ramen, "1F957" salade, "1F357" poulet, "1F41F" poisson, "1F966" légumes, "1F373" oeufs, "1F35D" pâtes, "1F35A" riz, "1F969" boeuf, "1F32E" tacos). Sans préfixe "U+" ni "#".`

        let fullText = ''
        const aiStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 3600,
          messages: [{ role: 'user', content: prompt }]
        })

        aiStream.on('text', (text) => {
          fullText += text
          send({ type: 'progress', text })
        })

        await aiStream.finalMessage()

        const clean = fullText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        const result = JSON.parse(clean)

        const { data: familyData } = await supabase
          .from('families')
          .select('id')
          .eq('user_id', family.user_id)
          .single()

        const { data: planning } = await supabase
          .from('plannings')
          .insert({ family_id: familyData.id, start_date: startDate })
          .select()
          .single()

        await supabase
          .from('shopping_lists')
          .insert({ planning_id: planning.id, items: result.liste_courses, needs_refresh: false })

        // Sauvegarder toutes les recettes + slots
        const recipesToGenerate = []

        for (const [dateStr, services] of Object.entries(result.menu)) {
          for (const [service, data] of Object.entries(services)) {
            const { data: recipe } = await supabase
              .from('recipes')
              .upsert({
                family_id: familyData.id,
                slug: data.recette_id,
                name: data.plat,
                portions: persons
              }, { onConflict: 'family_id,slug' })
              .select()
              .single()

            await supabase
              .from('planning_slots')
              .insert({
                planning_id: planning.id,
                recipe_id: recipe?.id || null,
                slot_date: dateStr,
                service: service,
                emoji_unicode: data.emoji_unicode || null
              })

            // Ne générer les steps que si pas encore générés
            if (recipe?.id && !recipe.steps) {
              recipesToGenerate.push(recipe)
            }
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
        send({ type: 'error', message: err.message })
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
