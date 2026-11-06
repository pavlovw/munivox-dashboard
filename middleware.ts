import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login", // Si no hay sesión, redirigir aquí
  },
});

// Protegemos el panel; quedan públicas el login, el seguimiento del vecino y la política de privacidad
export const config = {
  matcher: [
    "/",
    "/((?!api/webhook|login|sw\\.js|seguimiento|privacidad|iconos|apple-icon|manifest|icon|_next/static|_next/image|favicon.ico|.*\\.svg).*)",
  ],
};