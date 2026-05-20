import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AppLayout } from '@/components/layout'
import { ApiKeysList } from '@/components/settings/api-keys-list'
import { ChevronRight } from 'lucide-react'

export default async function ApiKeysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, name, email, avatar_url, theme')
    .eq('auth_user_id', user.id)
    .single()

  if (!trainer) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  const { data: keys } = await supabaseAdmin
    .from('trainer_api_keys')
    .select('id, name, key_prefix, created_at, last_used_at')
    .eq('trainer_id', trainer.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  return (
    <AppLayout
      trainerName={trainer.name}
      trainerEmail={trainer.email}
      trainerAvatarUrl={trainer.avatar_url}
      trainerTheme={trainer.theme ?? undefined}
    >
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-[10px] text-k-text-quaternary font-bold">
          <span>Painel</span>
          <ChevronRight size={10} strokeWidth={3} />
          <span>Minha Conta</span>
          <ChevronRight size={10} strokeWidth={3} />
          <span>Conectar com IA</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-b from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">
          Conectar com IA
        </h1>
        <p className="mt-1 text-sm text-k-text-tertiary">
          Gerencie suas API Keys para conectar o Kinevo ao Claude.ai ou ChatGPT.
        </p>
      </div>

      <div className="max-w-2xl">
        <ApiKeysList initialKeys={keys ?? []} />
      </div>
    </AppLayout>
  )
}
