"use client";
import { SessionProvider } from "next-auth/react";
import { AvisosProvider } from "../components/ui/Avisos";

export function Providers({ children }: { children: React.ReactNode }) {
  // Revisa la sesión cada 4 minutos: NextAuth renueva el token de Cognito antes de que venza
  return (
    <SessionProvider refetchInterval={240} refetchOnWindowFocus>
      <AvisosProvider>{children}</AvisosProvider>
    </SessionProvider>
  );
}
