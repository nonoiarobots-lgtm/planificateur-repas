'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toLocalISODate } from '@/lib/date-utils'

const DAY_NAMES = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

export default function PlanningPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [family, setFamily] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [startDate, setStartDate] = useState(null)
  const [slots, setSlots] = useState([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)

      const { data: fam } = await supabase
        .from('families')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!fam) { router.push('/profil'); return }
      setFamily(fam)

      const today = new Date()
      today.setHours(0,0,0,0)
      setStartDate(today)
      initSlots(today)
      setLoading(false)
    }
    load()
  }, [])

  function initSlots(from) {
    const s = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(from)
      d.setDate(d.getDate() + i)
      s.push({ date: d, active: true, midi: true, soir: true })
    }
    setSlots(s)
  }

  function toISO(d) { return toLocalISODate(d) }
  function formatShort(d) { return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }

  function shiftStart(dir) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + dir)
    setStartDate(d)
    initSlots(d)
  }

  function toggleDay(i, checked) {
    const s = [...slots]
    s[i] = { ...s[i], active: checked, midi: checked, soir: checked }
    setSlots(s)
  }

  function toggleSlot(i, slot) {
    const s = [...slots]
    s[i] = { ...s[i], [slot]: !s[i][slot] }
    setSlots(s)
  }

  const activeMeals = slots.filter(s => s.active && (s.midi || s.soir))
  const totalMeals = slots.reduce((acc, s) => acc + (s.active ? (s.midi ? 1 : 0) + (s.soir ? 1 : 0) : 0), 0)

  async function handleGenerate() {
    if (!activeMeals.length) { setError('Aucun repas sélectionné.'); return }
    setError(null)
    setGenerating(true)

    const planLines = activeMeals.map(s => {
      const sv = []
      if (s.midi) sv.push('dejeuner')
      if (s.soir) sv.push('diner')
      return `- ${DAY_NAMES[s.date.getDay()]} ${formatShort(s.date)} (${toISO(s.date)}) : ${sv.join(' + ')}`
    }).join('\n')

    try {
      const res = await fetch('/api/generate-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family, planLines, startDate: toISO(startDate) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')

      router.push(`/menu/${data.planningId}`)
    } catch (err) {
      setError(err.message)
      setGenerating(false)
    }
  }

  if (loading) return <p style={{ padding: 40, fontFamily: 'Arial' }}>Chargement...</p>

  const endDate = startDate ? new Date(new Date(startDate).setDate(startDate.getDate() + 6)) : null

  return (
    <main style={{ maxWidth: 520, margin: '40px auto', padding: '0 24px', fontFamily: 'Arial' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Planifier la semaine</h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
        {family.adults} adultes · {family.children} enfants
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: '#f5f5f5', padding: '10px 14px', borderRadius: 10 }}>
        <button onClick={() => shiftStart(-1)} style={{ width: 32, height: 32, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 18 }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 500 }}>
          {startDate && endDate ? `${formatShort(startDate)} – ${endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
        </span>
        <button onClick={() => shiftStart(1)} style={{ width: 32, height: 32, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 18 }}>›</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {slots.map((slot, i) => (
          <div key={i} style={{ border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', opacity: slot.active ? 1 : 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fafafa' }}>
              <input type="checkbox" checked={slot.active} onChange={e => toggleDay(i, e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{DAY_NAMES[slot.date.getDay()]}</span>
              <span style={{ fontSize: 12, color: '#888', marginRight: 8 }}>{formatShort(slot.date)}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['midi','soir'].map(s => (
                  <span key={s} onClick={() => slot.active && toggleSlot(i, s)}
                    style={{ padding: '3px 10px', borderRadius: 20, border: '1px solid', fontSize: 12, cursor: slot.active ? 'pointer' : 'default',
                      borderColor: slot[s] ? (s === 'midi' ? '#1D9E75' : '#534AB7') : '#ddd',
                      background: slot[s] ? (s === 'midi' ? '#E1F5EE' : '#EEEDFE') : '#fff',
                      color: slot[s] ? (s === 'midi' ? '#0F6E56' : '#3C3489') : '#aaa',
                      fontWeight: slot[s] ? 500 : 400 }}>
                    {s === 'midi' ? 'Midi' : 'Soir'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, padding: '10px 14px', background: '#f5f5f5', borderRadius: 10, marginBottom: 20, fontSize: 13 }}>
        <span><strong>{activeMeals.length}</strong> jours</span>
        <span><strong>{slots.filter(s=>s.active&&s.midi).length}</strong> déjeuners</span>
        <span><strong>{slots.filter(s=>s.active&&s.soir).length}</strong> dîners</span>
        <span><strong>{totalMeals}</strong> repas</span>
      </div>

      {error && <p style={{ color: '#e00', fontSize: 14, padding: '10px 12px', background: '#fff0f0', borderRadius: 8, marginBottom: 16 }}>{error}</p>}

      <button onClick={handleGenerate} disabled={generating}
        style={{ width: '100%', padding: 14, background: generating ? '#aaa' : '#0070f3', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: generating ? 'not-allowed' : 'pointer' }}>
        {generating ? 'Génération en cours...' : 'Générer le menu →'}
      </button>
    </main>
  )
}