import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credenciales MuniVox",
      credentials: {
        email: { label: "Correo Electrónico", type: "email", placeholder: "operador@munivox.cl" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        // Usuarios estáticos para prueba local
        if (credentials?.email === "admin@munivox.cl" && credentials?.password === "admin123") {
          return { id: "1", name: "Jefatura Central", email: "admin@munivox.cl", role: "ADMINISTRADOR" };
        }
        if (credentials?.email === "operador@munivox.cl" && credentials?.password === "operador123") {
          return { id: "2", name: "Operador Turno A", email: "operador@munivox.cl", role: "OPERADOR" };
        }
        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60,
  },
});

// ¡ESTA ES LA LÍNEA CLAVE QUE PIDE EL APP ROUTER DE NEXT.JS!
export { handler as GET, handler as POST };