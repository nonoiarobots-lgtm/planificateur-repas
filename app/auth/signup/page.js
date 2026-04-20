'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '2px solid var(--cream-dark)',
  borderRadius: 10, fontFamily: "'Nunito', sans-serif", fontSize: 15,
  background: '#fff', color: 'var(--text)', outline: 'none',
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError("Erreur lors de l'inscription. Réessayez."); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
  }

  const eyeBtn = (show, toggle) => (
    <button type="button" onClick={toggle}
      style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 12px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
      <img src={show ? 'https://openmoji.org/data/color/svg/1F441.svg' : 'https://openmoji.org/data/color/svg/1F648.svg'} alt="" style={{ width: 20, height: 20 }} />
    </button>
  )

  if (success) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: '0 24px' }}>
        <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, boxShadow: '0 2px 14px rgba(44,36,22,0.08)', padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--green-dark)', marginBottom: 12 }}>Vérifiez votre email</h1>
          <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Un email de confirmation a été envoyé à <strong style={{ color: 'var(--text)' }}>{email}</strong>.
            Cliquez sur le lien pour activer votre compte.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, boxShadow: '0 2px 14px rgba(44,36,22,0.08)', padding: 32 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="https://openmoji.org/data/color/svg/1F957.svg" alt="" style={{ width: 48, height: 48, marginBottom: 8 }} />
          <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--green-dark)', margin: 0 }}>FamiliMeals</h1>
          <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 0' }}>Créer votre compte famille</p>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required style={{ ...inputStyle, paddingRight: 48 }} />
              {eyeBtn(showPassword, () => setShowPassword(v => !v))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Confirmer le mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required style={{ ...inputStyle, paddingRight: 48 }} />
              {eyeBtn(showConfirm, () => setShowConfirm(v => !v))}
            </div>
          </div>

          {error && <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, padding: '10px 14px', background: 'var(--red-light)', color: 'var(--red-dark)', borderRadius: 10, margin: 0 }}>{error}</p>}

          <button type="submit" disabled={loading} style={{
            background: loading ? 'var(--cream-dark)' : 'var(--green)', color: loading ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 12, padding: '13px 24px',
            fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 700,
            boxShadow: loading ? 'none' : '0 4px 0 var(--green-dark)',
            cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
          }}>
            {loading ? 'Inscription...' : 'Créer mon compte'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)' }}>
          Déjà un compte ?{' '}
          <Link href="/auth/login" style={{ color: 'var(--green-dark)', fontWeight: 700, textDecoration: 'none' }}>Se connecter</Link>
        </p>
      </div>
    </main>
  )
}
