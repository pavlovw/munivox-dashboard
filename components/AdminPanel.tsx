"use client";

import { useState } from 'react';
import { FiUsers, FiBriefcase, FiShieldOff, FiDatabase, FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

export default function AdminPanel() {
  const [pestañaActiva, setPestañaActiva] = useState<'OPERADORES' | 'DEPARTAMENTOS' | 'CIUDADANOS'>('OPERADORES');

  // Datos simulados (luego los conectarás a tu API de Express)
  const operadoresDummy = [
    { id: '1', nombre: 'Juan Pérez', email: 'operador@munivox.cl', rol: 'OPERADOR', depto: 'Central C4' },
    { id: '2', nombre: 'María González', email: 'admin@munivox.cl', rol: 'ADMINISTRADOR', depto: 'Alcaldía' },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
      
      {/* MENÚ LATERAL DE ADMINISTRACIÓN */}
      <div style={{ width: '240px', backgroundColor: '#F8FAFC', borderRight: '1px solid #e2e8f0', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', paddingLeft: '12px' }}>Ajustes del Sistema</h3>
        
        <button 
          onClick={() => setPestañaActiva('OPERADORES')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px', textAlign: 'left', transition: 'all 0.2s',
            backgroundColor: pestañaActiva === 'OPERADORES' ? '#e0f2fe' : 'transparent', 
            color: pestañaActiva === 'OPERADORES' ? '#0284c7' : '#64748b' 
          }}>
          <FiUsers size={16} /> Gestión de Operadores
        </button>

        <button 
          onClick={() => setPestañaActiva('DEPARTAMENTOS')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px', textAlign: 'left', transition: 'all 0.2s',
            backgroundColor: pestañaActiva === 'DEPARTAMENTOS' ? '#e0f2fe' : 'transparent', 
            color: pestañaActiva === 'DEPARTAMENTOS' ? '#0284c7' : '#64748b' 
          }}>
          <FiBriefcase size={16} /> Departamentos / Áreas
        </button>

        <button 
          onClick={() => setPestañaActiva('CIUDADANOS')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px', textAlign: 'left', transition: 'all 0.2s',
            backgroundColor: pestañaActiva === 'CIUDADANOS' ? '#fee2e2' : 'transparent', 
            color: pestañaActiva === 'CIUDADANOS' ? '#e11d48' : '#64748b' 
          }}>
          <FiShieldOff size={16} /> Ciudadanos Baneados
        </button>
      </div>

      {/* ÁREA DE TRABAJO (CRUD CONTROLADO) */}
      <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        
        {pestañaActiva === 'OPERADORES' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', margin: '0 0 4px 0' }}>Funcionarios y Operadores</h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Cuentas autorizadas para operar MuniVox C4.</p>
              </div>
              <button style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#2563EB', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}>
                <FiPlus /> Nuevo Operador
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Nombre</th>
                  <th style={{ padding: '12px 16px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Email Institucional</th>
                  <th style={{ padding: '12px 16px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Rol</th>
                  <th style={{ padding: '12px 16px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {operadoresDummy.map(op => (
                  <tr key={op.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{op.nombre}</td>
                    <td style={{ padding: '16px', fontSize: '12px', color: '#64748b' }}>{op.email}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px', backgroundColor: op.rol === 'ADMINISTRADOR' ? '#f3e8ff' : '#e0f2fe', color: op.rol === 'ADMINISTRADOR' ? '#7e22ce' : '#0284c7' }}>
                        {op.rol}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', marginRight: '12px' }}><FiEdit2 size={16} /></button>
                      <button style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><FiTrash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Aquí irían los otros módulos (Departamentos, Baneados) con la misma lógica */}
        {pestañaActiva === 'CIUDADANOS' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
            <FiShieldOff size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ fontSize: '14px', fontWeight: 600 }}>Lista negra de ciudadanos por mal uso del sistema.</p>
          </div>
        )}

      </div>
    </div>
  );
}