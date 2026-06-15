"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";

export function Nav() {
  const { user, role } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    document.cookie = "token=; Max-Age=0; path=/";
    router.push("/login");
  }

  if (!user) return null;

  const dashboardHref =
    role === "recruiter" ? "/recruiter/dashboard" : "/candidate/dashboard";

  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <Link href={dashboardHref} className="font-bold text-lg text-gray-900">
        BestHire
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 capitalize">{role}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-red-600 hover:text-red-800 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
