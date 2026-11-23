"use server";

import { redirect } from "next/navigation";

import type { ChangePasswordField } from "@/application/auth/change-password";
import { InputError } from "@/application/shared/input-error";
import { homePathFor } from "@/domain/auth/roles";
import { DomainError } from "@/domain/shared/domain-error";
import { changeOwnPassword } from "@/lib/auth/auth";

export interface ChangePasswordState {
  error?: string;
  fieldErrors?: Partial<Record<ChangePasswordField, string>>;
}

/** Cambiar la contraseña desde la cuenta (RF-006) o la temporal del personal (RF-013). */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  let home: string;
  try {
    const user = await changeOwnPassword({
      currentPassword: String(formData.get("currentPassword") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });
    home = homePathFor(user.role);
  } catch (error) {
    if (error instanceof InputError) return { fieldErrors: error.fieldErrors };
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  // redirect() funciona lanzando una excepción: va fuera del try.
  redirect(home);
}
