"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { UserRole } from "@/types";
import { Briefcase, Brain, TrendingUp, Calendar, CheckCircle, Star } from "lucide-react";

type Tab = "signin" | "signup";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "signin";
  const from = searchParams.get("from");

  const [tab, setTab] = useState<Tab>(initialTab);
  const [role, setRole] = useState<UserRole>("candidate");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchTab(t: Tab) {
    setTab(t);
    setError("");
  }

  async function handleSignIn(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idTokenResult = await credential.user.getIdTokenResult();
      const userRole = idTokenResult.claims.role as UserRole;
      document.cookie = `token=${idTokenResult.token}; path=/; SameSite=Strict`;
      if (from) router.push(from);
      else if (userRole === "recruiter") router.push("/recruiter/dashboard");
      else router.push("/candidate/dashboard");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company: role === "recruiter" ? company : undefined,
          email,
          password,
          role,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Registration failed");
      }
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idTokenResult = await credential.user.getIdTokenResult();
      document.cookie = `token=${idTokenResult.token}; path=/; SameSite=Strict`;
      router.push(role === "recruiter" ? "/recruiter/dashboard" : "/candidate/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left branded panel ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-800">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Briefcase size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-white">BestHire</span>
        </div>

        {/* Photo + headline */}
        <div className="relative flex-1 flex flex-col justify-center gap-8 py-10">
          <div>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-3">
              {tab === "signin"
                ? "Welcome back.\nLet's find your\nnext great match."
                : "Join thousands\nalready hiring\nsmarter."}
            </h2>
            <p className="text-indigo-200 text-sm leading-relaxed max-w-sm">
              AI-powered matching puts the right people in the right roles — faster than ever before.
            </p>
          </div>

          {/* Recruitment photo */}
          <div className="relative h-52 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <Image
              src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80&fit=crop"
              alt="Professional handshake"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
              <span className="text-white text-xs font-semibold">Deal closed ✓</span>
              <div className="flex -space-x-1.5">
                {["A", "B", "C"].map((l, i) => (
                  <div key={l} className={`w-6 h-6 rounded-full border-2 border-white/60 flex items-center justify-center text-white text-[9px] font-bold ${["bg-blue-400","bg-violet-400","bg-emerald-400"][i]}`}>{l}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature bullets */}
          <div className="space-y-3">
            {[
              { icon: Brain, text: "Resume parsed & scored by Claude AI" },
              { icon: TrendingUp, text: "ML model that improves with every decision" },
              { icon: Calendar, text: "Automatic interview scheduling" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
                  <Icon size={13} className="text-indigo-200" />
                </div>
                <span className="text-sm text-indigo-100">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm shrink-0">A</div>
            <div>
              <p className="text-white font-semibold text-sm">Alice Chen</p>
              <p className="text-indigo-300 text-xs">Senior Engineer · Hired via BestHire</p>
            </div>
            <div className="ml-auto flex">
              {[...Array(5)].map((_, i) => <span key={i} className="text-amber-400 text-xs">★</span>)}
            </div>
          </div>
          <p className="text-indigo-100 text-xs leading-relaxed">
            &ldquo;Got matched and had an interview scheduled within 24 hours of uploading my resume.&rdquo;
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Briefcase size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">BestHire</span>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-8 p-1 bg-white gap-1">
            {(["signin", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchTab(t)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  tab === t
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "signin" ? "Sign in" : "Get started"}
              </button>
            ))}
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
            {tab === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-gray-500 mb-7">
            {tab === "signin"
              ? "Sign in to access your dashboard."
              : "Free forever. No credit card required."}
          </p>

          {/* ── SIGN IN FORM ── */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="••••••••" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <p className="text-center text-sm text-gray-500 pt-1">
                No account yet?{" "}
                <button type="button" onClick={() => switchTab("signup")} className="text-blue-600 font-semibold hover:underline">
                  Sign up free
                </button>
              </p>
            </form>
          )}

          {/* ── SIGN UP FORM ── */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Role picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">I am a…</label>
                <div className="flex rounded-xl overflow-hidden border border-gray-200 p-1 bg-white gap-1">
                  {(["candidate", "recruiter"] as UserRole[]).map((r) => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-lg capitalize transition-all ${
                        role === r ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="Jane Smith" />
              </div>
              {role === "recruiter" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
                  <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Acme Corp" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="Min. 8 characters" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                {loading ? "Creating account…" : `Join as ${role === "recruiter" ? "Recruiter" : "Candidate"}`}
              </button>
              <div className="flex justify-center gap-4 pt-1">
                {["Free to use", "No credit card", "AI-powered"].map((t) => (
                  <div key={t} className="flex items-center gap-1 text-xs text-gray-400">
                    <Star size={10} className="text-amber-400 fill-amber-400" />{t}
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-gray-500">
                Already have an account?{" "}
                <button type="button" onClick={() => switchTab("signin")} className="text-blue-600 font-semibold hover:underline">
                  Sign in
                </button>
              </p>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400 justify-center">
            <CheckCircle size={13} className="text-green-500" />
            Secured by Firebase Authentication
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
