import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ITEMS = ['entree', 'plat', 'dessert']

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
  const { slotId, item, checked } = body
  if (typeof slotId !== 'string' || !UUID.test(slotId) || !ITEMS.includes(item) || typeof checked !== 'boolean') {
    return Response.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const { data: family } = await supabase
    .from('families')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!family) return Response.json({ error: 'Profil famille introuvable' }, { status: 404 })

  const { data: slot } = await supabase
    .from('planning_slots')
    .select('id, validated_items, plannings(family_id)')
    .eq('id', slotId)
    .maybeSingle()
  // Même réponse si le repas n'existe pas ou appartient à une autre famille
  if (!slot || slot.plannings?.family_id !== family.id) {
    return Response.json({ error: 'Repas introuvable' }, { status: 404 })
  }

  const validated_items = { ...(slot.validated_items || {}), [item]: checked }
  const { error } = await supabase
    .from('planning_slots')
    .update({ validated_items })
    .eq('id', slot.id)
  if (error) {
    console.error('[validate-meal]', error.message)
    return Response.json({ error: "La validation n'a pas pu être enregistrée." }, { status: 500 })
  }

  return Response.json({ validated_items })
}
