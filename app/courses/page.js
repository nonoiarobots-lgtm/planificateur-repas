'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const CAT_META = {
  'Marché / Primeur': { icon: '1F966', color: 'var(--green)',  light: 'var(--green-light)',  dark: 'var(--green-dark)'  },
  'Poissonnerie':     { icon: '1F41F', color: 'var(--blue)',   light: 'var(--blue-light)',   dark: 'var(--blue-dark)'   },
  'Boucher':          { icon: '1F969', color: 'var(--red)',    light: 'var(--red-light)',    dark: 'var(--red-dark)'    },
  'Supermarché':      { icon: '1F6D2', color: 'var(--orange)', light: 'var(--orange-light)', dark: 'var(--orange-dark)' },
}

export default function CoursesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState(null)
  const [shoppingListId, setShoppingListId] = useState(null)
  const [checkedItems, setCheckedItems] = useState(new Set())
  const [collapsedCats, setCollapsedCats] = useState({})
  const [allPlannings, setAllPlannings] = useState([])
  const [currentPlanningIdx, setCurrentPlanningIdx] = useState(0)
  const [currentPlanning, setCurrentPlanning] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: fam } = await supabase.from('families').select('id').eq('user_id', user.id).single()
      if (!fam) { router.push('/profil'); return }

      const { data: plans } = await supabase
        .from('plannings')
        .select('id, start_date, generated_at')
        .eq('family_id', fam.id)
        .order('start_date', { ascending: false })

      if (!plans || plans.length === 0) {
        setLoading(false)
        return
      }

      setAllPlannings(plans)
      await loadPlanning(plans[0], 0)
      setLoading(false)
    }
    load()
  }, [])

  async function loadPlanning(plan, idx) {
    setCurrentPlanning(plan)
    setCurrentPlanningIdx(idx)

    const { data: sl } = await supabase
      .from('shopping_lists')
      .select('id, items, checked_items')
      .eq('planning_id', plan.id)
      .single()

    if (sl) {
      setCourses(sl.items)
      setShoppingListId(sl.id)
      const saved = sl.checked_items
      if (Array.isArray(saved) && saved.length > 0) setCheckedItems(new Set(saved))
      else setCheckedItems(new Set())
    } else {
      setCourses(null)
      setShoppingListId(null)
      setCheckedItems(new Set())
    }
  }

  async function navigateTo(idx) {
    if (idx < 0 || idx >= allPlannings.length) return
    await loadPlanning(allPlannings[idx], idx)
  }

  async function toggleCheck(categorie, itemNom) {
    const key = `${categorie}__${itemNom}`
    const next = new Set(checkedItems)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setCheckedItems(next)
    if (shoppingListId) {
      await supabase.from('shopping_lists').update({ checked_items: [...next] }).eq('id', shoppingListId)
    }
  }

  function toggleCat(cat) {
    setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const allItems = courses ? Object.values(courses).flat() : []
  const totalAll = allItems.length
  const totalDone = allItems.filter(item => {
    const cat = Object.entries(courses || {}).find(([, items]) => items.some(i => i.nom === item.nom))?.[0]
    return cat && checkedItems.has(`${cat}__${item.nom}`)
  }).length

  if (loading) return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--text-muted)' }}>Chargement...</p>
    </main>
  )

  if (!allPlannings.length) return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px 80px', textAlign: 'center' }}>
      <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F6D2.svg" width={64} alt="" style={{ display: 'block', margin: '40px auto 16px' }} />
      <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Pas encore de courses</h1>
      <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
        Génère un menu pour voir ta liste de courses ici.
      </p>
      <button onClick={() => router.push('/planning')} style={{
        padding: '12px 24px', borderRadius: 12, border: 'none',
        background: 'var(--green)', color: '#fff',
        fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700,
        cursor: 'pointer', boxShadow: '0 4px 0 var(--green-dark)',
      }}>
        ✨ Générer un menu
      </button>
    </main>
  )

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px 80px' }}>
      <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
        Courses
      </h1>
      {currentPlanning && (
        <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Semaine du {new Date(currentPlanning.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      {/* Navigation entre semaines */}
      {allPlannings.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, padding: '8px 12px' }}>
          <button
            onClick={() => navigateTo(currentPlanningIdx + 1)}
            disabled={currentPlanningIdx >= allPlannings.length - 1}
            style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--cream-dark)', border: 'none',
              cursor: currentPlanningIdx >= allPlannings.length - 1 ? 'not-allowed' : 'pointer',
              fontSize: 16, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: currentPlanningIdx >= allPlannings.length - 1 ? 0.4 : 1,
            }}
          >‹</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
              {currentPlanning ? new Date(currentPlanning.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''}
            </span>
            {currentPlanningIdx === 0 && (
              <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, color: 'var(--green)', fontWeight: 700, marginLeft: 6 }}>
                · En cours
              </span>
            )}
          </div>
          <button
            onClick={() => navigateTo(currentPlanningIdx - 1)}
            disabled={currentPlanningIdx === 0}
            style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--cream-dark)', border: 'none',
              cursor: currentPlanningIdx === 0 ? 'not-allowed' : 'pointer',
              fontSize: 16, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: currentPlanningIdx === 0 ? 0.4 : 1,
            }}
          >›</button>
        </div>
      )}

      {/* Barre de progression */}
      {courses && (
        <div style={{ marginBottom: 20, background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, boxShadow: '0 2px 14px rgba(44,36,22,0.08)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Progression</span>
            <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: 16, color: 'var(--green)' }}>
              {totalDone}/{totalAll}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--cream-dark)' }}>
            <div style={{
              height: 8, borderRadius: 4, background: 'var(--green)',
              width: `${totalAll > 0 ? (totalDone / totalAll) * 100 : 0}%`,
              transition: 'width 0.3s',
            }} />
          </div>
          {totalDone === totalAll && totalAll > 0 && (
            <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--green-dark)', fontWeight: 700, marginTop: 8, textAlign: 'center', marginBottom: 0 }}>
              🎉 Toutes les courses sont faites !
            </p>
          )}
        </div>
      )}

      {/* Catégories */}
      {courses ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(courses).map(([categorie, items]) => {
            if (!items || !items.length) return null
            const meta = CAT_META[categorie] || { icon: '1F6D2', color: 'var(--orange)', light: 'var(--orange-light)', dark: 'var(--orange-dark)' }
            const collapsed = collapsedCats[categorie]
            const doneCat = items.filter(item => checkedItems.has(`${categorie}__${item.nom}`)).length
            return (
              <div key={categorie} style={{ background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(44,36,22,0.06)' }}>
                {/* En-tête catégorie */}
                <button
                  onClick={() => toggleCat(categorie)}
                  style={{
                    width: '100%', padding: '10px 16px', background: meta.light,
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700, color: meta.dark }}>
                    <img src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${meta.icon}.svg`} alt="" style={{ width: 18, height: 18 }} />
                    {categorie}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: meta.dark, opacity: 0.8 }}>
                      {doneCat}/{items.length}
                    </span>
                    <span style={{ fontSize: 14, color: meta.dark, opacity: 0.7 }}>{collapsed ? '›' : '‹'}</span>
                  </div>
                </button>

                {/* Items */}
                {!collapsed && (
                  <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map((item, i) => {
                      const key = `${categorie}__${item.nom}`
                      const checked = checkedItems.has(key)
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0',
                          borderBottom: i < items.length - 1 ? '1px solid var(--cream-dark)' : 'none' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCheck(categorie, item.nom)}
                            style={{ width: 17, height: 17, cursor: 'pointer', flexShrink: 0, accentColor: meta.color }}
                          />
                          <span style={{
                            flex: 1, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600,
                            textDecoration: checked ? 'line-through' : 'none',
                            color: checked ? 'var(--text-muted)' : 'var(--text)',
                          }}>
                            {item.nom}
                          </span>
                          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {item.quantite} {item.unite}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)' }}>
            Aucune liste de courses pour cette semaine.
          </p>
        </div>
      )}
    </main>
  )
}
