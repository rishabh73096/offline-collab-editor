import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/session";
import { DocumentNotFoundError, DocumentForbiddenError } from "@/lib/repositories/documents";
import {
  MemberNotFoundError,
  MemberAlreadyExistsError,
  InviteeNotFoundError,
  CannotModifyOwnMembershipError,
  CannotModifyOwnerError,
} from "@/lib/repositories/members";

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (error instanceof DocumentNotFoundError || error instanceof MemberNotFoundError) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (error instanceof DocumentForbiddenError) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  if (error instanceof InviteeNotFoundError) {
    return NextResponse.json({ error: "No account found for that email" }, { status: 404 });
  }
  if (error instanceof MemberAlreadyExistsError) {
    return NextResponse.json({ error: "Already has access to this document" }, { status: 409 });
  }
  if (error instanceof CannotModifyOwnMembershipError || error instanceof CannotModifyOwnerError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
