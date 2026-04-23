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
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState(null)
  const [startDate, setStartDate] = useState(null)
  const [slots, setSlots] = useState([])
  const [showConstraints, setShowConstraints] = useState(false)
  const [weekConstraints, setWeekConstraints] = useState('')
  const [lastPlanning, setLastPlanning] = useState(null)

  const LOADING_STEPS = [
    '✨ Composition du menu en cours...',
    '👨‍🍳 Sélection des recettes...',
    '🛒 Préparation de la liste de courses...',
    '📖 Génération des étapes de recettes...',
  ]

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
      const { data: fam } = await supabase.from('families').select('*').eq('user_id', user.id).single()
      if (!fam) { router.push('/profil'); return }
      setFamily(fam)

      // Charger le dernier planning existant
      const { data: lastPlan } = await supabase
        .from('plannings')
        .select('id, start_date')
        .eq('family_id', fam.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (lastPlan) setLastPlanning(lastPlan)

      const today = new Date()
      today.setHours(0,0,0,0)
      setStartDate(today)
      initSlots(today)
      setLoading(false)
    }
    load()
  }, [])

  function initSlots(from) {
    const now = new Date(); now.setHours(0,0,0,0)
    const s = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(from)
      d.setDate(d.getDate() + i)
      const isPast = d < now
      s.push({ date: d, active: !isPast, midi: !isPast, soir: !isPast, past: isPast })
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
    if (slots[i].past) return
    const s = [...slots]
    s[i] = { ...s[i], active: checked, midi: checked, soir: checked }
    setSlots(s)
  }

  function toggleDayClick(i) {
    if (slots[i].past) return
    const slot = slots[i]
    const isActive = slot.midi || slot.soir
    const s = [...slots]
    s[i] = { ...s[i], active: !isActive, midi: !isActive, soir: !isActive }
    setSlots(s)
  }

  function toggleSlot(i, slot) {
    if (slots[i].past) return
    const s = [...slots]
    s[i] = { ...s[i], [slot]: !s[i][slot] }
    setSlots(s)
  }

  const allMidiOn = slots.every(s => s.midi)
  const allSoirOn = slots.every(s => s.soir)

  function toggleAllMidi() {
    const next = !allMidiOn
    setSlots(s => s.map(slot => ({ ...slot, midi: next, active: next || slot.soir })))
  }

  function toggleAllSoir() {
    const next = !allSoirOn
    setSlots(s => s.map(slot => ({ ...slot, soir: next, active: slot.midi || next })))
  }

  const todayDate = new Date(); todayDate.setHours(0,0,0,0)
  const allSlotsPast = slots.length > 0 && slots.every(s => s.past)
  const activeMeals = slots.filter(s => s.active && (s.midi || s.soir))
  const totalMeals = slots.reduce((acc, s) => acc + (s.active ? (s.midi ? 1 : 0) + (s.soir ? 1 : 0) : 0), 0)

  async function handleGenerate() {
    if (allSlotsPast) { setError('Cette semaine est déjà passée. Sélectionnez une semaine à venir pour générer un menu.'); return }
    if (!activeMeals.length) { setError('Aucun repas sélectionné.'); return }
    setError(null)
    setGenerating(true)
    setLoadingStep(0)

    const planLines = activeMeals.map(s => {
      const sv = []
      if (s.midi) sv.push('dejeuner')
      if (s.soir) sv.push('diner')
      return `- ${DAY_NAMES[s.date.getDay()]} ${formatShort(s.date)} (${toISO(s.date)}) : ${sv.join(' + ')}`
    }).join('\n')

    const stepTimer = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length)
    }, 8000)

    try {
      const res = await fetch('/api/generate-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family, planLines, startDate: toISO(startDate), weekConstraints })
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const event = JSON.parse(part.slice(6))
          if (event.type === 'done') { clearInterval(stepTimer); router.push(`/menu/${event.planningId}`); return }
          if (event.type === 'error') throw new Error(event.message)
        }
      }
    } catch (err) {
      setError(err.message)
      setGenerating(false)
    } finally {
      clearInterval(stepTimer)
    }
  }

  if (loading) return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--text-muted)' }}>Chargement...</p>
    </main>
  )

  const endDate = startDate ? new Date(new Date(startDate).setDate(startDate.getDate() + 6)) : null

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px 80px' }}>
      <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
        Planifier ma semaine
      </h1>
      <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)', marginBottom: lastPlanning ? 12 : 24 }}>
        {family.adults} adulte{family.adults > 1 ? 's' : ''} · {family.children} enfant{family.children > 1 ? 's' : ''}
      </p>

      {/* Bannière menu en cours */}
      {lastPlanning && (
        <button
          onClick={() => router.push(`/menu/${lastPlanning.id}`)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20, padding: '12px 16px',
            background: 'var(--green-light)', border: '2px solid var(--green)',
            borderRadius: 14, cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F37D.svg" width={24} alt="" />
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 800, color: 'var(--green-dark)', margin: 0 }}>
                Menu en cours
              </p>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: 'var(--green-dark)', margin: 0, opacity: 0.8 }}>
                Semaine du {new Date(lastPlanning.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--green-dark)' }}>Voir →</span>
        </button>
      )}

      {/* Navigation semaine */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, background: '#fff', border: '2px solid var(--cream-dark)', padding: '10px 16px', borderRadius: 14 }}>
        <button onClick={() => shiftStart(-1)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--cream-dark)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {startDate && endDate ? `${formatShort(startDate)} – ${endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}
        </span>
        <button onClick={() => shiftStart(1)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--cream-dark)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>›</button>
      </div>

      {/* Contraintes semaine (collapsible) */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setShowConstraints(!showConstraints)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-muted)',
          padding: '4px 0',
        }}>
          <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/2728.svg" width={16} alt="" />
          {showConstraints ? 'Masquer les contraintes' : 'Contraintes pour personnaliser le menu'}
        </button>
        {showConstraints && (
          <textarea
            value={weekConstraints}
            onChange={e => setWeekConstraints(e.target.value)}
            placeholder="Ex: pas de four cette semaine, léger le soir, repas rapides…"
            rows={2}
            style={{
              width: '100%', marginTop: 6, padding: '10px 12px',
              fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--text)',
              background: '#fff', border: '2px solid var(--green)',
              borderRadius: 10, resize: 'none', outline: 'none', boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      {/* Boutons toggle all */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={toggleAllMidi} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '7px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: allMidiOn ? 'var(--orange-light)' : 'var(--cream-dark)',
          fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800,
          color: allMidiOn ? 'var(--orange-dark)' : 'var(--text-muted)',
        }}>
          <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F31E.svg" width={14} alt="" />
          {allMidiOn ? 'Désélect. tous les midis' : 'Sélect. tous les midis'}
        </button>
        <button onClick={toggleAllSoir} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '7px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: allSoirOn ? 'var(--purple-light)' : 'var(--cream-dark)',
          fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800,
          color: allSoirOn ? 'var(--purple)' : 'var(--text-muted)',
        }}>
          <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F319.svg" width={14} alt="" />
          {allSoirOn ? 'Désélect. tous les soirs' : 'Sélect. tous les soirs'}
        </button>
      </div>

      {/* Cards de jours */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {slots.map((slot, i) => (
          <div key={i} style={{
            border: `2px solid ${slot.active ? 'var(--green)' : 'var(--cream-dark)'}`,
            borderRadius: 14,
            overflow: 'hidden',
            opacity: slot.active ? 1 : 0.5,
            boxShadow: slot.active ? '0 2px 14px rgba(44,36,22,0.06)' : 'none',
            background: slot.active ? 'var(--green-light)' : '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
              <input type="checkbox" checked={slot.active} onChange={e => toggleDay(i, e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--green)', flexShrink: 0 }} />
              <span
                onClick={() => toggleDayClick(i)}
                style={{ flex: 1, fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--text)', cursor: slot.past ? 'default' : 'pointer', userSelect: 'none' }}>
                {DAY_NAMES[slot.date.getDay()]}
                {slot.past && (
                  <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 6 }}>
                    · journée passée
                  </span>
                )}
              </span>
              <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>{formatShort(slot.date)}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'midi', label: 'Midi', icon: '1F31E', activeBg: 'var(--orange)', activeColor: '#fff', inactiveBg: 'var(--orange-light)', inactiveColor: 'var(--orange-dark)' },
                  { key: 'soir', label: 'Soir', icon: '1F319', activeBg: 'var(--purple)', activeColor: '#fff', inactiveBg: 'var(--purple-light)', inactiveColor: 'var(--purple)' },
                ].map(({ key, label, icon, activeBg, activeColor, inactiveBg, inactiveColor }) => (
                  <span key={key}
                    onClick={() => slot.active && toggleSlot(i, key)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 20, fontSize: 12,
                      fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                      cursor: slot.active ? 'pointer' : 'default',
                      background: slot[key] ? activeBg : inactiveBg,
                      color: slot[key] ? activeColor : inactiveColor,
                    }}>
                    <img src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${icon}.svg`} alt="" style={{ width: 14, height: 14 }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'jours', val: activeMeals.length },
          { label: 'déjeuners', val: slots.filter(s => s.active && s.midi).length },
          { label: 'dîners', val: slots.filter(s => s.active && s.soir).length },
          { label: 'repas', val: totalMeals },
        ].map(({ label, val }) => (
          <span key={label} style={{ padding: '5px 14px', borderRadius: 20, background: 'var(--cream-dark)', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            <strong>{val}</strong> {label}
          </span>
        ))}
      </div>

      {error && <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, padding: '10px 14px', background: 'var(--red-light)', color: 'var(--red-dark)', borderRadius: 10, marginBottom: 16 }}>{error}</p>}

      <button onClick={handleGenerate} disabled={generating} style={{
        width: '100%', padding: '14px 24px',
        background: generating ? 'var(--cream-dark)' : 'var(--green)',
        color: generating ? 'var(--text-muted)' : '#fff',
        border: 'none', borderRadius: 12,
        fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 700,
        boxShadow: generating ? 'none' : '0 4px 0 var(--green-dark)',
        cursor: generating ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {generating ? (
          <>
            <span style={{ width: 16, height: 16, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--text-muted)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            {LOADING_STEPS[loadingStep]}
          </>
        ) : (
          <>
            <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/2728.svg" alt="" style={{ width: 20, height: 20 }} />
            Générer le menu
          </>
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
