'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const CONTRAINTES = ['Sans gluten', 'Sans lactose', 'Végétarien', 'Halal', 'Sans porc', 'Sans fruits de mer']
const CUISINES = ['Française', 'Méditerranéenne', 'Asiatique', 'Italienne', 'Marocaine', 'Indienne']

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '2px solid var(--cream-dark)',
  borderRadius: 10, fontFamily: "'Nunito', sans-serif", fontSize: 15,
  background: '#fff', color: 'var(--text)', outline: 'none',
}

const cardStyle = {
  background: '#fff', border: '2px solid var(--cream-dark)',
  borderRadius: 14, boxShadow: '0 2px 14px rgba(44,36,22,0.06)', padding: '20px',
}

export default function ProfilPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({ adults: 2, children: 0, children_ages: '', constraints: [], cuisines: [], preferences: '' })

  useEffect(() => {
    async function loadProfil() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
      const { data } = await supabase.from('families').select('*').eq('user_id', user.id).single()
      if (data) {
        setForm({
          adults: data.adults,
          children: data.children,
          children_ages: (data.children_ages || []).join(', '),
          constraints: data.constraints || [],
          cuisines: data.cuisines || [],
          preferences: data.preferences || ''
        })
      }
      setLoading(false)
    }
    loadProfil()
  }, [])

  function toggleItem(list, item) {
    return list.includes(item) ? list.filter(i => i !== item) : [...list, item]
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const ages = form.children_ages.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    const { error } = await supabase.from('families').upsert({
      user_id: user.id,
      adults: parseInt(form.adults),
      children: parseInt(form.children),
      children_ages: ages,
      constraints: form.constraints,
      cuisines: form.cuisines,
      preferences: form.preferences,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  const counterBtn = (onClick) => ({
    width: 32, height: 32, borderRadius: '50%', border: 'none',
    background: 'var(--cream-dark)', color: 'var(--text)', fontFamily: "'Nunito', sans-serif",
    fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  })

  if (loading) return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--text-muted)' }}>Chargement...</p>
    </main>
  )

  return (
    <main style={{ maxWidth: 500, margin: '0 auto', padding: '24px 20px 80px' }}>
      <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Mon profil</h1>
      <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>{user?.email}</p>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Ma famille */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 16, marginTop: 0 }}>Ma famille</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {[{ label: 'Adultes', key: 'adults', min: 1, max: 6 }, { label: 'Enfants', key: 'children', min: 0, max: 6 }].map(({ label, key, min, max }) => (
              <div key={key}>
                <label style={{ display: 'block', marginBottom: 8, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, [key]: Math.max(min, f[key] - 1) }))} style={counterBtn()}>−</button>
                  <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--text)', minWidth: 24, textAlign: 'center' }}>{form[key]}</span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, [key]: Math.min(max, f[key] + 1) }))} style={counterBtn()}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Âges des enfants (séparés par des virgules)</label>
            <input type="text" placeholder="ex: 5, 8, 12" value={form.children_ages}
              onChange={e => setForm({ ...form, children_ages: e.target.value })}
              style={inputStyle} />
          </div>
        </div>

        {/* Contraintes */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12, marginTop: 0 }}>Contraintes alimentaires</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CONTRAINTES.map(c => {
              const active = form.constraints.includes(c)
              return (
                <span key={c} onClick={() => setForm({ ...form, constraints: toggleItem(form.constraints, c) })}
                  style={{ padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
                    background: active ? 'var(--green)' : 'var(--cream-dark)', color: active ? '#fff' : 'var(--text-muted)',
                    boxShadow: active ? '0 2px 0 var(--green-dark)' : 'none' }}>
                  {c}
                </span>
              )
            })}
          </div>
        </div>

        {/* Cuisines */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12, marginTop: 0 }}>Cuisines préférées</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CUISINES.map(c => {
              const active = form.cuisines.includes(c)
              return (
                <span key={c} onClick={() => setForm({ ...form, cuisines: toggleItem(form.cuisines, c) })}
                  style={{ padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
                    background: active ? 'var(--green)' : 'var(--cream-dark)', color: active ? '#fff' : 'var(--text-muted)',
                    boxShadow: active ? '0 2px 0 var(--green-dark)' : 'none' }}>
                  {c}
                </span>
              )
            })}
          </div>
        </div>

        {/* Préférences libres */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8, marginTop: 0 }}>Préférences libres</h2>
          <textarea
            placeholder="Ex. : pas de four, léger le soir, enfants n'aiment pas le poisson cru"
            value={form.preferences}
            onChange={e => setForm({ ...form, preferences: e.target.value })}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {saved && (
          <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, padding: '10px 14px', background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 10, margin: 0, fontWeight: 600 }}>
            ✓ Profil enregistré
          </p>
        )}

        <button type="submit" disabled={saving} style={{
          width: '100%', padding: '14px 24px',
          background: saving ? 'var(--cream-dark)' : 'var(--green)',
          color: saving ? 'var(--text-muted)' : '#fff',
          border: 'none', borderRadius: 12,
          fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 700,
          boxShadow: saving ? 'none' : '0 4px 0 var(--green-dark)',
          cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Enregistrement...' : 'Enregistrer →'}
        </button>
      </form>
    </main>
  )
}
