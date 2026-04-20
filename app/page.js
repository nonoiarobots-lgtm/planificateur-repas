import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'

export default async function Home() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: family } = await supabase
    .from('families')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  redirect(family ? '/planning' : '/profil')
}
