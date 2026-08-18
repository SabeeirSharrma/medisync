'use client'

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url.includes('YOUR_') || !url.includes('.supabase.co')) {
    return createStubClient()
  }

  client = createBrowserClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  return client
}

function createStubClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase is not configured' } }),
      signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase is not configured' } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: (table: string) => ({
      select: (cols?: string) => ({
        eq: (col: string, val: string) => ({
          single: async () => ({ data: null, error: null }),
          order: (col2: string, opts?: any) => ({
            data: [],
            error: null,
          }),
          data: [],
          error: null,
        }),
        order: (col: string, opts?: any) => ({
          data: [],
          error: null,
        }),
        data: [],
        error: null,
      }),
      insert: (row: any) => ({
        select: () => ({
          single: async () => ({ data: null, error: { message: 'Supabase is not configured' } }),
        }),
      }),
      update: (row: any) => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({ data: null, error: null }),
      }),
    }),
  } as any
}
