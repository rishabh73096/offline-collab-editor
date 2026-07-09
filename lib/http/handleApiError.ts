import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/session";
import { DocumentNotFoundError, DocumentForbiddenError } from "@/lib/repositories/documents";

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (error instanceof DocumentNotFoundError) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (error instanceof DocumentForbiddenError) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
