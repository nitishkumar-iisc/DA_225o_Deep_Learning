"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Briefcase, LayoutDashboard, FolderOpen, Users, Settings, LogOut, Upload } from "lucide-react";

export function Nav() {
  const { user, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await signOut(auth);
    document.cookie = "token=; Max-Age=0; path=/";
    router.push("/login");
  }

  if (!user) return null;

  const recruiterLinks = [
    { href: "/recruiter/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/recruiter/jobs", label: "Jobs", icon: FolderOpen },
    { href: "/recruiter/applications", label: "Applications", icon: Users },
    { href: "/recruiter/settings", label: "Settings", icon: Settings },
  ];

  const candidateLinks = [
    { href: "/candidate/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/candidate/upload", label: "Upload Resume", icon: Upload },
  ];

  const links = role === "recruiter" ? recruiterLinks : candidateLinks;
  const dashboardHref = role === "recruiter" ? "/recruiter/dashboard" : "/candidate/dashboard";

  const roleColor = role === "recruiter"
    ? "bg-indigo-100 text-indigo-700"
    : "bg-emerald-100 text-emerald-700";

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href={dashboardHref} className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Briefcase size={14} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-base">BestHire</span>
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize hidden sm:inline-flex ${roleColor}`}>
            {role}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="sm:hidden flex overflow-x-auto border-t border-gray-100 px-4 py-1.5 gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <Icon size={13} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
