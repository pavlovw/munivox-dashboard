"use client";
import { useSession } from "next-auth/react";

export function useApi() {
  const { data: session } = useSession();
  const idToken = (session as any)?.idToken as string | undefined;

  return (url: string, init: RequestInit = {}) =>
    fetch(url, {
      ...init,
      headers: {
        ...((init.headers as Record<string, string>) || {}),
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
    });
}