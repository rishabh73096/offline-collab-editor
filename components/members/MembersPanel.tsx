"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, Trash2, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/validation/members";

interface MemberItem {
  id: string;
  role: Role;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

const ROLE_STYLES: Record<Role, string> = {
  OWNER: "bg-moss-soft text-moss",
  EDITOR: "bg-teal-soft text-teal",
  VIEWER: "bg-surface-soft text-ink-soft",
};

async function fetchMembers(documentId: string): Promise<MemberItem[]> {
  const response = await fetch(`/api/documents/${documentId}/members`);
  if (!response.ok) {
    throw new Error("Failed to load members");
  }
  const data = (await response.json()) as { members: MemberItem[] };
  return data.members;
}

export function MembersPanel({
  documentId,
  currentUserId,
  isOwner,
}: {
  documentId: string;
  currentUserId: string;
  isOwner: boolean;
}) {
  const [members, setMembers] = useState<MemberItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { role: "EDITOR" },
  });

  useEffect(() => {
    let cancelled = false;
    fetchMembers(documentId)
      .then((loaded) => {
        if (!cancelled) setMembers(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Could not load who has access.");
          toast.error("Could not load who has access");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  async function onInvite(values: InviteMemberInput) {
    try {
      const member = await toast
        .promise(
          async () => {
            const response = await fetch(`/api/documents/${documentId}/members`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(values),
            });
            if (!response.ok) {
              const body = await response.json().catch(() => null);
              throw new Error(body?.error ?? "Could not invite that person");
            }
            const data = (await response.json()) as { member: MemberItem };
            return data.member;
          },
          {
            loading: "Inviting…",
            success: (invited) => `${invited.user.name ?? invited.user.email} now has access`,
            error: (error) => (error instanceof Error ? error.message : "Could not invite that person"),
          },
        )
        .unwrap();

      setMembers((current) => (current ? [...current, member] : [member]));
      reset({ email: "", role: "EDITOR" });
    } catch {
      // toast already reported the error
    }
  }

  async function handleRoleChange(memberId: string, role: "EDITOR" | "VIEWER") {
    setPendingMemberId(memberId);
    try {
      const updated = await toast
        .promise(
          async () => {
            const response = await fetch(`/api/documents/${documentId}/members/${memberId}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ role }),
            });
            if (!response.ok) {
              const body = await response.json().catch(() => null);
              throw new Error(body?.error ?? "Could not update their role");
            }
            const data = (await response.json()) as { member: MemberItem };
            return data.member;
          },
          {
            loading: "Updating role…",
            success: "Role updated",
            error: (error) => (error instanceof Error ? error.message : "Could not update their role"),
          },
        )
        .unwrap();

      setMembers((current) => current?.map((m) => (m.id === memberId ? updated : m)) ?? current);
    } catch {
      // toast already reported the error
    } finally {
      setPendingMemberId(null);
    }
  }

  async function handleRemove(memberId: string) {
    setPendingMemberId(memberId);
    try {
      await toast
        .promise(
          async () => {
            const response = await fetch(`/api/documents/${documentId}/members/${memberId}`, {
              method: "DELETE",
            });
            if (!response.ok && response.status !== 204) {
              const body = await response.json().catch(() => null);
              throw new Error(body?.error ?? "Could not remove access");
            }
          },
          {
            loading: "Removing access…",
            success: "Access removed",
            error: (error) => (error instanceof Error ? error.message : "Could not remove access"),
          },
        )
        .unwrap();

      setMembers((current) => current?.filter((m) => m.id !== memberId) ?? current);
      setConfirmingRemoveId(null);
    } catch {
      // toast already reported the error
    } finally {
      setPendingMemberId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {isOwner && (
        <form
          onSubmit={handleSubmit(onInvite)}
          noValidate
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
        >
          <h2 className="font-serif text-base font-semibold text-ink">Invite someone</h2>
          <p className="text-xs text-ink-faint">They need an existing account on this email.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="invite-email" className="sr-only">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                placeholder="teammate@example.com"
                aria-invalid={Boolean(errors.email)}
                className="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-brick">{errors.email.message}</p>}
            </div>
            <select
              aria-label="Role to invite as"
              className="rounded-lg border border-border bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              {...register("role")}
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite
            </button>
          </div>
        </form>
      )}

      {loadError && <p className="text-sm text-brick">{loadError}</p>}

      {members === null && !loadError && (
        <div className="flex items-center gap-2 text-sm text-ink-faint">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading who has access…
        </div>
      )}

      {members && (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
          {members.map((member) => {
            const isSelf = member.user.id === currentUserId;
            const isPending = pendingMemberId === member.id;
            return (
              <li key={member.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                    {(member.user.name ?? member.user.email).charAt(0).toUpperCase()}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink">
                      {member.user.name ?? member.user.email}
                      {isSelf && <span className="ml-1.5 text-xs font-normal text-ink-faint">(you)</span>}
                    </span>
                    <span className="text-xs text-ink-faint">{member.user.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.role === "OWNER" ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLES.OWNER}`}
                    >
                      <Crown className="h-3 w-3" aria-hidden="true" />
                      Owner
                    </span>
                  ) : isSelf || !isOwner ? (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLES[member.role]}`}>
                      {member.role}
                    </span>
                  ) : (
                    <>
                      <select
                        aria-label={`Role for ${member.user.email}`}
                        value={member.role}
                        disabled={isPending}
                        onChange={(event) => void handleRoleChange(member.id, event.target.value as "EDITOR" | "VIEWER")}
                        className="rounded-full border border-border bg-paper px-2.5 py-1 text-xs font-medium text-ink outline-none focus:border-accent disabled:opacity-60"
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>

                      {confirmingRemoveId === member.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleRemove(member.id)}
                            disabled={isPending}
                            className="rounded-full bg-brick px-2.5 py-1 text-xs font-medium text-surface transition-colors hover:bg-brick/90 disabled:opacity-60"
                          >
                            {isPending ? "Removing…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingRemoveId(null)}
                            className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink-soft hover:text-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingRemoveId(member.id)}
                          aria-label={`Remove ${member.user.email}`}
                          className="rounded-full border border-border p-1.5 text-ink-faint transition-colors hover:border-brick/40 hover:text-brick"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
