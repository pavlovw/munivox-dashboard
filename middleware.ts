import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login", // Si no hay sesión, redirigir aquí
  },
});

// Protegemos la raíz (el dashboard) y dejamos libre la API de autenticación y recursos estáticos
export const config = {
  matcher: [
    "/",
    "/((?!api/webhook|login|_next/static|_next/image|favicon.ico|.*\\.svg).*)",
  ],
};