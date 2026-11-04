import { Logo } from "../../components/ui/Comunes";
import { CONTACTO_PRIVACIDAD as C } from "../../lib/privacidad";

// Política de tratamiento de datos personales (deber de información y transparencia,
// art. 14 ter de la Ley 19.628 modificada por la Ley 21.719). Página pública.

export const metadata = { title: "Política de privacidad | MuniVox Buin" };

function Valor({ children }: { children: string }) {
  const pendiente = children.startsWith("[COMPLETAR");
  return pendiente
    ? <mark style={{ background: "var(--aviso-suave)", color: "#7A4A00", padding: "0 4px", border: "1px dashed #B7791F" }}>{children}</mark>
    : <strong>{children}</strong>;
}

const secciones: { titulo: string; contenido: React.ReactNode }[] = [
  {
    titulo: "1. Quién es responsable de tus datos",
    contenido: (
      <p>El responsable del tratamiento es la <Valor>{C.responsable}</Valor>, con domicilio en <Valor>{C.direccion}</Valor>. MuniVox es el sistema que la Municipalidad usa para recibir y atender los reportes de problemas en la vía pública que los vecinos envían por WhatsApp.</p>
    ),
  },
  {
    titulo: "2. Qué datos tratamos",
    contenido: (
      <>
        <p><strong>De los vecinos que reportan:</strong></p>
        <ul>
          <li>Número de teléfono de WhatsApp desde el que escribes.</li>
          <li>Los mensajes que envías sobre el problema.</li>
          <li>Las fotografías que adjuntas.</li>
          <li>La ubicación del problema que compartes (datos de geolocalización).</li>
          <li>Fechas y horas de tus mensajes, y el historial de atención de cada reporte.</li>
          <li>Tu evaluación de la atención, si decides responderla.</li>
        </ul>
        <p>No pedimos tu nombre, RUT ni dirección, y no usamos el nombre de tu perfil de WhatsApp.</p>
        <p><strong>Del personal municipal:</strong> correo institucional, nombre, rol y, solo para funcionarios en terreno que activan el GPS durante su jornada, su ubicación aproximada.</p>
      </>
    ),
  },
  {
    titulo: "3. Para qué los usamos",
    contenido: (
      <ul>
        <li>Recibir, clasificar y derivar tu reporte al área municipal que corresponde.</li>
        <li>Coordinar la atención en terreno.</li>
        <li>Avisarte por WhatsApp el avance y el cierre de tu caso, y responder tus consultas.</li>
        <li>Elaborar estadísticas de gestión, que se presentan siempre de forma agregada, sin identificar a personas.</li>
      </ul>
    ),
  },
  {
    titulo: "4. Por qué podemos hacerlo",
    contenido: (
      <>
        <p>La Municipalidad trata estos datos para cumplir sus funciones legales (entre otras, aseo y ornato, tránsito, mantención de la vía pública y seguridad), establecidas en la Ley N° 18.695, Orgánica Constitucional de Municipalidades. Según la Ley N° 19.628, modificada por la Ley N° 21.719, los órganos públicos pueden tratar datos personales para cumplir sus funciones legales dentro de su competencia, sin necesidad de pedir el consentimiento del titular.</p>
        <p>Usamos tus datos solo para estos fines. No los vendemos, no los usamos con fines comerciales ni políticos, y no los cedemos a otras instituciones salvo cuando una ley lo exija.</p>
      </>
    ),
  },
  {
    titulo: "5. Uso de inteligencia artificial",
    contenido: (
      <p>Un sistema de inteligencia artificial lee tu mensaje y tus fotos para proponer el tipo de problema, el área responsable y su prioridad, y para responderte en el chat. <strong>Esas propuestas siempre las revisa y decide personal municipal</strong>: la IA no toma decisiones sobre ti. Le indicamos a la IA que no copie datos personales en sus resúmenes.</p>
    ),
  },
  {
    titulo: "6. Quiénes nos ayudan a operar el sistema",
    contenido: (
      <>
        <p>Para funcionar, MuniVox usa servicios tecnológicos que procesan los datos <strong>por encargo de la Municipalidad</strong> y bajo sus instrucciones:</p>
        <ul>
          <li><strong>Meta (WhatsApp Business):</strong> transmisión de los mensajes.</li>
          <li><strong>Amazon Web Services:</strong> base de datos, fotografías y servicios del panel municipal.</li>
          <li><strong>Microsoft Azure:</strong> procesamiento de los mensajes recibidos.</li>
          <li><strong>Google (Gemini):</strong> análisis del texto y de las fotos de cada reporte.</li>
        </ul>
        <p>Estos proveedores tienen servidores en Estados Unidos, por lo que existe una <strong>transferencia internacional de datos</strong>. La Municipalidad la realiza con proveedores que ofrecen garantías contractuales de protección y seguridad de la información.</p>
      </>
    ),
  },
  {
    titulo: "7. Cuánto tiempo guardamos tus datos",
    contenido: (
      <ul>
        <li>Si comienzas un reporte y no envías la ubicación, el borrador se elimina a los 30 minutos.</li>
        <li>Mientras un caso está en curso, conservamos todos sus datos.</li>
        <li>Cuando han pasado <strong>{C.mesesConservacion} meses</strong> desde el cierre de un caso, eliminamos el relato y las fotografías. Si en ese tiempo no has vuelto a escribirnos, tu número se reemplaza por un código anónimo.</li>
        <li>Conservamos solo datos estadísticos que no permiten identificarte (tipo de problema, sector, fechas y tiempos de atención).</li>
      </ul>
    ),
  },
  {
    titulo: "8. Tus derechos y cómo ejercerlos",
    contenido: (
      <>
        <p>Tienes derecho a <strong>acceder</strong> a tus datos, <strong>rectificarlos</strong> si están incorrectos, pedir su <strong>supresión</strong>, <strong>oponerte</strong> a un tratamiento, solicitar su <strong>portabilidad</strong> y pedir el <strong>bloqueo</strong> temporal mientras se resuelve una solicitud.</p>
        <p>Puedes ejercerlos de forma gratuita:</p>
        <ul>
          <li>Por WhatsApp: escribe <strong>mis datos</strong> para recibir al instante lo que tenemos de ti, o <strong>eliminar mis datos</strong> para pedir su eliminación.</li>
          <li>Por correo electrónico a <Valor>{C.correo}</Valor>, indicando tu número de teléfono y lo que solicitas.</li>
          <li>De forma presencial en la {C.oficina}.</li>
        </ul>
        <p>Responderemos en un plazo máximo de <strong>30 días corridos</strong>. Si no respondemos o rechazamos tu solicitud, puedes reclamar ante la <strong>Agencia de Protección de Datos Personales</strong>.</p>
        <p>Ten presente que, si pides eliminar tus datos mientras tienes un caso en curso, ya no podremos avisarte su avance. La Municipalidad podrá conservar los datos que una ley le obligue a mantener.</p>
      </>
    ),
  },
  {
    titulo: "9. Cómo protegemos la información",
    contenido: (
      <ul>
        <li>Las comunicaciones viajan cifradas y el panel municipal exige usuario y contraseña institucional.</li>
        <li>Cada funcionario ve solo lo que necesita para su labor: los departamentos y el personal en terreno no ven tu número de teléfono completo.</li>
        <li>Las acciones sensibles (consultas de vecinos, cambios de permisos, solicitudes sobre datos y eliminaciones) quedan registradas en una bitácora de auditoría.</li>
        <li>El seguimiento público de un reporte no muestra datos personales: ni tu número, ni tu relato, ni la ubicación exacta.</li>
        <li>Si ocurriera una vulneración de seguridad que afecte tus datos, la Municipalidad la informará a la Agencia de Protección de Datos Personales y, cuando corresponda, a las personas afectadas.</li>
      </ul>
    ),
  },
  {
    titulo: "10. Recomendaciones al reportar",
    contenido: (
      <ul>
        <li>Fotografía el problema, evitando que aparezcan personas o patentes de vehículos que no sean parte del reporte.</li>
        <li>No envíes datos de salud, RUT ni información de terceros.</li>
        <li>Envía la ubicación del problema, no necesariamente la de tu casa.</li>
        <li>Este canal no atiende emergencias: llama al 131 (SAMU), 132 (Bomberos) o 133 (Carabineros).</li>
      </ul>
    ),
  },
  {
    titulo: "11. Contacto",
    contenido: (
      <p>Delegado de protección de datos: <Valor>{C.delegado}</Valor>. Correo: <Valor>{C.correo}</Valor>.</p>
    ),
  },
];

export default function Privacidad() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--fondo)", fontSize: 16 }}>
      <header style={{ background: "var(--marino)", color: "#fff" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px" }}>
          <Logo tamano={30} subtitulo="Municipalidad de Buin" />
        </div>
      </header>
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "28px 16px 56px", lineHeight: 1.7 }}>
        <div className="rotulo">Versión {C.version} | {C.fecha}</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.02em", margin: "8px 0 12px" }}>Política de privacidad y tratamiento de datos personales</h1>
        <p style={{ color: "var(--texto-2)", margin: "0 0 28px" }}>
          En resumen: usamos tu número, tus mensajes, tus fotos y la ubicación que nos envías <strong>solo para atender tus reportes y avisarte su avance</strong>. Puedes pedir ver o eliminar tus datos en cualquier momento, escribiendo <strong>mis datos</strong> o <strong>eliminar mis datos</strong> al WhatsApp de la Municipalidad.
        </p>
        {secciones.map((s, i) => (
          <section key={s.titulo} className="panel anim-arriba" style={{ padding: "18px 22px", marginBottom: 12, ["--i" as any]: Math.min(i, 6) }}>
            <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>{s.titulo}</h2>
            <div style={{ color: "var(--texto-2)" }}>{s.contenido}</div>
          </section>
        ))}
        <p style={{ color: "var(--texto-3)", fontSize: 13, marginTop: 24 }}>
          Normativa aplicable: Ley N° 19.628 sobre protección de la vida privada, modificada por la Ley N° 21.719; Ley N° 18.695, Orgánica Constitucional de Municipalidades; Ley N° 20.285 sobre acceso a la información pública.
          {" "}<a href="/seguimiento">Revisar el avance de un reporte</a>.
        </p>
      </main>
    </div>
  );
}
