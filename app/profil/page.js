'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const CONTRAINTES = ['Sans gluten', 'Sans lactose', 'Végétarien', 'Halal', 'Sans porc', 'Sans fruits de mer']
const CUISINES = ['Française', 'Méditerranéenne', 'Asiatique', 'Italienne', 'Marocaine', 'Indienne']

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '2px solid var(--cream-dark)',
  borderRadius: 10, fontFamily: "'Nunito', sans-serif", fontSize: 15,
  background: '#fff', color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

const cardStyle = {
  background: '#fff', border: '2px solid var(--cream-dark)',
  borderRadius: 14, boxShadow: '0 2px 14px rgba(44,36,22,0.06)', padding: '20px',
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function ProfilPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [user, setUser] = useState(null)
  const [family, setFamily] = useState(null)
  const [form, setForm] = useState({ adults: 2, children: 0, children_ages: '', constraints: [], cuisines: [], preferences: '' })

  // Nom de famille éditable
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('Notre famille')

  // Section compte
  const [showPwdForm, setShowPwdForm] = useState(false)
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [revealNew, setRevealNew] = useState(false)
  const [revealConfirm, setRevealConfirm] = useState(false)
  const [showLogout, setShowLogout] = useState(false)

  useEffect(() => {
    async function loadProfil() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
      const { data } = await supabase.from('families').select('*').eq('user_id', user.id).single()
      if (data) {
        setFamily(data)
        const name = data.name || 'Notre famille'
        setNameInput(name)
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

  async function confirmName() {
    const v = nameInput.trim()
    const finalName = v || (family?.name || 'Notre famille')
    if (!v) setNameInput(finalName)
    setEditingName(false)
    if (v && user) {
      await supabase.from('families').update({ name: v }).eq('user_id', user.id)
      setFamily(prev => ({ ...prev, name: v }))
    }
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

  async function handleChangePassword() {
    setPwdError('')
    if (pwdNew.length < 8) { setPwdError('Minimum 8 caractères'); return }
    if (pwdNew !== pwdConfirm) { setPwdError('Les mots de passe ne correspondent pas'); return }
    setPwdSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwdNew })
    setPwdSaving(false)
    if (error) { setPwdError(error.message); return }
    setPwdSuccess(true)
    setTimeout(() => {
      setShowPwdForm(false)
      setPwdNew('')
      setPwdConfirm('')
      setPwdError('')
      setPwdSuccess(false)
    }, 1500)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const counterBtn = {
    width: 32, height: 32, borderRadius: '50%', border: 'none',
    background: 'var(--cream-dark)', color: 'var(--text)', fontFamily: "'Nunito', sans-serif",
    fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  if (loading) return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--text-muted)' }}>Chargement...</p>
    </main>
  )

  return (
    <main style={{ maxWidth: 500, margin: '0 auto', padding: '24px 20px 80px' }}>

      {/* Nom de famille éditable */}
      {editingName ? (
        <input
          autoFocus
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onBlur={confirmName}
          onKeyDown={e => {
            if (e.key === 'Enter') confirmName()
            if (e.key === 'Escape') { setNameInput(family?.name || 'Notre famille'); setEditingName(false) }
          }}
          style={{
            fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--text)',
            background: 'transparent', border: 'none', borderBottom: '2px solid var(--green)',
            outline: 'none', width: '100%', padding: '0 0 2px', marginBottom: 4,
          }}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            {nameInput}
          </h1>
          <button onClick={() => setEditingName(true)} style={{
            background: 'var(--cream-dark)', border: 'none', borderRadius: 8,
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M9.5 1.5l2 2-7 7H2.5v-2l7-7z" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M8 3l2 2" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

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
                  <button type="button" onClick={() => setForm(f => ({ ...f, [key]: Math.max(min, f[key] - 1) }))} style={counterBtn}>−</button>
                  <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--text)', minWidth: 24, textAlign: 'center' }}>{form[key]}</span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, [key]: Math.min(max, f[key] + 1) }))} style={counterBtn}>+</button>
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

      {/* Section Mon compte */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14, marginTop: 0 }}>
            🔑 Mon compte
          </h2>

          {/* Email */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--cream-dark)' }}>
            <div>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 2px' }}>Adresse e-mail</p>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text)', fontWeight: 700, margin: 0 }}>{user?.email}</p>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--green-light)', fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 800, color: 'var(--green-dark)' }}>
              ✓ Vérifié
            </span>
          </div>

          {/* Changer le mot de passe */}
          <button
            type="button"
            onClick={() => { setShowPwdForm(!showPwdForm); setPwdError(''); setPwdNew(''); setPwdConfirm('') }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--text)',
              padding: '4px 0',
            }}
          >
            <span>Changer le mot de passe</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>{showPwdForm ? '‹' : '›'}</span>
          </button>

          {showPwdForm && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Nouveau mot de passe */}
              <div style={{ position: 'relative' }}>
                <input
                  type={revealNew ? 'text' : 'password'}
                  placeholder="Nouveau mot de passe"
                  value={pwdNew}
                  onChange={e => setPwdNew(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: pwdError ? 'var(--red)' : 'var(--cream-dark)',
                    paddingRight: 44,
                  }}
                />
                <button type="button" onClick={() => setRevealNew(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  <EyeIcon open={revealNew} />
                </button>
              </div>

              {/* Confirmer */}
              <div style={{ position: 'relative' }}>
                <input
                  type={revealConfirm ? 'text' : 'password'}
                  placeholder="Confirmer le nouveau mot de passe"
                  value={pwdConfirm}
                  onChange={e => setPwdConfirm(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: pwdError ? 'var(--red)' : 'var(--cream-dark)',
                    paddingRight: 44,
                  }}
                />
                <button type="button" onClick={() => setRevealConfirm(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  <EyeIcon open={revealConfirm} />
                </button>
              </div>

              {pwdError && (
                <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--red-dark)', background: 'var(--red-light)', borderRadius: 8, padding: '8px 12px', margin: 0 }}>
                  {pwdError}
                </p>
              )}
              {pwdSuccess && (
                <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--green-dark)', background: 'var(--green-light)', borderRadius: 8, padding: '8px 12px', margin: 0, fontWeight: 600 }}>
                  ✓ Mot de passe mis à jour !
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setShowPwdForm(false); setPwdNew(''); setPwdConfirm(''); setPwdError('') }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, border: '2px solid var(--cream-dark)',
                    background: '#fff', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}>
                  Annuler
                </button>
                <button type="button" onClick={handleChangePassword} disabled={pwdSaving}
                  style={{
                    flex: 2, padding: '10px', borderRadius: 10, border: 'none',
                    background: pwdSaving ? 'var(--cream-dark)' : 'var(--green)',
                    fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
                    color: pwdSaving ? 'var(--text-muted)' : '#fff',
                    cursor: pwdSaving ? 'not-allowed' : 'pointer',
                    boxShadow: pwdSaving ? 'none' : '0 3px 0 var(--green-dark)',
                  }}>
                  {pwdSaving ? 'Mise à jour...' : 'Mettre à jour'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Déconnexion */}
        {!showLogout ? (
          <button
            type="button"
            onClick={() => setShowLogout(true)}
            style={{
              width: '100%', padding: '12px 20px',
              background: 'var(--red-light)', border: '2px solid var(--red-light)',
              borderRadius: 12, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700,
              color: 'var(--red-dark)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            🚪 Se déconnecter
          </button>
        ) : (
          <div style={{ ...cardStyle, borderColor: 'var(--red-light)', background: 'var(--red-light)' }}>
            <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--red-dark)', marginBottom: 12, marginTop: 0 }}>
              Se déconnecter de FamiliMeals ?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowLogout(false)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: '2px solid rgba(0,0,0,0.1)',
                  background: '#fff', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}>
                Annuler
              </button>
              <button type="button" onClick={handleLogout}
                style={{
                  flex: 2, padding: '10px', borderRadius: 10, border: 'none',
                  background: 'var(--red)', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
                  color: '#fff', cursor: 'pointer',
                  boxShadow: '0 3px 0 var(--red-dark)',
                }}>
                Oui, me déconnecter
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
