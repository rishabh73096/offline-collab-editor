import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

const COLLAB_JWT_TTL_SECONDS = 60;

function getSecret() {
  const secret = process.env.COLLAB_JWT_SECRET;
  if (!secret) {
    throw new Error("COLLAB_JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export interface CollabTokenPayload {
  userId: string;
  documentId: string;
  role: Role;
}

/**
 * Mints a short-lived, single-purpose JWT for the WebSocket collab server
 * handshake. Deliberately separate from the NextAuth session token: it is
 * minted only after verifying document membership, carries the resolved
 * role so the collab server can enforce write permissions without a DB
 * round-trip per message, and expires fast so it can't be replayed later.
 */
export async function signCollabToken(payload: CollabTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COLLAB_JWT_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyCollabToken(token: string): Promise<CollabTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  const { userId, documentId, role } = payload as Record<string, unknown>;

  if (typeof userId !== "string" || typeof documentId !== "string" || typeof role !== "string") {
    throw new Error("Malformed collab token payload");
  }
  if (role !== "OWNER" && role !== "EDITOR" && role !== "VIEWER") {
    throw new Error("Invalid role in collab token");
  }

  return { userId, documentId, role };
}
