'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError("Erreur lors de l'inscription. Réessayez.")
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Vérifiez votre email</h1>
        <p style={{ color: '#666', lineHeight: 1.6 }}>
          Un email de confirmation a été envoyé à <strong>{email}</strong>.
          Cliquez sur le lien pour activer votre compte.
        </p>
      </main>
    )
  }

  const eyeButton = (show, toggle) => (
    <button
      type="button"
      onClick={toggle}
      style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 12px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
    >
      <img
        src={show ? 'https://openmoji.org/data/color/svg/1F441.svg' : 'https://openmoji.org/data/color/svg/1F648.svg'}
        alt={show ? 'Masquer' : 'Afficher'}
        style={{ width: 20, height: 20 }}
      />
    </button>
  )

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Créer un compte</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Déjà un compte ?{' '}
        <Link href="/auth/login" style={{ color: '#0070f3' }}>Se connecter</Link>
      </p>

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Mot de passe</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 44px 10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
            />
            {eyeButton(showPassword, () => setShowPassword(v => !v))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Confirmer le mot de passe</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 44px 10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
            />
            {eyeButton(showConfirm, () => setShowConfirm(v => !v))}
          </div>
        </div>

        {error && (
          <p style={{ color: '#e00', fontSize: 14, padding: '10px 12px', background: '#fff0f0', borderRadius: 8 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ padding: '12px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Inscription...' : 'Créer mon compte'}
        </button>
      </form>
    </main>
  )
}
