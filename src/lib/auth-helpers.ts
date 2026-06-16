import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { UserRole } from "@/types";

export interface AuthResult {
  uid: string;
  role: UserRole;
}

export async function verifyAuth(
  request: NextRequest,
  requiredRole?: UserRole
): Promise<AuthResult | null> {
  const authHeader = request.headers.get("Authorization");
  const token =
    authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : request.cookies.get("token")?.value;

  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const role = decoded.role as UserRole;
    if (requiredRole && role !== requiredRole) return null;
    return { uid: decoded.uid, role };
  } catch {
    return null;
  }
}
