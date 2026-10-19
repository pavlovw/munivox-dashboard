import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import crypto from "crypto";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credenciales MuniVox",
      credentials: {
        email: { label: "Correo Electrónico", type: "email", placeholder: "operador@munivox.cl" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const clientId = process.env.COGNITO_CLIENT_ID || "384krgk3lrudtl82h0rn8mpn5i";
        const clientSecret = process.env.COGNITO_CLIENT_SECRET || "1gmq0chs7sds9cb54bc54vk1bq48dnps16e1bar5flmn00vht4g3";

        // 1. Generar el SECRET_HASH obligatorio de AWS Cognito
        const secretHash = crypto
          .createHmac("sha256", clientSecret)
          .update(credentials.email + clientId)
          .digest("base64");

        try {
          // 2. Enviar petición directa a la API de Cognito
          const response = await fetch("https://cognito-idp.us-east-2.amazonaws.com/", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-amz-json-1.1",
              "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
            },
            body: JSON.stringify({
              AuthFlow: "USER_PASSWORD_AUTH",
              ClientId: clientId,
              AuthParameters: {
                USERNAME: credentials.email,
                PASSWORD: credentials.password,
                SECRET_HASH: secretHash,
              },
            }),
          });

          const data = await response.json();

          // 3. Validar si Cognito entregó el Token de acceso
          if (data.AuthenticationResult) {
            return { 
              id: credentials.email, 
              name: "Operador Autorizado", 
              email: credentials.email, 
              role: "OPERADOR" 
            };
          }
          
          console.error("Error de credenciales en Cognito:", data.message);
          return null;

        } catch (error) {
          console.error("Fallo de conexión a AWS:", error);
          return null;
        }
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

export { handler as GET, handler as POST };
