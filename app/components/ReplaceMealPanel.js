'use client'

import { useState } from 'react'

const SUGGESTIONS = ['Plus simple', 'Plus rapide', 'Plus sain', 'Plus de légumes', 'Sans viande', 'Plus gourmand']
const MAX_COMMENT = 300

// Panneau « Remplacer » : la famille dit ce qu'elle veut à la place, le Chef propose un autre plat
export default function ReplaceMealPanel({ slotId, onReplaced, onCancel }) {
  const [selected, setSelected] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function toggle(label) {
    setSelected(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])
  }

  async function submit() {
    setLoading(true)
    setError(null)
    const comment = [selected.join(', '), text.trim()].filter(Boolean).join('. ')
    try {
      const res = await fetch('/api/replace-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, comment }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Le remplacement a échoué. Réessayez.')
      onReplaced(data)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 10, background: 'var(--cream)', border: '2px solid var(--cream-dark)', borderRadius: 12, padding: '12px 14px', fontFamily: "'Nunito', sans-serif" }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
        Que souhaitez-vous à la place ?
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {SUGGESTIONS.map(label => {
          const on = selected.includes(label)
          return (
            <button key={label} type="button" onClick={() => toggle(label)} disabled={loading} style={{
              padding: '4px 12px', borderRadius: 20, cursor: loading ? 'default' : 'pointer',
              fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700,
              border: `1.5px solid ${on ? 'var(--green)' : 'var(--cream-dark)'}`,
              background: on ? 'var(--green-light)' : '#fff',
              color: on ? 'var(--green-dark)' : 'var(--text-muted)',
            }}>{label}</button>
          )
        })}
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, MAX_COMMENT))}
        disabled={loading}
        rows={2}
        placeholder="Autre précision (facultatif) : ex. « avec du poisson », « les enfants n'aiment pas les épinards »"
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'vertical', borderRadius: 10,
          border: '1.5px solid var(--cream-dark)', padding: '8px 10px', marginBottom: 8,
          fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--text)', background: '#fff',
        }}
      />
      {error && (
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--red-dark)', background: 'var(--red-light)', borderRadius: 8, padding: '6px 10px' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onCancel} disabled={loading} style={{
          flex: 1, padding: '8px 12px', borderRadius: 10, border: 'none', cursor: loading ? 'default' : 'pointer',
          background: 'var(--cream-dark)', color: 'var(--text-muted)',
          fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, opacity: loading ? 0.6 : 1,
        }}>Annuler</button>
        <button type="button" onClick={submit} disabled={loading} style={{
          flex: 2, padding: '8px 12px', borderRadius: 10, border: 'none', cursor: loading ? 'wait' : 'pointer',
          background: 'var(--green)', color: '#fff', boxShadow: '0 3px 0 var(--green-dark)',
          fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, opacity: loading ? 0.8 : 1,
        }}>
          {loading ? 'Le chef cherche un autre plat…' : 'Proposer un autre plat'}
        </button>
      </div>
    </div>
  )
}
