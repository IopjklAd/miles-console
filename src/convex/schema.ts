import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Conversations with the MILES assistant, persisted server-side.
    conversations: defineTable({
      userId: v.string(),
      title: v.string(),
      /** Preview of the last message, shown in the history list. */
      preview: v.optional(v.string()),
      /** Model requested for the next reply. */
      model: v.optional(v.string()),
      updatedAt: v.number(),
    }).index("by_user", ["userId", "updatedAt"]),

    messages: defineTable({
      conversationId: v.id("conversations"),
      userId: v.string(),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      /** pending → the AI action is running; error/cancelled are retryable. */
      status: v.union(
        v.literal("pending"),
        v.literal("complete"),
        v.literal("error"),
        v.literal("cancelled"),
      ),
      model: v.optional(v.string()),
      latencyMs: v.optional(v.number()),
      error: v.optional(v.string()),
      promptTokens: v.optional(v.number()),
      completionTokens: v.optional(v.number()),
    }).index("by_conversation", ["conversationId"]),

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])
  },
  {
    schemaValidation: false,
  },
);

export default schema;
