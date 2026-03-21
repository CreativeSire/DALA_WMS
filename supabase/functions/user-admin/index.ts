import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type UserAdminPayload = {
  action: 'invite' | 'create'
  email: string
  full_name: string
  role: 'admin' | 'warehouse_manager' | 'operations' | 'finance' | 'security'
  password?: string
  redirectTo?: string
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing authorization header.' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) {
      return json({ error: 'Invalid session.' }, 401)
    }

    const { data: callerProfile, error: callerError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (callerError || callerProfile?.role !== 'admin') {
      return json({ error: 'Only admin users can manage system users.' }, 403)
    }

    const payload = await req.json() as UserAdminPayload
    if (!payload.email || !payload.full_name || !payload.role || !payload.action) {
      return json({ error: 'Missing required fields.' }, 400)
    }

    if (payload.action === 'create' && (!payload.password || payload.password.length < 8)) {
      return json({ error: 'Temporary password must be at least 8 characters.' }, 400)
    }

    let userId: string | undefined

    if (payload.action === 'invite') {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(payload.email, {
        data: { full_name: payload.full_name, role: payload.role },
        redirectTo: payload.redirectTo,
      })

      if (error) return json({ error: error.message }, 400)
      userId = data.user?.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password!,
        email_confirm: true,
        user_metadata: { full_name: payload.full_name, role: payload.role },
      })

      if (error) return json({ error: error.message }, 400)
      userId = data.user?.id
    }

    if (userId) {
      const { error: upsertError } = await admin.from('profiles').upsert({
        id: userId,
        email: payload.email,
        full_name: payload.full_name,
        role: payload.role,
        is_active: true,
      }, { onConflict: 'id' })

      if (upsertError) return json({ error: upsertError.message }, 400)
    }

    return json({
      message: payload.action === 'invite'
        ? `Invite sent to ${payload.email}.`
        : `User ${payload.full_name} created successfully.`,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})

function json(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
