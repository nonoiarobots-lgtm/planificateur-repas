'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Identifiants incorrects. Vérifiez votre email et mot de passe.')
      setLoading(false)
      return
    }

    router.push('/profil')
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Connexion</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Pas encore de compte ?{' '}
        <Link href="/auth/signup" style={{ color: '#0070f3' }}>S'inscrire</Link>
      </p>

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 12px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <img
                src={showPassword ? 'https://openmoji.org/data/color/svg/1F441.svg' : 'https://openmoji.org/data/color/svg/1F648.svg'}
                alt={showPassword ? 'Masquer' : 'Afficher'}
                style={{ width: 20, height: 20 }}
              />
            </button>
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
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </main>
  )
}
