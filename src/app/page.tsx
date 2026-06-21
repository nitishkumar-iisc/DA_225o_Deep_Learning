import Link from "next/link";
import { Briefcase, Users, Brain } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col">
      <header className="px-8 py-5 flex items-center justify-between border-b bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Briefcase size={22} className="text-blue-600" />
          <span className="text-lg font-bold text-gray-900">BestHire</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            Log in
          </Link>
          <Link href="/register" className="text-sm bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="max-w-2xl">
          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
            AI-Powered Career Portal
          </span>
          <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
            The smarter way to hire and get hired
          </h1>
          <p className="text-lg text-gray-500 mb-10 leading-relaxed">
            BestHire uses Claude AI to match candidates to roles with precision — scoring resumes, surfacing the best fits, and scheduling interviews automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register?role=candidate" className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm">
              I&apos;m a Candidate →
            </Link>
            <Link href="/register?role=recruiter" className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">
              I&apos;m a Recruiter →
            </Link>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
          {[
            { icon: Brain, title: "AI Fit Scoring", desc: "Claude analyses every resume against job requirements and scores candidates 0–100." },
            { icon: Users, title: "Smart Matching", desc: "Logistic regression learns from recruiter decisions to improve scores over time." },
            { icon: Briefcase, title: "Auto Scheduling", desc: "Approved candidates get Google Calendar interview invites sent automatically." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border rounded-2xl p-6 text-left shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                <Icon size={20} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-gray-400 border-t">
        BestHire · Built with Next.js, Firebase, and Claude AI
      </footer>
    </div>
  );
}
