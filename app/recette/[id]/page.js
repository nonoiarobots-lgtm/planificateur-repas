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

  if (loading) return <p style={{ padding: 40, fontFamily: 'Arial' }}>Chargement...</p>

  const badge = (label) => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    background: '#f0f0f0', color: '#555', fontSize: 12, marginRight: 6
  })

  return (
    <main style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px', fontFamily: 'Arial' }}>
      <BackButton label="Retour au menu" href={planningId ? `/menu/${planningId}` : null} />

      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>{recipe.name}</h1>

      <div style={{ marginBottom: 20 }}>
        {recipe.prep_time && <span style={badge()}>⏱ Prépa : {recipe.prep_time}</span>}
        {recipe.cook_time && <span style={badge()}>🍳 Cuisson : {recipe.cook_time}</span>}
        {recipe.portions && <span style={badge()}>👥 {recipe.portions} pers.</span>}
      </div>

      {ingredients.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Ingrédients</h2>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden' }}>
            {ingredients.map((ing, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 14px', fontSize: 14,
                borderBottom: i < ingredients.length - 1 ? '1px solid #f0f0f0' : 'none'
              }}>
                <span>{ing.name}</span>
                <span style={{ color: '#888', fontSize: 13 }}>{ing.quantity} {ing.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Préparation</h2>
        {generating && (
          <p style={{ color: '#666', fontSize: 14, padding: '16px', background: '#f5f5f5', borderRadius: 10 }}>
            Génération de la recette en cours...
          </p>
        )}
        {error && (
          <p style={{ color: '#e00', fontSize: 14, padding: '10px 12px', background: '#fff0f0', borderRadius: 8 }}>{error}</p>
        )}
        {steps && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((step) => (
              <div key={step.numero} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', background: '#0070f3',
                  color: '#fff', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {step.numero}
                </span>
                <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, paddingTop: 4 }}>{step.instruction}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {recipe.tip && (
        <div style={{ padding: '12px 14px', background: '#FFF9E6', borderRadius: 10, borderLeft: '3px solid #F5A623' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#B8811A' }}>Conseil du chef</span>
          <p style={{ fontSize: 14, margin: '4px 0 0', color: '#555' }}>{recipe.tip}</p>
        </div>
      )}
    </main>
  )
}
