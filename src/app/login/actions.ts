"use server";

import { redirect } from "next/navigation";

import { DomainError } from "@/domain/shared/domain-error";
import { signIn, signOut } from "@/lib/auth/auth";

export interface LoginState {
  error?: string;
  email?: string;
}

/** Formulario de inicio de sesión (RF-003). */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  let redirectTo: string;
  try {
    const result = await signIn({
      email,
      password: String(formData.get("password") ?? ""),
      next: String(formData.get("next") ?? "") || undefined,
    });
    redirectTo = result.redirectTo;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message, email };
    throw error;
  }
  // redirect() funciona lanzando una excepción: va fuera del try.
  redirect(redirectTo);
}

/** Botón "Cerrar sesión" (RF-004). */
export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
