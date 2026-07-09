import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export function getSession() {
  return getServerSession(authOptions);
}

export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new AuthError("Not authenticated");
  }
  return session.user.id;
}

export class AuthError extends Error {}
