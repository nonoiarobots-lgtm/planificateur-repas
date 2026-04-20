'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function MenuPage() {
  const router = useRouter()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [planning, setPlanning] = useState(null)
  const [menu, setMenu] = useState(null)
  const [courses, setCourses] = useState(null)
  const [shoppingListId, setShoppingListId] = useState(null)
  const [checkedItems, setCheckedItems] = useState(new Set())
  const [activeTab, setActiveTab] = useState('menu')

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
      setPlanning(plan)

      const { data: slots } = await supabase
        .from('planning_slots')
        .select('*, recipes(*), emoji_unicode')
        .eq('planning_id', id)
        .order('slot_date')

      setMenu(slots || [])

      if (plan.shopping_lists) {
        setCourses(plan.shopping_lists.items)
        setShoppingListId(plan.shopping_lists.id)
        const saved = plan.shopping_lists.checked_items
        if (Array.isArray(saved) && saved.length > 0) {
          setCheckedItems(new Set(saved))
        }
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

    const { error } = await supabase
      .from('shopping_lists')
      .update({ checked_items: [...next] })
      .eq('id', shoppingListId)

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

  if (loading) return <p style={{ padding: 40, fontFamily: 'Arial' }}>Chargement...</p>

  const grouped = menu ? groupByDate(menu) : {}
  const tab = { padding: '8px 18px', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 14, fontWeight: 500 }

  return (
    <main style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px', fontFamily: 'Arial' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Menu de la semaine</h1>
        <button onClick={() => router.push('/planning')}
          style={{ fontSize: 13, color: '#0070f3', background: 'none', border: 'none', cursor: 'pointer' }}>
          + Nouveau
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['menu','courses'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ ...tab, background: activeTab === t ? '#0070f3' : '#f0f0f0', color: activeTab === t ? '#fff' : '#333' }}>
            {t === 'menu' ? 'Menu' : 'Courses'}
          </button>
        ))}
      </div>

      {activeTab === 'menu' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(grouped).map(([date, slots]) => (
            <div key={date} style={{ border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{formatDate(date)}</span>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slots.map(slot => (
                  <div key={slot.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                      background: slot.service === 'dejeuner' ? '#E1F5EE' : '#EEEDFE',
                      color: slot.service === 'dejeuner' ? '#0F6E56' : '#3C3489'
                    }}>
                      {slot.service === 'dejeuner' ? 'Midi' : 'Soir'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, flex: 1 }}>
                      <img
                        src={`https://openmoji.org/data/color/svg/${slot.emoji_unicode || '1F37D'}.svg`}
                        alt=""
                        style={{ width: 28, height: 28, flexShrink: 0 }}
                      />
                      {slot.recipes?.name || 'Recette non trouvée'}
                    </span>
                    {slot.recipes?.id && (
                      <button
                        onClick={() => router.push(`/recette/${slot.recipes.id}`)}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid #ddd', background: '#fff', color: '#555', cursor: 'pointer', flexShrink: 0 }}>
                        Recette
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'courses' && courses && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(courses).map(([categorie, items]) => (
            items && items.length > 0 && (
              <div key={categorie} style={{ border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', background: '#fafafa', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{categorie}</span>
                  <span style={{ fontSize: 12, color: '#888' }}>{items.length} articles</span>
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((item, i) => {
                    const key = `${categorie}__${item.nom}`
                    const checked = checkedItems.has(key)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheck(categorie, item.nom)}
                          style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ flex: 1, textDecoration: checked ? 'line-through' : 'none', color: checked ? '#aaa' : 'inherit' }}>
                          {item.nom}
                        </span>
                        <span style={{ fontSize: 13, color: '#888' }}>{item.quantite} {item.unite}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </main>
  )
}
