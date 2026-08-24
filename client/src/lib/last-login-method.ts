import type { User } from "@supabase/supabase-js";

export type LastLoginMethod = "email" | "google" | "apple";

const STORAGE_KEY = "consumed_last_login_method";

export const lastLoginMethodLabels: Record<LastLoginMethod, string> = {
  email: "email",
  google: "Google",
  apple: "Apple",
};

export function getLastLoginMethod(): LastLoginMethod | null {
  if (typeof window === "undefined") return null;

  const method = window.localStorage.getItem(STORAGE_KEY);
  return method === "email" || method === "google" || method === "apple"
    ? method
    : null;
}

export function rememberLastLoginMethod(method: LastLoginMethod) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, method);
}

export function rememberLastLoginMethodFromUser(user: User) {
  const provider = user.app_metadata?.provider;
  if (provider === "google" || provider === "apple" || provider === "email") {
    rememberLastLoginMethod(provider);
  }
}