@AGENTS.md

# Dashboard MuniVox (Next.js 16 + React 19)
El contexto general del proyecto está en el `CLAUDE.md` de la carpeta superior.
Esta carpeta es un repositorio propio que se publica en AWS Amplify (rama `main`). Usa NextAuth v4 con un proveedor de credenciales que autentica contra Cognito (`app/api/auth/[...nextauth]/route.ts`), llama a la Lambda por API Gateway (`NEXT_PUBLIC_API_GATEWAY_URL`, ver `lib/useApi.ts`) y al socket-service por WebSocket (`NEXT_PUBLIC_SOCKET_URL`, ver `lib/useTiempoReal.ts`). La documentación de la versión de Next instalada está en `node_modules/next/dist/docs/`.
Reglas de diseño: sin emojis, sin esquinas redondeadas, colores y animaciones desde `app/globals.css`, textos en español.
