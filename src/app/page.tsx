import Image from "next/image";
import Link from "next/link";
import { Briefcase, Brain, Calendar, Users, TrendingUp, Shield, ArrowRight, CheckCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Briefcase size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">BestHire</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="text-sm bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — split layout */}
      <section className="relative pt-20 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 min-h-screen flex items-center">
        {/* Background blobs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center w-full">
          {/* Left — text panel */}
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              Powered by Claude AI
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
              Hire smarter.<br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Get hired faster.
              </span>
            </h1>
            <p className="text-lg text-slate-300 mb-10 leading-relaxed max-w-lg">
              BestHire uses AI to match candidates to the right roles — scoring resumes, surfacing top talent, and scheduling interviews automatically.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link href="/register?role=candidate" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-slate-900 font-bold rounded-xl hover:bg-blue-50 transition-colors shadow-lg text-sm">
                Find your next role <ArrowRight size={16} />
              </Link>
              <Link href="/register?role=recruiter" className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors shadow-lg border border-blue-400/30 text-sm">
                Start hiring today <ArrowRight size={16} />
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-sm">
              {[
                { value: "98%", label: "Match accuracy" },
                { value: "3×", label: "Faster screening" },
                { value: "24/7", label: "AI availability" },
              ].map(({ value, label }) => (
                <div key={label} className="bg-white/5 border border-white/10 rounded-2xl px-3 py-4 backdrop-blur-sm text-center">
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — photo collage */}
          <div className="relative hidden lg:block">
            {/* Main handshake photo */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 h-[420px]">
              <Image
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&q=80&fit=crop"
                alt="Professional handshake"
                fill
                className="object-cover"
                priority
              />
              {/* gradient overlay to blend with dark bg */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
            </div>

            {/* Secondary photo — overlapping bottom-left */}
            <div className="absolute -bottom-8 -left-8 w-52 h-40 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 ring-4 ring-slate-900">
              <Image
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80&fit=crop"
                alt="Recruiter reviewing candidates"
                fill
                className="object-cover"
              />
            </div>

            {/* Tertiary photo — top-right */}
            <div className="absolute -top-6 -right-6 w-44 h-36 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 ring-4 ring-slate-900">
              <Image
                src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=400&q=80&fit=crop"
                alt="Team collaboration"
                fill
                className="object-cover"
              />
            </div>

            {/* Floating "match found" badge */}
            <div className="absolute top-6 left-6 bg-white/95 backdrop-blur rounded-2xl shadow-xl px-4 py-3 border border-gray-100 flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">Match found!</p>
                <p className="text-xs text-gray-400">Score 84 · Senior Engineer</p>
              </div>
            </div>

            {/* Floating avatars row */}
            <div className="absolute bottom-16 right-4 bg-white/95 backdrop-blur rounded-2xl shadow-xl px-4 py-2.5 border border-gray-100 flex items-center gap-2">
              <div className="flex -space-x-2">
                {["A", "B", "C"].map((l, i) => (
                  <div key={l} className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold ${["bg-blue-500", "bg-violet-500", "bg-emerald-500"][i]}`}>{l}</div>
                ))}
              </div>
              <span className="text-xs font-semibold text-gray-700">+12 applicants today</span>
            </div>
          </div>
        </div>
      </section>

      {/* Floating feature cards row */}
      <section className="relative -mt-8 z-10 max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Brain, color: "from-blue-500 to-cyan-500", bg: "bg-blue-50", title: "AI Resume Parsing", desc: "Claude extracts skills, experience, and education from any resume in seconds." },
            { icon: TrendingUp, color: "from-violet-500 to-purple-500", bg: "bg-violet-50", title: "Fit Score Engine", desc: "Logistic regression learns from recruiter decisions to rank candidates better over time." },
            { icon: Calendar, color: "from-emerald-500 to-teal-500", bg: "bg-emerald-50", title: "Auto Scheduling", desc: "Approved candidates get Google Calendar interview invites created automatically." },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg`}>
                <Icon size={22} className="text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-4xl font-bold text-gray-900">From upload to interview in minutes</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Steps */}
          <div className="space-y-8">
            {[
              { step: "01", title: "Upload your resume", desc: "Drag and drop your PDF. Claude AI parses skills, work history, and education instantly.", color: "bg-blue-600" },
              { step: "02", title: "Get matched & scored", desc: "Your profile is scored against every open role. The ML model improves with every recruiter decision.", color: "bg-indigo-600" },
              { step: "03", title: "Recruiters review", desc: "Recruiters see ranked candidates with AI reasoning. One click to approve or reject.", color: "bg-violet-600" },
              { step: "04", title: "Interview scheduled", desc: "Approved? A Google Calendar invite lands in your inbox within seconds.", color: "bg-emerald-600" },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="flex gap-5">
                <div className={`w-11 h-11 rounded-xl ${color} text-white text-sm font-bold flex items-center justify-center shrink-0 shadow-md`}>
                  {step}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Visual panel */}
          <div className="relative">
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 rounded-3xl p-8 text-white shadow-2xl">
              <p className="text-sm font-semibold text-blue-200 mb-6 uppercase tracking-widest">Live application feed</p>
              {[
                { name: "Alice Chen", role: "Senior Engineer", score: 84, status: "approved", color: "bg-emerald-400" },
                { name: "Bob Patel", role: "ML Engineer", score: 71, status: "pending", color: "bg-amber-400" },
                { name: "Carol Smith", role: "Frontend Dev", score: 58, status: "rejected", color: "bg-red-400" },
              ].map(({ name, role, score, status, color }) => (
                <div key={name} className="flex items-center justify-between bg-white/10 backdrop-blur rounded-xl px-4 py-3 mb-3 last:mb-0 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                      {name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{name}</p>
                      <p className="text-xs text-blue-200">{role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">{score}</span>
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                  </div>
                </div>
              ))}
              <div className="mt-6 pt-5 border-t border-white/20 grid grid-cols-3 gap-3 text-center">
                {[["15", "Applied"], ["8", "Reviewed"], ["3", "Hired"]].map(([val, lbl]) => (
                  <div key={lbl}>
                    <p className="text-xl font-bold">{val}</p>
                    <p className="text-xs text-blue-200">{lbl}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Floating badge */}
            <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl px-4 py-3 border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">Interview booked!</p>
                  <p className="text-xs text-gray-400">2 min ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof photo strip */}
      <section className="py-16 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8">Connecting talent with opportunity</p>
          <div className="grid grid-cols-3 gap-4 h-56">
            <div className="relative rounded-2xl overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&q=80&fit=crop"
                alt="Job interview"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <p className="absolute bottom-3 left-3 text-white text-xs font-semibold">Interview Ready</p>
            </div>
            <div className="relative rounded-2xl overflow-hidden row-span-1">
              <Image
                src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=80&fit=crop"
                alt="Team handshake"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <p className="absolute bottom-3 left-3 text-white text-xs font-semibold">Deals Done</p>
            </div>
            <div className="relative rounded-2xl overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&q=80&fit=crop"
                alt="Diverse team"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <p className="absolute bottom-3 left-3 text-white text-xs font-semibold">Great Teams</p>
            </div>
          </div>
        </div>
      </section>

      {/* For candidates / recruiters */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
              <Users size={24} className="text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">For Candidates</h3>
            <p className="text-gray-500 mb-6 leading-relaxed">Upload your resume once and get automatically matched to every open role. See your fit score and Claude's reasoning for each position.</p>
            <ul className="space-y-2 mb-8">
              {["AI-powered resume analysis", "Fit scores for every open role", "Real-time application status", "Automatic interview scheduling"].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle size={15} className="text-blue-500 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/register?role=candidate" className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-blue-700 transition-colors">
              Join as Candidate <ArrowRight size={15} />
            </Link>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 shadow-sm text-white hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
              <Briefcase size={24} className="text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3">For Recruiters</h3>
            <p className="text-indigo-100 mb-6 leading-relaxed">Post jobs, review AI-ranked applicants, and schedule interviews — all from one dashboard. The model gets smarter with every decision you make.</p>
            <ul className="space-y-2 mb-8">
              {["Unique Position IDs per role", "AI-ranked candidate feed", "One-click approve / reject", "Google Calendar integration"].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-indigo-100">
                  <CheckCircle size={15} className="text-indigo-300 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/register?role=recruiter" className="inline-flex items-center gap-2 bg-white text-indigo-700 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-50 transition-colors">
              Start Hiring <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Security badge row */}
      <section className="py-12 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-400">
          {[Shield, CheckCircle, Brain].map((Icon, i) => (
            <div key={i} className="flex items-center gap-2">
              <Icon size={16} className="text-gray-300" />
              <span>{["Firebase Auth secured", "Role-based access control", "Claude AI powered"][i]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-blue-950 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to transform your hiring?</h2>
          <p className="text-slate-300 mb-8">Join BestHire and let AI do the heavy lifting.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="px-8 py-3.5 bg-white text-slate-900 font-bold rounded-xl hover:bg-blue-50 transition-colors text-sm">
              Create free account
            </Link>
            <Link href="/login" className="px-8 py-3.5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors text-sm">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-6 text-center text-xs text-gray-400 border-t">
        © 2026 BestHire · Built with Next.js, Firebase & Claude AI
      </footer>
    </div>
  );
}
