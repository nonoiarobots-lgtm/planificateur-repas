'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const CONTRAINTES = ['Sans gluten', 'Sans lactose', 'Végétarien', 'Halal', 'Sans porc', 'Sans fruits de mer']
const CUISINES = ['Française', 'Méditerranéenne', 'Asiatique', 'Italienne', 'Marocaine', 'Indienne']

export default function ProfilPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({
    adults: 2,
    children: 0,
    children_ages: '',
    constraints: [],
    cuisines: []
  })

  useEffect(() => {
    async function loadProfil() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)

      const { data } = await supabase
        .from('families')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setForm({
          adults: data.adults,
          children: data.children,
          children_ages: (data.children_ages || []).join(', '),
          constraints: data.constraints || [],
          cuisines: data.cuisines || []
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

    const ages = form.children_ages
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n))

    const payload = {
      user_id: user.id,
      adults: parseInt(form.adults),
      children: parseInt(form.children),
      children_ages: ages,
      constraints: form.constraints,
      cuisines: form.cuisines,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('families')
      .upsert(payload, { onConflict: 'user_id' })

    setSaving(false)
    if (!error) router.push('/planning')
  }

  if (loading) return <p style={{ padding: 40, fontFamily: 'Arial' }}>Chargement...</p>

  const tag = (active) => ({
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid',
    borderColor: active ? '#0070f3' : '#ddd',
    background: active ? '#e8f0fe' : '#fff',
    color: active ? '#0070f3' : '#555',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: active ? 500 : 400,
    margin: '4px'
  })

  return (
    <main style={{ maxWidth: 500, margin: '60px auto', padding: '0 24px', fontFamily: 'Arial' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>Profil famille</h1>
      <p style={{ color: '#666', marginBottom: 32, fontSize: 14 }}>{user?.email}</p>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Adultes</label>
            <input type="number" min="1" max="6" value={form.adults}
              onChange={e => setForm({ ...form, adults: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Enfants</label>
            <input type="number" min="0" max="6" value={form.children}
              onChange={e => setForm({ ...form, children: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Âges des enfants (séparés par des virgules)</label>
          <input type="text" placeholder="ex: 5, 8, 12" value={form.children_ages}
            onChange={e => setForm({ ...form, children_ages: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 10, fontSize: 14, fontWeight: 500 }}>Contraintes alimentaires</label>
          <div>
            {CONTRAINTES.map(c => (
              <span key={c} style={tag(form.constraints.includes(c))}
                onClick={() => setForm({ ...form, constraints: toggleItem(form.constraints, c) })}>
                {c}
              </span>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 10, fontSize: 14, fontWeight: 500 }}>Cuisines préférées</label>
          <div>
            {CUISINES.map(c => (
              <span key={c} style={tag(form.cuisines.includes(c))}
                onClick={() => setForm({ ...form, cuisines: toggleItem(form.cuisines, c) })}>
                {c}
              </span>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving}
          style={{ padding: '12px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Enregistrement...' : 'Enregistrer et continuer →'}
        </button>

      </form>
    </main>
  )
}