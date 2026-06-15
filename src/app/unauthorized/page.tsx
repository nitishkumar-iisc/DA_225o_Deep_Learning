"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    document.cookie = "token=; Max-Age=0; path=/";
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You don&apos;t have permission to view this page. This area is
          restricted to a different user role.
        </p>
        <button
          onClick={handleLogout}
          className="bg-gray-900 text-white px-6 py-2 rounded hover:bg-gray-700 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
