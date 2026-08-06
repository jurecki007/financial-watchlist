"use server";

import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/auth/site-url";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/routes";

export type AuthState = { error?: string } | undefined;

/**
 * Server actions, so the session cookie is written in the same request that
 * establishes it and the redirect cannot be skipped by a client that fails to
 * navigate.
 */

/**
 * Supabase's own messages leak account existence — "User already registered"
 * tells an attacker which addresses have accounts. Mapped to copy that names
 * the recovery without confirming anything.
 */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password combination doesn't match an account.";
  }
  if (m.includes("email not confirmed")) {
    return "Check your inbox and confirm your email address first.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "If that address doesn't have an account yet, we've sent a confirmation link.";
  }
  if (m.includes("password")) {
    return "Passwords need to be at least 8 characters.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return "Something went wrong signing you in. Try again in a moment.";
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (error) return { error: friendly(error.message) };

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(formData.get("next")));
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const origin = await siteUrl();

  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      // handle_new_user() reads this to seed profiles.display_name. Falls back
      // to the local part of the address when left blank.
      data: { full_name: String(formData.get("display_name") ?? "") || null },
    },
  });

  if (error) return { error: friendly(error.message) };

  redirect("/login?checkEmail=1");
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const origin = await siteUrl();
  const next = safeRedirectPath(formData.get("next"));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
