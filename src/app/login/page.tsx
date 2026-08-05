import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { signIn, signInWithGoogle } from "@/app/auth/actions";
import { AuthShell, Notice } from "@/components/auth/auth-shell";

// The canonical is param-free on purpose. The auth gate redirects here as
// /login?next=%2Fdashboard, /login?next=%2Fnews and so on, so this page has as
// many URL variants as there are protected routes; they are all the same page.
export const metadata: Metadata = {
  title: "Sign in — Financial Watchlist",
  alternates: { canonical: "/login" },
  // A sign-in form is 29 words of interface with nothing to answer a search
  // with. `follow` stays on so the crawl continues through to /roadmap and the
  // landing page rather than dead-ending here — this is the page the auth gate
  // redirects every protected route to, so it is the most-linked URL on the
  // site and the worst one to make a trap.
  robots: { index: false, follow: true },
};

const CALLBACK_ERRORS: Record<string, string> = {
  oauth: "Google sign-in couldn't be started. Try again, or use your email.",
  missing_code: "That sign-in link is incomplete. Request a new one.",
  exchange_failed:
    "That sign-in link has expired or was already used. Request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; checkEmail?: string }>;
}) {
  const { next, error, checkEmail } = await searchParams;

  return (
    <AuthShell
      title="Sign in"
      lede={
        next
          ? "You'll need an account to see that page."
          : "Pick up your watchlist where you left it."
      }
      footer={
        <>
          No account yet?{" "}
          <Link href="/signup" className="text-[var(--gold)] hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {checkEmail && (
        <Notice tone="info">
          Check your inbox for a confirmation link, then sign in.
        </Notice>
      )}
      {error && CALLBACK_ERRORS[error] && (
        <Notice tone="error">{CALLBACK_ERRORS[error]}</Notice>
      )}

      <AuthForm
        mode="signin"
        action={signIn}
        googleAction={signInWithGoogle}
        next={next ?? "/dashboard"}
      />
    </AuthShell>
  );
}
