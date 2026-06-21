"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { UserRole } from "@/types";
import { Briefcase, Users, Star, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("candidate");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company: role === "recruiter" ? company : undefined, email, password, role }),
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

  const isRecruiter = role === "recruiter";

  return (
    <div className="min-h-screen flex">
      {/* Left branded panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-700 to-blue-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-16">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Briefcase size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">BestHire</span>
          </div>
          <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Join thousands already<br />hiring smarter.
          </h2>
          <p className="text-emerald-100 text-base leading-relaxed mb-10">
            Whether you&apos;re looking for your next role or your next hire, BestHire&apos;s AI does the heavy lifting.
          </p>

          {/* Role benefit cards */}
          <div className="space-y-3">
            <div className={`rounded-2xl p-4 border transition-all ${!isRecruiter ? "bg-white/20 border-white/30" : "bg-white/5 border-white/10"}`}>
              <div className="flex items-center gap-3 mb-1">
                <Users size={16} className="text-emerald-200" />
                <span className="text-sm font-bold text-white">For Candidates</span>
              </div>
              <p className="text-xs text-emerald-100">Upload once, get matched to every open role automatically with AI-powered fit scores.</p>
            </div>
            <div className={`rounded-2xl p-4 border transition-all ${isRecruiter ? "bg-white/20 border-white/30" : "bg-white/5 border-white/10"}`}>
              <div className="flex items-center gap-3 mb-1">
                <Briefcase size={16} className="text-emerald-200" />
                <span className="text-sm font-bold text-white">For Recruiters</span>
              </div>
              <p className="text-xs text-emerald-100">Post jobs with unique Position IDs, review AI-ranked candidates, and schedule interviews in one click.</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="relative grid grid-cols-3 gap-3">
          {[["5+", "Jobs posted"], ["15+", "Applications"], ["3", "Candidates hired"]].map(([val, lbl]) => (
            <div key={lbl} className="bg-white/10 border border-white/20 rounded-2xl p-4 text-center">
              <p className="text-xl font-bold text-white">{val}</p>
              <p className="text-xs text-emerald-200 mt-0.5">{lbl}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
              <Briefcase size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">BestHire</span>
          </div>

          <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Create your account</h1>
          <p className="text-sm text-gray-500 mb-8">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
          </p>

          {/* Role toggle */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6 p-1 bg-white gap-1">
            {(["candidate", "recruiter"] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg capitalize transition-all ${
                  role === r
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="Jane Smith" />
            </div>

            {isRecruiter && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  placeholder="Acme Corp" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="you@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="Min. 8 characters" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm mt-2">
              {loading ? "Creating account…" : `Join as ${isRecruiter ? "Recruiter" : "Candidate"}`}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            {["Free to use", "No credit card", "AI-powered"].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-xs text-gray-400">
                <Star size={11} className="text-amber-400 fill-amber-400" />
                {t}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
              <CheckCircle size={13} className="text-green-500" />
              Secured by Firebase Authentication
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
