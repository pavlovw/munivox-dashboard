import type { MetadataRoute } from "next";

// Permite "Añadir a pantalla de inicio": se abre como app, sin la barra del navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MuniVox | Municipalidad de Buin",
    short_name: "MuniVox",
    description: "Gestión de reportes ciudadanos de la Municipalidad de Buin",
    start_url: "/",
    display: "standalone",
    background_color: "#0A1222",
    theme_color: "#0A1222",
    lang: "es-CL",
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
