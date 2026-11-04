import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import crypto from "crypto";

// Las credenciales del cliente de Cognito se leen SOLO desde variables de entorno.
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || "";
const REGION = process.env.COGNITO_REGION || "us-east-2";
const COGNITO_URL = `https://cognito-idp.${REGION}.amazonaws.com/`;

// Se renueva el idToken cuando le quedan menos de 5 minutos
const MARGEN_RENOVACION_MS = 5 * 60 * 1000;

function secretHash(usuario: string) {
  return crypto.createHmac("sha256", CLIENT_SECRET).update(usuario + CLIENT_ID).digest("base64");
}

function leerJwt(token: string): Record<string, any> {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

async function llamarCognito(target: string, body: Record<string, unknown>) {
  const res = await fetch(COGNITO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function renovarToken(token: any) {
  try {
    const data = await llamarCognito("InitiateAuth", {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: token.refreshToken,
        SECRET_HASH: secretHash(token.cognitoUsername),
      },
    });
    const r = data.AuthenticationResult;
    if (!r?.IdToken) throw new Error(data.message || "Cognito no entregó un token nuevo");
    return {
      ...token,
      idToken: r.IdToken,
      expiraEn: Date.now() + (r.ExpiresIn || 3600) * 1000,
      refreshToken: r.RefreshToken || token.refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("No se pudo renovar la sesión de Cognito:", error);
    return { ...token, error: "RenovacionFallida" };
  }
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credenciales MuniVox",
      credentials: {
        email: { label: "Correo electrónico", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (!CLIENT_ID || !CLIENT_SECRET) {
          console.error("Faltan COGNITO_CLIENT_ID o COGNITO_CLIENT_SECRET en el entorno.");
          throw new Error("CONFIGURACION");
        }

        const email = credentials.email.trim();
        let data: any;
        try {
          data = await llamarCognito("InitiateAuth", {
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: CLIENT_ID,
            AuthParameters: { USERNAME: email, PASSWORD: credentials.password, SECRET_HASH: secretHash(email) },
          });
        } catch (error) {
          console.error("Fallo de conexión con Cognito:", error);
          throw new Error("CONEXION");
        }

        if (data.ChallengeName === "NEW_PASSWORD_REQUIRED") throw new Error("NUEVA_CLAVE");
        if (!data.AuthenticationResult) {
          console.error("Cognito rechazó las credenciales:", data.message);
          return null;
        }

        const r = data.AuthenticationResult;
        const claims = leerJwt(r.IdToken);
        return {
          id: claims.sub || email,
          email: claims.email || email,
          name: claims.name || email.split("@")[0],
          idToken: r.IdToken,
          refreshToken: r.RefreshToken,
          expiraEn: Date.now() + (r.ExpiresIn || 3600) * 1000,
          cognitoUsername: claims["cognito:username"] || email,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        return {
          ...token,
          idToken: u.idToken,
          refreshToken: u.refreshToken,
          expiraEn: u.expiraEn,
          cognitoUsername: u.cognitoUsername,
        };
      }
      if (token.expiraEn && Date.now() < (token.expiraEn as number) - MARGEN_RENOVACION_MS) return token;
      if (!token.refreshToken) return token;
      return renovarToken(token);
    },
    async session({ session, token }) {
      (session as any).idToken = token.idToken;
      (session as any).error = token.error;
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
});

export { handler as GET, handler as POST };
