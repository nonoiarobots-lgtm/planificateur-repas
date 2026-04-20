import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
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
      "dejeuner": {"plat": "Nom du plat", "recette_id": "slug_unique"},
      "diner": {"plat": "Nom du plat", "recette_id": "slug_unique"}
    }
  },
  "liste_courses": {
    "Marché / Primeur": [{"nom":"...","quantite":"...","unite":"..."}],
    "Poissonnerie": [{"nom":"...","quantite":"...","unite":"..."}],
    "Boucher": [{"nom":"...","quantite":"...","unite":"..."}],
    "Supermarché": [{"nom":"...","quantite":"...","unite":"..."}]
  },
  "recette_index": { "slug_unique": "Nom complet du plat" }
}
N'inclus que les dates listées. Quantités pour ${persons} personnes.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = message.content[0].text
    const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(clean)

    // Récupérer la famille via user_id
    const { data: familyData } = await supabase
      .from('families')
      .select('id')
      .eq('adults', family.adults)
      .single()

    // Créer le planning
    const { data: planning } = await supabase
      .from('plannings')
      .insert({ family_id: familyData.id, start_date: startDate })
      .select()
      .single()

    // Créer la liste de courses
    await supabase
      .from('shopping_lists')
      .insert({ planning_id: planning.id, items: result.liste_courses, needs_refresh: false })

    // Créer les recettes et les slots
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
            service: service
          })
      }
    }

    return Response.json({ planningId: planning.id })

  } catch (err) {
    console.error('Erreur generate-menu:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}