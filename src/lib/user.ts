export type UserId = "italo" | "natalia";

export const USERS: { id: UserId; name: string; color: string }[] = [
  { id: "italo",   name: "Italo",   color: "#3b82f6" },
  { id: "natalia", name: "Natalia", color: "#ec4899" },
];

const KEY = "ibank_user";

export function getCurrentUser(): UserId {
  if (typeof window === "undefined") return "italo";
  return (localStorage.getItem(KEY) as UserId) || "italo";
}

export function setCurrentUser(user: UserId) {
  localStorage.setItem(KEY, user);
}

export function clearCurrentUser() {
  localStorage.removeItem(KEY);
}

export function hasSelectedUser(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(KEY);
}
