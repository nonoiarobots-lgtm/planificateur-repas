'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import BackButton from '@/app/components/BackButton'

const SHOP_BADGES = {
  'Marché / Primeur': { bg: 'var(--green-light)', color: 'var(--green-dark)', icon: '1F966' },
  'Poissonnerie':     { bg: 'var(--blue-light)',   color: 'var(--blue-dark)',   icon: '1F41F' },
  'Boucher':          { bg: 'var(--red-light)',    color: 'var(--red-dark)',    icon: '1F969' },
  'Supermarché':      { bg: 'var(--orange-light)', color: 'var(--orange-dark)', icon: '1F6D2' },
}

const EMPTY_ICONS = ['1F634', '1F37D', '1F373', '1F9D1-200D-1F373', '1F959']

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

                  return (
                    <div key={slot.id} style={{ background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, padding: '12px 16px', boxShadow: '0 2px 8px rgba(44,36,22,0.06)' }}>
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
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <img src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${slot.emoji_unicode || '1F37D'}.svg`} alt="" style={{ width: 32, height: 32, flexShrink: 0 }} />
                        <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                          {slot.recipes?.name || 'Recette non trouvée'}
                        </span>
                      </div>
                      {/* Boutons Recette + Remplacer */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {slot.recipes?.id && (
                          <button onClick={() => router.push(`/recette/${slot.recipes.id}`)} style={{
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
                          disabled
                          title="Disponible prochainement"
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            background: 'var(--cream-dark)', border: '1.5px solid transparent',
                            borderRadius: 10, padding: '8px 12px', cursor: 'not-allowed',
                            fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-muted)',
                            opacity: 0.6,
                          }}>
                          <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F504.svg" alt="" style={{ width: 16, height: 16 }} />
                          Remplacer
                        </button>
                      </div>
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
    </main>
  )
}
