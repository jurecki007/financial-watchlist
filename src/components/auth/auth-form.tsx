"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthState } from "@/app/auth/actions";

type Mode = "signin" | "signup";

/**
 * Submit button owns its own pending state via useFormStatus, so the parent
 * does not re-render the whole form to show it. Label changes rather than
 * spinning: a spinner alone leaves the user guessing what is in flight.
 */
function Submit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="mt-2 h-11 w-full bg-[var(--gold)] text-sm font-medium tracking-tight text-[var(--ground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending ? busy : idle}
    </button>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  required = true,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[var(--dim)]">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-describedby={hint ? `${name}-hint` : undefined}
        // --field-border, not --rule-strong: the border is the only thing
        // marking where this control is, which puts it under the 3:1 non-text
        // requirement. --rule-strong measured 1.69:1 against the ground.
        // The placeholder moves off --faint for the same reason the hint does.
        className="h-11 w-full border border-[var(--field-border)] bg-[var(--raised)] px-3 text-[0.95rem] text-[var(--fg)] transition-colors placeholder:text-[var(--dim)] hover:border-[var(--dim)] focus:border-[var(--gold)] focus:outline-none"
      />
      {hint && (
        // Was --faint at 12px: 3.9:1 dark, 3.5:1 light — under the 4.5:1 floor
        // on the one line that explains what the field will accept.
        <span id={`${name}-hint`} className="mt-2 block text-xs text-[var(--dim)]">
          {hint}
        </span>
      )}
    </label>
  );
}

export function AuthForm({
  mode,
  action,
  googleAction,
  next,
}: {
  mode: Mode;
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  googleAction: (formData: FormData) => Promise<void>;
  next: string;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );
  const isSignUp = mode === "signup";

  return (
    <div className="rise">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="next" value={next} />

        {isSignUp && (
          <Field
            label="Display name"
            name="display_name"
            type="text"
            autoComplete="name"
            required={false}
            hint="Optional. We'll use the part before the @ if you skip it."
          />
        )}

        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
        />

        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          hint={isSignUp ? "At least 8 characters." : undefined}
        />

        {/* Error state. role=alert so it is announced, and it sits directly
            above the button that produced it rather than at the page top. */}
        {state?.error && (
          <p
            role="alert"
            // 1px, not 2px. A thick coloured left border is the category's
            // default alert costume; the copy and role="alert" carry the
            // meaning, and red here is already borrowed from price direction.
            className="border-l border-[var(--down)] bg-[var(--raised)] px-3 py-2.5 text-sm leading-relaxed text-[var(--fg)]"
          >
            {state.error}
          </p>
        )}

        <Submit
          idle={isSignUp ? "Create account" : "Sign in"}
          busy={isSignUp ? "Creating account…" : "Signing in…"}
        />
      </form>

      <div className="my-7 flex items-center gap-4">
        <span className="h-px flex-1 bg-[var(--rule)]" />
        {/* 3.9:1 dark and 3.52:1 light on --faint — under the floor, on a word
            that tells you the two paths are alternatives rather than steps. */}
        <span className="font-mono text-xs tracking-wider text-[var(--dim)]">
          OR
        </span>
        <span className="h-px flex-1 bg-[var(--rule)]" />
      </div>

      <form action={googleAction}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center gap-3 border border-[var(--field-border)] text-sm text-[var(--fg)] transition-colors hover:border-[var(--dim)] hover:bg-[var(--raised)]"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]">
            <path
              fill="#4285F4"
              d="M23.06 12.25c0-.79-.07-1.54-.2-2.27H12v4.3h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.41Z"
            />
            <path
              fill="#34A853"
              d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.540-2.02-6.45-4.74H1.71v2.98A11.5 11.5 0 0 0 12 23.5Z"
            />
            <path
              fill="#FBBC05"
              d="M5.55 14.18a6.9 6.9 0 0 1 0-4.36V6.84H1.71a11.51 11.51 0 0 0 0 10.32l3.84-2.98Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.28 15.1.25 12 .25A11.5 11.5 0 0 0 1.71 6.84l3.84 2.98C6.46 7.1 9 4.75 12 4.75Z"
            />
          </svg>
          Continue with Google
        </button>
      </form>
    </div>
  );
}
