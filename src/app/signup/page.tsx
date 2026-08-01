import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { signUp, signInWithGoogle } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = { title: "Create account — Financial Watchlist" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthShell
      title="Create account"
      lede="Track companies, watch prices and charts, read the news that moves them."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--gold)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <AuthForm
        mode="signup"
        action={signUp}
        googleAction={signInWithGoogle}
        next={next ?? "/dashboard"}
      />
    </AuthShell>
  );
}
