'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import BackButton from '@/app/components/BackButton'

export default function RecettePage() {
  const router = useRouter()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [recipe, setRecipe] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [steps, setSteps] = useState(null)
  const [planningId, setPlanningId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: rec } = await supabase
        .from('recipes')
        .select('*, recipe_ingredients(*)')
        .eq('id', id)
        .single()

      if (!rec) { router.push('/planning'); return }
      setRecipe(rec)
      setIngredients(rec.recipe_ingredients || [])

      const { data: slot } = await supabase
        .from('planning_slots')
        .select('planning_id')
        .eq('recipe_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (slot) setPlanningId(slot.planning_id)

      if (rec.steps) {
        setSteps(rec.steps)
        setLoading(false)
      } else {
        setLoading(false)
        setGenerating(true)
        try {
          const res = await fetch('/api/generate-recipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId: id })
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Erreur serveur')
          setSteps(data.steps)
        } catch (err) {
          setError(err.message)
        } finally {
          setGenerating(false)
        }
      }
    }
    load()
  }, [id])

  if (loading) return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--text-muted)' }}>Chargement...</p>
    </main>
  )

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px 80px' }}>
      <BackButton label="Retour au menu" href={planningId ? `/menu/${planningId}` : null} />

      {/* Header recette */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {recipe.emoji_unicode && (
          <img src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${recipe.emoji_unicode}.svg`} alt="" style={{ width: 40, height: 40, flexShrink: 0 }} />
        )}
        <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
          {recipe.name}
        </h1>
      </div>

      {/* Pills info */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {recipe.prep_time && (
          <span style={{ padding: '5px 14px', borderRadius: 20, background: 'var(--cream-dark)', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            ⏱ Prépa : {recipe.prep_time}
          </span>
        )}
        {recipe.cook_time && (
          <span style={{ padding: '5px 14px', borderRadius: 20, background: 'var(--cream-dark)', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            🍳 Cuisson : {recipe.cook_time}
          </span>
        )}
        {recipe.portions && (
          <span style={{ padding: '5px 14px', borderRadius: 20, background: 'var(--cream-dark)', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            👥 {recipe.portions} pers.
          </span>
        )}
      </div>

      {/* Ingrédients */}
      {ingredients.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Ingrédients</h2>
          <div style={{ background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(44,36,22,0.06)' }}>
            {ingredients.map((ing, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px',
                borderBottom: i < ingredients.length - 1 ? '1px solid var(--cream-dark)' : 'none',
              }}>
                <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 15, color: 'var(--text)' }}>{ing.name}</span>
                <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 800, color: 'var(--text-muted)' }}>{ing.quantity} {ing.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Préparation */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Préparation</h2>

        {generating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', background: 'var(--green-light)', borderRadius: 12 }}>
            <span style={{ width: 18, height: 18, border: '3px solid var(--green-dark)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--green-dark)' }}>Génération de la recette en cours... ✨</span>
          </div>
        )}

        {error && (
          <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, padding: '10px 14px', background: 'var(--red-light)', color: 'var(--red-dark)', borderRadius: 10 }}>{error}</p>
        )}

        {steps && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {steps.map((step) => (
              <div key={step.numero} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%', background: 'var(--green)',
                  color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: "'Nunito', sans-serif",
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  boxShadow: '0 2px 0 var(--green-dark)',
                }}>
                  {step.numero}
                </span>
                <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 15, lineHeight: 1.6, margin: 0, paddingTop: 3, color: 'var(--text)' }}>
                  {step.instruction}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conseil du chef */}
      {recipe.tip && (
        <div style={{ padding: '14px 16px', background: 'var(--orange-light)', borderRadius: 12, borderLeft: '4px solid var(--orange)' }}>
          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800, color: 'var(--orange-dark)', display: 'block', marginBottom: 4 }}>
            ✨ Conseil du chef
          </span>
          <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, margin: 0, color: 'var(--text)', lineHeight: 1.5 }}>{recipe.tip}</p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
