import { z } from "zod";
import { emailSchema, optionalTrimmedString } from "./common.validation.js";

const authRoleSchema = z.enum(["ADMIN", "DEALER", "DISPATCHER", "FACTORY"]);

const passwordSchema = z.string().min(1).max(256);
const newPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

const tokenSchema = z.string().trim().min(32).max(256);

export const loginBodySchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    role: authRoleSchema.optional(),
  })
  .strict();

export const emailOnlyBodySchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const passwordResetBodySchema = z
  .object({
    token: tokenSchema,
    newPassword: newPasswordSchema,
  })
  .strict();

export const passwordTokenStatusBodySchema = z
  .object({
    token: tokenSchema,
    purpose: z.enum(["RESET_PASSWORD", "SETUP_PASSWORD"]),
  })
  .strict();

export const smtpTestBodySchema = z
  .object({
    to: emailSchema.optional(),
  })
  .strict();

export const adminResendSetupEmailBodySchema = z
  .object({
    email: emailSchema,
    accountType: authRoleSchema.optional(),
    displayName: optionalTrimmedString(160),
  })
  .strict();
