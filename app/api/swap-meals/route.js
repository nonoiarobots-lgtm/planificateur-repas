import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Tout ce qui constitue le repas change de créneau ; la date et le service restent attachés au créneau
const MEAL_FIELDS = ['recipe_id', 'emoji_unicode', 'entree', 'dessert', 'validated_items']

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
  const { slotA, slotB } = body
  if (![slotA, slotB].every(s => typeof s === 'string' && UUID.test(s)) || slotA === slotB) {
    return Response.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const { data: family } = await supabase
    .from('families')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!family) return Response.json({ error: 'Profil famille introuvable' }, { status: 404 })

  const { data: slots } = await supabase
    .from('planning_slots')
    .select(`id, planning_id, slot_date, service, ${MEAL_FIELDS.join(', ')}, plannings(family_id, review)`)
    .in('id', [slotA, slotB])
  const a = slots?.find(s => s.id === slotA)
  const b = slots?.find(s => s.id === slotB)
  // Même réponse si un repas n'existe pas ou appartient à une autre famille
  if (!a || !b || a.planning_id !== b.planning_id || a.plannings?.family_id !== family.id) {
    return Response.json({ error: 'Repas introuvable' }, { status: 404 })
  }
  if (!a.recipe_id && !b.recipe_id) {
    return Response.json({ error: 'Aucun repas à déplacer' }, { status: 400 })
  }

  const pick = s => Object.fromEntries(MEAL_FIELDS.map(k => [k, s[k] ?? (k === 'validated_items' ? {} : null)]))
  const { error: errA } = await supabase.from('planning_slots').update(pick(b)).eq('id', a.id)
  if (errA) {
    console.error('[swap-meals]', errA.message)
    return Response.json({ error: "L'échange a échoué. Réessayez." }, { status: 500 })
  }
  const { error: errB } = await supabase.from('planning_slots').update(pick(a)).eq('id', b.id)
  if (errB) {
    console.error('[swap-meals]', errB.message)
    await supabase.from('planning_slots').update(pick(a)).eq('id', a.id)
    return Response.json({ error: "L'échange a échoué. Réessayez." }, { status: 500 })
  }

  // Les pastilles du relecteur sont rangées par date et service : elles suivent leur repas
  let review = a.plannings.review
  if (review?.repas) {
    const isA = r => r.date === a.slot_date && r.service === a.service
    const isB = r => r.date === b.slot_date && r.service === b.service
    review = {
      ...review,
      repas: review.repas.map(r => isA(r) ? { ...r, date: b.slot_date, service: b.service }
        : isB(r) ? { ...r, date: a.slot_date, service: a.service } : r),
    }
    const { error } = await supabase.from('plannings').update({ review }).eq('id', a.planning_id)
    if (error) console.error('[swap-meals] avis non mis à jour :', error.message)
  }

  return Response.json({ review })
}
