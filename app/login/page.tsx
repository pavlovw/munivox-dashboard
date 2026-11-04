"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiLock, FiMail, FiAlertTriangle, FiEye, FiEyeOff, FiArrowRight, FiMessageSquare, FiCpu, FiMap } from "react-icons/fi";
import { Logo } from "../../components/ui/Comunes";

const ERRORES: Record<string, string> = {
  CredentialsSignin: "Correo o contraseña incorrectos.",
  NUEVA_CLAVE: "Tu cuenta tiene una contraseña temporal. Pide a la Dirección de Informática que la active.",
  CONFIGURACION: "El sistema no tiene configurado el acceso a Cognito. Avisa a soporte.",
  CONEXION: "No hay conexión con el servicio de autenticación. Intenta en unos minutos.",
};

const ETAPAS = [
  { icono: <FiMessageSquare size={16} />, titulo: "El vecino reporta por WhatsApp", texto: "Texto, fotografía y ubicación exacta." },
  { icono: <FiCpu size={16} />, titulo: "La IA clasifica y prioriza", texto: "Categoría, área responsable y nivel de riesgo." },
  { icono: <FiMap size={16} />, titulo: "La municipalidad despacha y resuelve", texto: "C4, jefaturas y terreno conectados en tiempo real." },
];

export default function Login() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    const res = await signIn("credentials", { redirect: false, email: email.trim(), password });
    if (res?.error) {
      setError(ERRORES[res.error] || ERRORES.CredentialsSignin);
      setIntento(i => i + 1);
      setCargando(false);
    } else {
      router.replace("/");
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* PANEL INSTITUCIONAL */}
      <div className="fondo-rejilla oculto-movil" style={{ flex: 1, position: "relative", overflow: "hidden", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px 56px" }}>
        <span style={{ position: "absolute", left: 0, right: 0, height: 120, background: "linear-gradient(180deg, transparent, rgba(76,125,255,0.10), transparent)", animation: "escaneo 7s linear infinite", pointerEvents: "none" }} />
        <div className="anim-arriba"><Logo tamano={36} subtitulo="Municipalidad de Buin" /></div>

        <div style={{ maxWidth: 520, position: "relative" }}>
          <div className="rotulo anim-arriba" style={{ color: "#4C7DFF", ["--i" as any]: 1 }}>Central de operaciones C4</div>
          <h1 className="anim-arriba" style={{ fontSize: 44, lineHeight: 1.08, fontWeight: 700, letterSpacing: "-0.03em", margin: "12px 0 18px", ["--i" as any]: 2 }}>
            Cada reporte de un vecino,<br />atendido y trazable.
          </h1>
          <p className="anim-arriba" style={{ color: "var(--marino-texto)", fontSize: 15, lineHeight: 1.6, margin: 0, ["--i" as any]: 3 }}>
            Plataforma de gestión de incidencias urbanas: baches, microbasurales, luminarias, vehículos abandonados, ruidos, señalética, áreas verdes y animales.
          </p>

          <div style={{ marginTop: 36, borderLeft: "1px solid var(--marino-borde)" }}>
            {ETAPAS.map((e, i) => (
              <div key={e.titulo} className="anim-izquierda fila" style={{ gap: 14, padding: "12px 0 12px 18px", position: "relative", animationDelay: `${300 + i * 140}ms`, alignItems: "flex-start" }}>
                <span style={{ position: "absolute", left: -5, top: 20, width: 9, height: 9, background: "#4C7DFF" }} />
                <span style={{ width: 34, height: 34, border: "1px solid var(--marino-borde)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#4C7DFF", flexShrink: 0, background: "var(--marino-2)" }}>{e.icono}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{e.titulo}</div>
                  <div style={{ color: "var(--marino-texto)", fontSize: 12.5, marginTop: 2 }}>{e.texto}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="fila anim-aparecer" style={{ gap: 10, color: "var(--marino-texto)", fontSize: 11.5, animationDelay: "700ms" }}>
          <span className="vivo" /> Acceso exclusivo para personal municipal. Toda acción queda registrada.
        </div>
      </div>

      {/* FORMULARIO */}
      <div style={{ width: "min(100%, 480px)", background: "var(--superficie)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 44px", borderLeft: "1px solid var(--borde)", margin: "0 auto" }}>
        <div className="anim-arriba" style={{ marginBottom: 32 }}>
          <div className="rotulo">Iniciar sesión</div>
          <h2 className="titulo-1" style={{ marginTop: 6 }}>Ingresa con tu cuenta institucional</h2>
          <p className="texto-3" style={{ margin: "8px 0 0", fontSize: 13 }}>El sistema te llevará a tu panel según tu rol: central C4, jefatura o terreno.</p>
        </div>

        {error && (
          <div key={intento} className="anim-sacudir fila" role="alert" style={{ gap: 10, alignItems: "flex-start", background: "var(--peligro-suave)", borderLeft: "3px solid var(--peligro)", color: "#8F1D1D", padding: "10px 12px", fontSize: 12.5, marginBottom: 18 }}>
            <FiAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        <form onSubmit={enviar} className="columna" style={{ gap: 16 }}>
          <label className="campo anim-arriba" style={{ ["--i" as any]: 1 }}>
            <span className="rotulo">Correo institucional</span>
            <div className="input-con-icono">
              <FiMail size={15} />
              <input className="input" style={{ height: 44 }} type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@municipalidad.cl" />
            </div>
          </label>
          <label className="campo anim-arriba" style={{ ["--i" as any]: 2 }}>
            <span className="rotulo">Contraseña</span>
            <div className="input-con-icono" style={{ position: "relative" }}>
              <FiLock size={15} />
              <input className="input" style={{ height: 44, paddingRight: 44 }} type={verClave ? "text" : "password"} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" onClick={() => setVerClave(!verClave)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                style={{ position: "absolute", right: 1, top: 1, bottom: 1, width: 42, border: 0, borderLeft: "1px solid var(--borde)", background: "var(--superficie-2)", color: "var(--texto-2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {verClave ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
          </label>
          <button type="submit" disabled={cargando} className="btn btn-primario btn-lg btn-bloque anim-arriba" style={{ marginTop: 8, ["--i" as any]: 3 }}>
            {cargando ? <><span className="girador" style={{ width: 14, height: 14, borderColor: "rgba(255,255,255,.35)", borderTopColor: "#fff" }} /> Verificando credenciales</> : <>Ingresar <FiArrowRight size={16} /></>}
          </button>
        </form>

        <div className="texto-3 anim-aparecer" style={{ marginTop: 40, paddingTop: 18, borderTop: "1px solid var(--borde)", fontSize: 11.5, lineHeight: 1.6, animationDelay: "400ms" }}>
          Para crear una cuenta o recuperar el acceso, comunícate con la Dirección de Informática de la Municipalidad de Buin.
          <div style={{ marginTop: 10 }}><a href="/privacidad">Política de privacidad</a> | <a href="/seguimiento">Vecinos: revisar un reporte</a></div>
        </div>
      </div>
    </div>
  );
}
