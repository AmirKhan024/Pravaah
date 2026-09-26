/*
 * Supabase clients (Phase 2). Two clients, two trust levels:
 *  - supabaseAdmin(): service-role key, server-only, bypasses RLS. Every write goes through this,
 *    from API routes only — the key never reaches the browser.
 *  - supabaseBrowser(): publishable/anon key, safe to ship to the client, used only to subscribe
 *    to Realtime changes (the RLS policies in supabase/schema.sql grant it read-only SELECT).
 *
 * `supabaseConfigured()` is the one place that decides whether Supabase is usable at all. Every
 * caller checks it first and falls back to the pre-existing in-memory behaviour when it's false —
 * per the brief, Supabase being unreachable or unconfigured must never fully break the demo.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export function supabaseConfigured(): boolean {
  return !!URL && !!ANON_KEY && process.env.NEXT_PUBLIC_DEMO_OFFLINE !== '1';
}

let admin: SupabaseClient | null = null;
/** server-only — never import this file's admin client from a 'use client' component */
export function supabaseAdmin(): SupabaseClient | null {
  if (!URL || !SERVICE_KEY) return null;
  if (!admin) admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
  return admin;
}

let browser: SupabaseClient | null = null;
export function supabaseBrowser(): SupabaseClient | null {
  if (!URL || !ANON_KEY) return null;
  if (!browser) browser = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
  return browser;
}
