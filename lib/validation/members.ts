import { z } from "zod";

const assignableRole = z.enum(["EDITOR", "VIEWER"]);

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  role: assignableRole,
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: assignableRole,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
