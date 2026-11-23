'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import BackButton from '@/app/components/BackButton'
import RecipeModal from '@/app/components/RecipeModal'
import ReplaceMealPanel from '@/app/components/ReplaceMealPanel'
import SwapMealSheet from '@/app/components/SwapMealSheet'

const SWAP_FIELDS = ['recipe_id', 'recipes', 'emoji_unicode', 'entree', 'dessert', 'validated_items']

const SHOP_BADGES = {
  'Marché / Primeur': { bg: 'var(--green-light)', color: 'var(--green-dark)', icon: '1F966' },
  'Poissonnerie':     { bg: 'var(--blue-light)',   color: 'var(--blue-dark)',   icon: '1F41F' },
  'Boucher':          { bg: 'var(--red-light)',    color: 'var(--red-dark)',    icon: '1F969' },
  'Supermarché':      { bg: 'var(--orange-light)', color: 'var(--orange-dark)', icon: '1F6D2' },
}

const EMPTY_ICONS = ['1F634', '1F37D', '1F373', '1F9D1-200D-1F373', '1F959']

// Avis du Relecteur : couleur et libellé de chaque feu
const FEUX = {
  vert:   { bg: 'var(--green-light)',  color: 'var(--green-dark)',  dot: 'var(--green)',  label: 'Validé' },
  orange: { bg: 'var(--orange-light)', color: 'var(--orange-dark)', dot: 'var(--orange)', label: 'À surveiller' },
  rouge:  { bg: 'var(--red-light)',    color: 'var(--red-dark)',    dot: 'var(--red)',    label: 'À revoir' },
}
const VALIDATION_LABELS = { entree: 'Entrée', plat: 'Plat', dessert: 'Dessert' }
const validationItems = slot => ['entree', 'plat', 'dessert'].filter(k => k === 'plat' || slot[k])
const isSlotValidated = slot => validationItems(slot).every(k => slot.validated_items?.[k])

const FEU_ORDER = ['vert', 'orange', 'rouge']
const worstFeu = (a, b) => FEU_ORDER[Math.max(FEU_ORDER.indexOf(a), FEU_ORDER.indexOf(b), 0)]

export default function MenuPage() {
  const router = useRouter()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState(null)
  const [courses, setCourses] = useState(null)
  const [shoppingListId, setShoppingListId] = useState(null)
  const [checkedItems, setCheckedItems] = useState(new Set())
  const [activeTab, setActiveTab] = useState('menu')
  const [allPlannings, setAllPlannings] = useState([])
  const [selectedRecipeId, setSelectedRecipeId] = useState(null)
  const [review, setReview] = useState(null)
  const [openReviewKey, setOpenReviewKey] = useState(null)
  const [replacingSlotId, setReplacingSlotId] = useState(null)
  const [swapSourceId, setSwapSourceId] = useState(null)
  const [houseRules, setHouseRules] = useState('')
  const [flashIds, setFlashIds] = useState([])
  const [lastSwap, setLastSwap] = useState(null)
  const toastTimer = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: plan } = await supabase
        .from('plannings')
        .select('*, shopping_lists(*)')
        .eq('id', id)
        .single()

      if (!plan) { router.push('/planning'); return }

      // Récupérer tous les plannings de la famille pour la navigation
      const { data: allPlans } = await supabase
        .from('plannings')
        .select('id, start_date, generated_at')
        .eq('family_id', plan.family_id)
        .order('start_date', { ascending: false })

      setAllPlannings(allPlans || [])

      const { data: slots } = await supabase
        .from('planning_slots')
        .select('*, recipes(*), emoji_unicode, recipe_id')
        .eq('planning_id', id)
        .order('slot_date')

      setMenu(slots || [])
      setReview(plan.review?.synthese ? plan.review : null)

      const { data: fam } = await supabase.from('families').select('house_rules').eq('id', plan.family_id).maybeSingle()
      setHouseRules(fam?.house_rules || '')

      if (plan.shopping_lists) {
        setCourses(plan.shopping_lists.items)
        setShoppingListId(plan.shopping_lists.id)
        const saved = plan.shopping_lists.checked_items
        if (Array.isArray(saved) && saved.length > 0) setCheckedItems(new Set(saved))
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function toggleCheck(categorie, itemNom) {
    const key = `${categorie}__${itemNom}`
    const next = new Set(checkedItems)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setCheckedItems(next)
    const { error } = await supabase.from('shopping_lists').update({ checked_items: [...next] }).eq('id', shoppingListId)
    if (error) console.error('Erreur persistance case:', error)
  }

  async function toggleValidation(slot, item) {
    const previous = slot.validated_items || {}
    const checked = !previous[item]
    const setItems = items => setMenu(prev => prev.map(s => s.id === slot.id ? { ...s, validated_items: items } : s))
    setItems({ ...previous, [item]: checked })
    try {
      const res = await fetch('/api/validate-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: slot.id, item, checked }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error)
    } catch (err) {
      console.error('Erreur validation repas:', err)
      setItems(previous)
    }
  }

  // Le Chef a proposé un autre plat : mettre à jour l'écran sans tout recharger
  function applySwap(aId, bId, newReview) {
    setMenu(prev => {
      const a = prev.find(s => s.id === aId)
      const b = prev.find(s => s.id === bId)
      const take = s => Object.fromEntries(SWAP_FIELDS.map(k => [k, s[k]]))
      return prev.map(s => s.id === aId ? { ...s, ...take(b) } : s.id === bId ? { ...s, ...take(a) } : s)
    })
    if (newReview !== undefined) setReview(newReview?.synthese ? newReview : null)
    setOpenReviewKey(null)
    setReplacingSlotId(null)
    setFlashIds([aId, bId])
    setTimeout(() => setFlashIds([]), 1200)
  }

  function handleSwapped(aId, bId, newReview) {
    applySwap(aId, bId, newReview)
    setSwapSourceId(null)
    setLastSwap({ aId, bId })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setLastSwap(null), 6000)
  }

  async function undoSwap() {
    const swap = lastSwap
    clearTimeout(toastTimer.current)
    setLastSwap(null)
    try {
      const res = await fetch('/api/swap-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotA: swap.aId, slotB: swap.bId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      applySwap(swap.aId, swap.bId, data.review)
    } catch (err) {
      console.error('Erreur annulation échange:', err)
    }
  }

  function handleReplaced(slotId, data) {
    setMenu(prev => prev.map(s => s.id === slotId
      ? { ...s, recipe_id: data.recipe.id, recipes: { ...data.recipe }, emoji_unicode: data.emoji_unicode, entree: data.entree, dessert: data.dessert, validated_items: data.validated_items || {} }
      : s))
    if (data.items) setCourses(data.items)
    setReview(data.review?.synthese ? data.review : null)
    setOpenReviewKey(null)
    setReplacingSlotId(null)
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function groupByDate(slots) {
    const groups = {}
    slots.forEach(slot => {
      if (!groups[slot.slot_date]) groups[slot.slot_date] = []
      groups[slot.slot_date].push(slot)
    })
    return groups
  }

  if (loading) return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--text-muted)' }}>Chargement...</p>
    </main>
  )

  const grouped = menu ? groupByDate(menu) : {}
  const currentIdx = allPlannings.findIndex(p => p.id === id)
  const currentPlanning = allPlannings[currentIdx]
  const reviewByKey = new Map((review?.repas || []).map(r => [`${r.date}|${r.service}`, r]))
  const weekFeu = FEUX[review?.feu_semaine]
  const mealSlots = (menu || []).filter(s => s.recipes)
  const validatedCount = mealSlots.filter(isSlotValidated).length

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px 80px' }}>
      <BackButton label="Planification" href="/planning" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          Menu de la semaine
        </h1>
        <button onClick={() => router.push('/planning')} style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', background: 'none', border: 'none', cursor: 'pointer' }}>
          + Nouveau
        </button>
      </div>

      {/* Navigation entre semaines */}
      {allPlannings.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, padding: '8px 12px' }}>
          <button
            onClick={() => {
              if (currentIdx < allPlannings.length - 1) router.push(`/menu/${allPlannings[currentIdx + 1].id}`)
            }}
            disabled={currentIdx >= allPlannings.length - 1}
            style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--cream-dark)', border: 'none',
              cursor: currentIdx >= allPlannings.length - 1 ? 'not-allowed' : 'pointer',
              fontSize: 16, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: currentIdx >= allPlannings.length - 1 ? 0.4 : 1,
            }}
          >‹</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
              {currentPlanning ? `Semaine du ${new Date(currentPlanning.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}
            </span>
            {currentIdx === 0 && (
              <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, color: 'var(--green)', fontWeight: 700, marginLeft: 6 }}>
                · En cours
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (currentIdx > 0) router.push(`/menu/${allPlannings[currentIdx - 1].id}`)
            }}
            disabled={currentIdx === 0}
            style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--cream-dark)', border: 'none',
              cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
              fontSize: 16, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: currentIdx === 0 ? 0.4 : 1,
            }}
          >›</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[{ key: 'menu', label: '🍽 Menu' }, { key: 'courses', label: '🛒 Courses' }].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700,
            background: activeTab === key ? 'var(--green)' : 'var(--cream-dark)',
            color: activeTab === key ? '#fff' : 'var(--text-muted)',
            boxShadow: activeTab === key ? '0 3px 0 var(--green-dark)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {activeTab === 'menu' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mealSlots.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>Repas validés</span>
                <span style={{ color: 'var(--green-dark)' }}>{validatedCount} / {mealSlots.length}</span>
              </div>
              <div style={{ height: 6, background: 'var(--cream-dark)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(validatedCount / mealSlots.length * 100)}%`, background: 'var(--green)', borderRadius: 3, transition: 'width .3s ease' }} />
              </div>
            </div>
          )}
          {/* Avis du Relecteur sur la semaine (absent pour les anciens menus) */}
          {review && weekFeu && (
            <div style={{ background: weekFeu.bg, borderRadius: 14, padding: '12px 16px', border: `2px solid ${weekFeu.dot}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: weekFeu.dot, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 800, color: weekFeu.color }}>
                  Avis du relecteur · {weekFeu.label}
                </span>
              </div>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, lineHeight: 1.45 }}>
                {review.synthese}
              </p>
            </div>
          )}
          {Object.entries(grouped).map(([date, slots], dayIndex) => (
            <div key={date}>
              <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'capitalize' }}>
                {formatDate(date)}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slots.map(slot => {
                  const isMidi = slot.service === 'dejeuner'

                  // Placeholder si pas de recette
                  if (!slot.recipes) {
                    return (
                      <div key={slot.id} style={{
                        textAlign: 'center', padding: '28px 20px',
                        background: '#fff', borderRadius: 14, border: '2px solid var(--cream-dark)',
                      }}>
                        <img
                          src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${EMPTY_ICONS[dayIndex % EMPTY_ICONS.length]}.svg`}
                          width={44} style={{ display: 'block', margin: '0 auto 10px' }} alt=""
                        />
                        <p style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 3, marginTop: 0 }}>
                          Rien de prévu !
                        </p>
                        <p style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                          Activez ce créneau dans le planning pour générer un menu.
                        </p>
                      </div>
                    )
                  }

                  const reviewKey = `${slot.slot_date}|${slot.service}`
                  const mealReview = reviewByKey.get(reviewKey)
                  const mealFeu = mealReview && (mealReview.remplace
                    ? FEUX.vert
                    : FEUX[worstFeu(mealReview.feu_nutrition, mealReview.feu_faisabilite)])
                  const reviewOpen = mealReview && openReviewKey === reviewKey
                  const isReplacing = replacingSlotId === slot.id
                  const reviewText = mealReview && (mealReview.remplace
                    ? `Plat corrigé : ${mealReview.raison}`
                    : [mealReview.raison, mealReview.suggestion].filter(Boolean).join(' — '))

                  const validated = isSlotValidated(slot)

                  return (
                    <div key={slot.id} style={{
                      background: validated ? '#FAFFF9' : '#fff',
                      border: `2px solid ${validated || flashIds.includes(slot.id) ? 'var(--green)' : 'var(--cream-dark)'}`,
                      borderRadius: 14, padding: '12px 16px', transition: 'border-color .2s, box-shadow .2s',
                      boxShadow: flashIds.includes(slot.id) ? '0 0 0 4px rgba(76,175,125,0.2)' : '0 2px 8px rgba(44,36,22,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 10px', borderRadius: 20, fontSize: 12,
                          fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                          background: isMidi ? 'var(--orange-light)' : 'var(--purple-light)',
                          color: isMidi ? 'var(--orange-dark)' : 'var(--purple)',
                        }}>
                          <img src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${isMidi ? '1F31E' : '1F319'}.svg`} alt="" style={{ width: 14, height: 14 }} />
                          {isMidi ? 'Midi' : 'Soir'}
                        </span>
                        <button
                          onClick={() => setSwapSourceId(slot.id)}
                          aria-label={`Échanger ${slot.recipes.name} avec un autre repas`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 30,
                            padding: '0 10px', borderRadius: 20, cursor: 'pointer',
                            border: '1.5px solid var(--cream-dark)', background: 'var(--cream)',
                            fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                          }}>
                          ⇅ Échanger
                        </button>
                        {mealReview && (
                          <button
                            onClick={() => setOpenReviewKey(reviewOpen ? null : reviewKey)}
                            title={reviewText}
                            aria-expanded={reviewOpen}
                            style={{
                              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                              fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700,
                              background: mealFeu.bg, color: mealFeu.color,
                            }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: mealFeu.dot }} />
                            {mealReview.remplace ? 'Corrigé' : mealFeu.label}
                          </button>
                        )}
                        {validated && (
                          <span aria-label="Repas validé" style={{
                            marginLeft: mealReview ? 0 : 'auto', width: 22, height: 22, borderRadius: '50%',
                            background: 'var(--green)', color: '#fff', fontSize: 12, fontWeight: 800,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>✓</span>
                        )}
                      </div>
                      {reviewOpen && (
                        <div style={{ background: mealFeu.bg, borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.45 }}>
                          {mealReview.remplace ? (
                            <p style={{ margin: 0 }}>
                              <strong style={{ color: mealFeu.color }}>Plat corrigé par le relecteur.</strong> Le plat prévu au départ a été remplacé : {mealReview.raison}
                            </p>
                          ) : (
                            <>
                              <p style={{ margin: '0 0 4px', color: mealFeu.color, fontWeight: 700 }}>
                                Nutrition : {FEUX[mealReview.feu_nutrition]?.label} · Faisabilité : {FEUX[mealReview.feu_faisabilite]?.label}
                              </p>
                              <p style={{ margin: 0 }}>{mealReview.raison}</p>
                              {mealReview.suggestion && (
                                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>💡 {mealReview.suggestion}</p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <img src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${slot.emoji_unicode || '1F37D'}.svg`} alt="" style={{ width: 32, height: 32, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                            {slot.recipes?.name || 'Recette non trouvée'}
                          </span>
                          {(slot.entree || slot.dessert) && (
                            <span style={{ display: 'block', marginTop: 2, fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                              {slot.entree && <span style={{ display: 'block' }}>Entrée : {slot.entree}</span>}
                              {slot.dessert && <span style={{ display: 'block' }}>Dessert : {slot.dessert}</span>}
                            </span>
                          )}
                        </span>
                      </div>
                      {/* Validation par composant du repas */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {validationItems(slot).map(item => {
                          const checked = !!slot.validated_items?.[item]
                          return (
                            <button
                              key={item}
                              onClick={() => toggleValidation(slot, item)}
                              aria-pressed={checked}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '5px 11px 5px 8px', borderRadius: 20, cursor: 'pointer',
                                border: `1.5px solid ${checked ? 'var(--green)' : 'var(--cream-dark)'}`,
                                background: checked ? 'var(--green-light)' : 'var(--cream)',
                                color: checked ? 'var(--green-dark)' : 'var(--text-muted)',
                                fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700,
                              }}>
                              <span style={{
                                width: 14, height: 14, borderRadius: '50%', fontSize: 8, flexShrink: 0,
                                border: `2px solid ${checked ? 'var(--green)' : 'currentColor'}`,
                                background: checked ? 'var(--green)' : 'transparent',
                                color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              }}>{checked ? '✓' : ''}</span>
                              {VALIDATION_LABELS[item]}
                            </button>
                          )
                        })}
                      </div>
                      {/* Boutons Recette + Remplacer */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {slot.recipes?.id && (
                          <button onClick={() => setSelectedRecipeId(slot.recipes.id)} style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '8px 12px', borderRadius: 10, border: 'none',
                            background: 'var(--green-light)', color: 'var(--green-dark)',
                            fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
                            cursor: 'pointer',
                          }}>
                            <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F4D6.svg" alt="" style={{ width: 16, height: 16 }} />
                            Voir la recette
                          </button>
                        )}
                        <button
                          onClick={() => setReplacingSlotId(isReplacing ? null : slot.id)}
                          aria-expanded={isReplacing}
                          disabled={validated}
                          title={validated ? 'Décochez un élément pour pouvoir remplacer ce repas' : undefined}
                          style={{
                            opacity: validated ? 0.4 : 1,
                            cursor: validated ? 'not-allowed' : 'pointer',
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            background: isReplacing ? 'var(--orange-light)' : 'var(--cream-dark)',
                            border: `1.5px solid ${isReplacing ? 'var(--orange)' : 'transparent'}`,
                            borderRadius: 10, padding: '8px 12px',
                            fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13,
                            color: isReplacing ? 'var(--orange-dark)' : 'var(--text-muted)',
                          }}>
                          <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F504.svg" alt="" style={{ width: 16, height: 16 }} />
                          Remplacer
                        </button>
                      </div>
                      {isReplacing && (
                        <ReplaceMealPanel
                          slotId={slot.id}
                          toChange={validationItems(slot).filter(k => !slot.validated_items?.[k]).map(k => VALIDATION_LABELS[k])}
                          kept={validationItems(slot).filter(k => slot.validated_items?.[k]).map(k => VALIDATION_LABELS[k])}
                          onReplaced={data => handleReplaced(slot.id, data)}
                          onCancel={() => setReplacingSlotId(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'courses' && courses && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>
            Liste de courses
          </h2>
          {Object.entries(courses).map(([categorie, items]) => {
            if (!items || !items.length) return null
            const badge = SHOP_BADGES[categorie] || { bg: 'var(--cream-dark)', color: 'var(--text-muted)', icon: '1F6D2' }
            return (
              <div key={categorie} style={{ background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(44,36,22,0.06)' }}>
                <div style={{ padding: '10px 16px', background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700, color: badge.color }}>
                    <img src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${badge.icon}.svg`} alt="" style={{ width: 18, height: 18 }} />
                    {categorie}
                  </span>
                  <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: badge.color, opacity: 0.8 }}>{items.length} articles</span>
                </div>
                <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((item, i) => {
                    const key = `${categorie}__${item.nom}`
                    const checked = checkedItems.has(key)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 14 }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCheck(categorie, item.nom)}
                          style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0, accentColor: 'var(--green)' }} />
                        <span style={{ flex: 1, fontFamily: "'Nunito', sans-serif", fontWeight: 600, textDecoration: checked ? 'line-through' : 'none', color: checked ? 'var(--text-muted)' : 'var(--text)' }}>
                          {item.nom}
                        </span>
                        <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--text-muted)' }}>{item.quantite} {item.unite}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <RecipeModal recipeId={selectedRecipeId} onClose={() => setSelectedRecipeId(null)} />

      {swapSourceId && menu.find(s => s.id === swapSourceId)?.recipes && (
        <SwapMealSheet
          source={menu.find(s => s.id === swapSourceId)}
          slots={menu}
          houseRules={houseRules}
          onSwapped={handleSwapped}
          onClose={() => setSwapSourceId(null)}
        />
      )}

      {lastSwap && (
        <div role="status" style={{
          position: 'fixed', left: 16, right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 150,
          maxWidth: 528, margin: '0 auto', background: 'var(--text)', color: '#fff', borderRadius: 12,
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
        }}>
          <span>Repas échangés</span>
          <button onClick={undoSwap} style={{
            marginLeft: 'auto', minHeight: 36, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer',
            color: '#8FE0B3', fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 800,
          }}>Annuler</button>
        </div>
      )}
    </main>
  )
}
