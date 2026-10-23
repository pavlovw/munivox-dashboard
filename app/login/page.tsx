"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FiShield, FiLock, FiMail, FiAlertCircle } from 'react-icons/fi';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError('');

    const res = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (res?.error) {
      setError('Credenciales inválidas. Acceso denegado por seguridad.');
      setCargando(false);
    } else {
      router.push('/'); // Redirige al Dashboard general para que el sistema decida a dónde enviarlo
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F4F7FE', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* PANEL IZQUIERDO - INFORMACIÓN MUNICIPAL */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '800px', height: '800px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', top: '-200px', left: '-200px' }}></div>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: '500px' }}>
          <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '20px', backdropFilter: 'blur(10px)', width: 'fit-content', marginBottom: '24px' }}>
            <FiShield size={40} color="white" />
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 900, margin: '0 0 16px 0', letterSpacing: '-1px' }}>MuniVox C4</h1>
          <h2 style={{ fontSize: '24px', fontWeight: 300, color: '#bae6fd', margin: '0 0 32px 0' }}>Sistema de Gestión Territorial Activa</h2>
          <p style={{ fontSize: '16px', lineHeight: 1.6, color: '#e0f2fe', margin: '0 0 24px 0' }}>
            Acceso restringido para operadores y analistas de la Ilustre Municipalidad de Buin. Toda interacción en esta plataforma se encuentra bajo auditoría y trazabilidad estricta.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px 20px', borderRadius: '12px', width: 'fit-content' }}>
            <span style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%' }}></span>
            CONEXIÓN SEGURA CIFRADA (E2EE)
          </div>
        </div>
      </div>

      {/* PANEL DERECHO - FORMULARIO LOGIN */}
      <div style={{ width: '500px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px', boxShadow: '-10px 0 30px rgba(0,0,0,0.05)', zIndex: 20 }}>
        
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b', margin: '0 0 8px 0' }}>Iniciar Sesión</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Ingresa tus credenciales operativas.</p>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '14px', borderRadius: '12px', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <FiAlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Correo Institucional</label>
            <div style={{ position: 'relative' }}>
              <FiMail style={{ position: 'absolute', left: '16px', top: '16px', color: '#94a3b8' }} size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@munivox.cl" 
                style={{ width: '100%', padding: '14px 14px 14px 44px', backgroundColor: '#F8FAFC', border: '1px solid #e2e8f0', borderRadius: '14px', fontSize: '14px', outline: 'none', color: '#1e293b', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Contraseña Operativa</label>
            <div style={{ position: 'relative' }}>
              <FiLock style={{ position: 'absolute', left: '16px', top: '16px', color: '#94a3b8' }} size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                style={{ width: '100%', padding: '14px 14px 14px 44px', backgroundColor: '#F8FAFC', border: '1px solid #e2e8f0', borderRadius: '14px', fontSize: '14px', outline: 'none', color: '#1e293b', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={cargando}
            style={{ marginTop: '12px', width: '100%', padding: '16px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '14px', fontSize: '14px', fontWeight: 'bold', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1, transition: 'background-color 0.2s', boxShadow: '0 4px 6px rgba(37,99,235,0.2)' }}
          >
            {cargando ? 'AUTENTICANDO...' : 'INGRESAR AL SISTEMA C4'}
          </button>
        </form>

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
            Para recuperar credenciales o solicitar nuevos accesos, comuníquese con la Dirección de Informática (DTI).
          </p>
        </div>

      </div>
    </div>
  );
}