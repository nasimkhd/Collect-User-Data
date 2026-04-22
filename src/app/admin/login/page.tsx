import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        action="/api/login"
        method="POST"
        className="w-full max-w-sm card space-y-5"
      >
        <h1 className="text-2xl font-black text-brand-ink">Admin access</h1>
        <p className="text-sm text-brand-inkMuted">
          Enter the admin password to view and export submissions.
        </p>
        <input
          type="password"
          name="password"
          placeholder="Admin password"
          className="input"
          autoFocus
          required
        />
        {error && (
          <div className="text-sm text-brand-danger font-semibold">
            Incorrect password. Please try again.
          </div>
        )}
        <button type="submit" className="btn-primary w-full">
          Sign in
        </button>
      </form>
    </main>
  );
}
