'use client'

import { useEffect, useState } from 'react'
import { MAX_PREPARATION, MAX_CUISSON, isWeekend } from '@/lib/menu-rules'

const FISH = /poisson|cabillaud|saumon|thon|colin|merlu|lieu|sole|truite|dorade|daurade|bar |maquereau|sardine|crevette|moule|saint-jacques|églefin|haddock|merlan|lotte|limande|fruits de mer/i

// « 25 min », « 1 h 30 », « 1h », « 2 heures » → minutes
function minutes(t) {
  const s = String(t || '').toLowerCase()
  const h = s.match(/(\d+)\s*h/)
  const m = s.match(/(\d+)\s*(?:min|mn|')/) || (h ? s.match(/h\s*(\d+)/) : s.match(/^\s*(\d+)/))
  return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0)
}
const isLong = slot => minutes(slot.recipes?.prep_time) > MAX_PREPARATION || minutes(slot.recipes?.cook_time) > MAX_CUISSON
const isFish = slot => FISH.test(slot.recipes?.name || '')
const isLateWeek = date => [0, 4, 5, 6].includes(new Date(`${date}T12:00:00`).getDay())
const when = slot => {
  const d = new Date(`${slot.slot_date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })
  return `${d} · ${slot.service === 'dejeuner' ? 'midi' : 'soir'}`
}

// Avertit sans bloquer quand le repas arrive à une date qui ne lui convient pas
function warningsFor(meal, toDate, checkFish) {
  if (!meal.recipes) return []
  const w = []
  if (isLong(meal) && !isWeekend(toDate)) w.push(`« ${meal.recipes.name} » est un plat long, prévu pour le week-end`)
  if (checkFish && isFish(meal) && isLateWeek(toDate)) w.push(`Le poisson « ${meal.recipes.name} » passerait en fin de semaine`)
  return w
}

export default function SwapMealSheet({ source, slots, houseRules, onSwapped, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const checkFish = /poisson/i.test(houseRules || '')
  const targets = slots.filter(s => s.id !== source.id)

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape' && !loading) onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, loading])

  async function pick(target) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/swap-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotA: source.id, slotB: target.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "L'échange a échoué. Réessayez.")
      onSwapped(source.id, target.id, data.review)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div
      onClick={() => !loading && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(44,36,22,0.55)',
        zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="swap-title"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--cream)', borderRadius: '20px 20px 0 0', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column', padding: '0 16px 24px',
          width: '100%', maxWidth: 560, margin: '0 auto', fontFamily: "'Nunito', sans-serif",
        }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--cream-dark)' }} />
        </div>
        <h2 id="swap-title" style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          Échanger avec…
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 12px', textTransform: 'capitalize' }}>
          {source.recipes.name} — {when(source)}
        </p>

        {error && (
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--red-dark)', background: 'var(--red-light)', borderRadius: 8, padding: '8px 12px' }}>
            {error}
          </p>
        )}

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {targets.map(t => {
            const warnings = [
              ...warningsFor(source, t.slot_date, checkFish),
              ...warningsFor(t, source.slot_date, checkFish),
            ]
            return (
              <button
                key={t.id}
                onClick={() => pick(t)}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, width: '100%',
                  padding: '8px 12px', borderRadius: 12, textAlign: 'left',
                  border: '1.5px solid var(--cream-dark)', background: '#fff',
                  cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1,
                  fontFamily: "'Nunito', sans-serif", color: 'var(--text)',
                }}>
                <span style={{ width: 78, flexShrink: 0, fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', lineHeight: 1.25, textTransform: 'capitalize' }}>
                  {when(t)}
                </span>
                {t.recipes ? (
                  <img src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${t.emoji_unicode || '1F37D'}.svg`} alt="" style={{ width: 26, height: 26, flexShrink: 0 }} />
                ) : (
                  <span style={{ width: 26, flexShrink: 0 }} />
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.recipes ? 'var(--text)' : 'var(--text-muted)', fontStyle: t.recipes ? 'normal' : 'italic' }}>
                    {t.recipes ? t.recipes.name : 'Créneau libre — déplacer ici'}
                  </span>
                  {warnings.map(w => (
                    <span key={w} style={{ display: 'block', marginTop: 2, fontSize: 11, fontWeight: 700, color: 'var(--orange-dark)' }}>⚠ {w}</span>
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        <button onClick={onClose} disabled={loading} style={{
          marginTop: 12, minHeight: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'var(--cream-dark)', color: 'var(--text-muted)',
          fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700,
        }}>
          {loading ? 'Échange en cours…' : 'Annuler'}
        </button>
      </div>
    </div>
  )
}
