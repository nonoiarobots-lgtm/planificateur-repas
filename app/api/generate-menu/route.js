import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        const { family, planLines, startDate } = await request.json()

        const persons = family.adults + family.children
        const mois = new Date(startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

        const prompt = `Tu es un nutritionniste et chef cuisinier expert. Génère un plan repas pour ${family.adults} adultes et ${family.children} enfants à Paris.

REPAS À PLANIFIER :
${planLines}

CONTRAINTES : saison ${mois}, marché pour légumes/fruits, poissonnerie, boucher, supermarché pour épices. Repas équilibrés, peu sucrés, peu gras.${family.constraints?.length ? '\nRégimes : ' + family.constraints.join(', ') : ''}${family.cuisines?.length ? '\nCuisines : ' + family.cuisines.join(', ') : ''}${family.preferences?.trim() ? '\n\nPRÉFÉRENCES LIBRES DE LA FAMILLE :\n' + family.preferences.trim() : ''}

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
          .eq('adults', family.adults)
          .single()

        const { data: planning } = await supabase
          .from('plannings')
          .insert({ family_id: familyData.id, start_date: startDate })
          .select()
          .single()

        await supabase
          .from('shopping_lists')
          .insert({ planning_id: planning.id, items: result.liste_courses, needs_refresh: false })

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
          }
        }

        send({ type: 'done', planningId: planning.id })

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
