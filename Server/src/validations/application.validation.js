import { z } from "zod";
import {
  emailSchema,
  optionalTrimmedString,
  phoneSchema,
  trimmedString,
} from "./common.validation.js";

export const dealerApplicationBodySchema = z
  .object({
    companyName: trimmedString(120),
    contactName: trimmedString(120),
    phone: phoneSchema,
    email: emailSchema,
    address: optionalTrimmedString(200),
    panVat: optionalTrimmedString(80),
    notes: optionalTrimmedString(500),
  })
  .strict();

export const dispatcherApplicationBodySchema = z
  .object({
    name: trimmedString(120),
    companyName: trimmedString(120),
    phone: phoneSchema,
    email: emailSchema,
    address: optionalTrimmedString(200),
    notes: optionalTrimmedString(500),
  })
  .strict();

const tokenSchema = z.string().trim().min(32).max(256);

export const dealerEmailVerificationBodySchema = z
  .object({ token: tokenSchema })
  .strict();

export const dealerResendVerificationBodySchema = z
  .object({ email: emailSchema })
  .strict();
