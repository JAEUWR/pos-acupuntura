'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Configuracion({ perfilActual }) {
    const { t } = useLanguage();

    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('recepcionista');
    const [newBranch, setNewBranch] = useState('null');

    const fetchUsuarios = async () => {
        const { data } = await supabase.from('perfiles_usuarios').select('*').order('nombre');
        if (data) setUsuarios(data);
        setLoading(false);
    };

    useEffect(() => {
        if (perfilActual?.rol === 'admin') fetchUsuarios();
    }, [perfilActual]);

    const actualizarCampo = async (userId, campo, valor) => {
        const { error } = await supabase.from('perfiles_usuarios').update({ [campo]: valor }).eq('id', userId);
        if (error) alert(`Error: ${error.message}`);
        else fetchUsuarios();
    };

    const togglePermiso = async (userId, permisosActuales, permisoTocado) => {
        let nuevosPermisos = permisosActuales ? [...permisosActuales] : [];
        if (nuevosPermisos.includes(permisoTocado)) {
            nuevosPermisos = nuevosPermisos.filter(p => p !== permisoTocado);
        } else {
            nuevosPermisos.push(permisoTocado);
        }
        
        const { error } = await supabase.from('perfiles_usuarios').update({ permisos: nuevosPermisos }).eq('id', userId);
        if (error) alert(`${t('errorActualizandoPermisos') || 'Error:'} ${error.message}`);
        else fetchUsuarios();
    };

    const crearUsuario = async () => {
        if (!newEmail || !newPassword || !newName) return alert(t('faltanCampos') || 'Faltan campos por llenar.');
        
        const { error } = await supabase.auth.signUp({
            email: newEmail,
            password: newPassword,
            options: {
                data: {
                    nombre: newName,
                    rol: newRole,
                    sucursal_id: newBranch === 'null' ? null : parseInt(newBranch)
                }
            }
        });

        if (error) alert(`${t('errorCrearUsuario') || 'Error:'} ${error.message}`);
        else {
            alert(t('usuarioCreadoExito') || 'Usuario creado con éxito.');
            window.location.reload(); 
        }
    };

    // VISTA RESTRINGIDA PARA NO-ADMINS
    if (perfilActual?.rol !== 'admin') {
        return (
            <div className="view-section active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: 'var(--bg-main)' }}>
                <div style={{ textAlign: 'center', background: 'var(--bg-panel)', padding: '50px', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', maxWidth: '400px' }}>
                    <div style={{background: 'rgba(211, 47, 47, 0.1)', width: '100px', height: '100px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px auto'}}>
                        <i className="fa-solid fa-shield-halved" style={{ fontSize: '3.5rem', color: 'var(--primary-red)' }}></i>
                    </div>
                    <h2 style={{color: 'var(--text-main)', marginBottom: '15px'}}>{t('accesoRestringido') || 'Acceso Restringido'}</h2>
                    <p style={{color: 'var(--text-muted)', lineHeight: '1.5'}}>{t('soloAdminConfig') || 'El panel de control de usuarios y permisos está reservado únicamente para Administradores Globales.'}</p>
                </div>
            </div>
        );
    }

    const modulosDisponibles = ['ventas', 'caja', 'inventario', 'promociones', 'reportes', 'clientes', 'escritorioMedico', 'configuracion', 'doctores'];

    return (
        <div className="view-section active" style={{ overflowY: 'auto', flexDirection: 'column', gap: '25px', paddingRight: '5px' }}>
            
            <div className="panel" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                
                {/* HEADER DEL PANEL */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '25px 30px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)' }}>
                    <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-users-gear" style={{ color: 'var(--accent)', marginRight: '10px' }}></i> {t('gestionUsuariosPermisos') || 'Gestión de Usuarios y Permisos'}</h2>
                    <button className="btn-primary" onClick={() => setShowModal(true)} style={{padding: '12px 25px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'}}>
                        <i className="fa-solid fa-user-plus" style={{marginRight: '8px'}}></i> {t('registrarEmpleado') || 'Registrar Empleado'}
                    </button>
                </div>

                {/* TABLA DE USUARIOS */}
                {loading ? (
                    <div style={{textAlign: 'center', padding: '60px', color: 'var(--accent)'}}>
                        <i className="fa-solid fa-circle-notch fa-spin fa-3x"></i>
                        <p style={{marginTop:'15px', color: 'var(--text-muted)', fontWeight: 'bold'}}>{t('cargandoPersonal') || 'Cargando personal...'}</p>
                    </div>
                ) : (
                    <div style={{overflowX: 'auto'}}>
                        <table className="data-table" style={{ minWidth: '1000px' }}>
                            <thead style={{background: 'var(--bg-main)'}}>
                                <tr>
                                    <th style={{padding: '15px 30px'}}>{t('empleado') || 'Empleado'}</th>
                                    <th>{t('rolPrincipal') || 'Rol Principal'}</th>
                                    <th>{t('clinica') || 'Clínica Asignada'}</th>
                                    <th>{t('permisosAccesoModulos') || 'Permisos y Acceso a Módulos'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map(user => {
                                    const isGlobalAdmin = user.rol === 'admin';
                                    return (
                                        <tr key={user.id}>
                                            <td style={{padding: '20px 30px'}}>
                                                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                                                    <div style={{width: '45px', height: '45px', borderRadius: '50%', background: isGlobalAdmin ? 'rgba(211, 47, 47, 0.1)' : 'var(--bg-dark)', color: isGlobalAdmin ? 'var(--primary-red)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: isGlobalAdmin ? '1px solid rgba(211, 47, 47, 0.3)' : '1px solid var(--border-color)'}}>
                                                        <i className={isGlobalAdmin ? "fa-solid fa-user-tie" : "fa-solid fa-user"}></i>
                                                    </div>
                                                    <div>
                                                        <strong style={{color: 'var(--text-main)', fontSize: '1.05rem', display: 'block', marginBottom: '4px'}}>{user.nombre}</strong>
                                                        <span style={{fontSize: '0.75rem', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px', background: user.activo ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)', color: user.activo ? 'var(--success)' : 'var(--primary-red)'}}>
                                                            {user.activo ? <><i className="fa-solid fa-circle-check"></i> {t('activo') || 'Activo'}</> : <><i className="fa-solid fa-circle-xmark"></i> {t('suspendido') || 'Suspendido'}</>}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <select 
                                                    value={user.rol} 
                                                    onChange={(e) => actualizarCampo(user.id, 'rol', e.target.value)} 
                                                    disabled={user.id === perfilActual.id}
                                                    style={{ background: 'var(--bg-main)', color: 'var(--text-main)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', cursor: user.id === perfilActual.id ? 'not-allowed' : 'pointer', opacity: user.id === perfilActual.id ? 0.6 : 1 }} 
                                                >
                                                    <option value="recepcionista">{t('recepcionista') || 'Recepcionista'}</option>
                                                    <option value="gerente">{t('gerente') || 'Gerente'}</option>
                                                    <option value="admin">{t('adminGlobal') || 'Administrador Global'}</option>
                                                </select>
                                            </td>
                                            <td>
                                                <select 
                                                    value={user.sucursal_id === null ? 'null' : user.sucursal_id} 
                                                    onChange={(e) => actualizarCampo(user.id, 'sucursal_id', e.target.value === 'null' ? null : parseInt(e.target.value))} 
                                                    style={{ background: 'var(--bg-main)', color: 'var(--text-main)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', cursor: 'pointer' }}
                                                >
                                                    <option value="null">{t('todasGlobal') || 'Todas (Global)'}</option>
                                                    <option value="1">Nápoles</option>
                                                    <option value="2">Obrera</option>
                                                    <option value="3">Pedregal</option>
                                                </select>
                                            </td>
                                            <td>
                                                {/* PÍLDORAS INTELIGENTES DE PERMISOS */}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {modulosDisponibles.map(mod => {
                                                        const hasPerm = (user.permisos || []).includes(mod);
                                                        const isChecked = isGlobalAdmin || hasPerm;
                                                        
                                                        return (
                                                            <label 
                                                                key={mod} 
                                                                style={{ 
                                                                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 'bold',
                                                                    padding: '6px 12px', borderRadius: '20px', 
                                                                    cursor: isGlobalAdmin ? 'not-allowed' : 'pointer', 
                                                                    background: isChecked ? 'rgba(2, 132, 199, 0.1)' : 'var(--bg-main)',
                                                                    color: isChecked ? 'var(--accent)' : 'var(--text-muted)',
                                                                    border: isChecked ? '1px solid var(--accent)' : '1px dashed var(--border-color)',
                                                                    opacity: isGlobalAdmin ? 0.7 : 1, transition: 'all 0.2s ease', userSelect: 'none'
                                                                }}
                                                            >
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isChecked} 
                                                                    disabled={isGlobalAdmin}
                                                                    onChange={() => togglePermiso(user.id, user.permisos, mod)}
                                                                    style={{ display: 'none' }} // Ocultamos el checkbox nativo
                                                                />
                                                                <i className={isGlobalAdmin ? "fa-solid fa-lock" : (isChecked ? "fa-solid fa-check" : "fa-solid fa-plus")}></i>
                                                                {t(mod) || mod.charAt(0).toUpperCase() + mod.slice(1)}
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL DE ALTA DE EMPLEADO (GLASSMORPHISM) */}
            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '480px', border: '1px solid var(--accent)', boxShadow: '0 10px 40px rgba(2, 132, 199, 0.15)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '25px', color: 'var(--text-main)', fontSize: '1.4rem', textAlign: 'center'}}><i className="fa-solid fa-user-plus" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('altaNuevoEmpleado') || 'Alta de Nuevo Empleado'}</h3>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px'}}>
                            <div>
                                <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('nombreCompleto') || 'Nombre Completo'} *</label>
                                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Dr. Juan Pérez" style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', outline: 'none'}} />
                            </div>
                            
                            <div>
                                <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('correoLogin') || 'Correo de Acceso'} *</label>
                                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="ejemplo@acupunturahk.com" style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', outline: 'none'}} />
                            </div>

                            <div>
                                <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('contrasenaTemporal') || 'Contraseña Temporal'} *</label>
                                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', outline: 'none'}} />
                            </div>
                        </div>
                        
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'35px'}}>
                            <div>
                                <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('rol') || 'Rol'}</label>
                                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', outline: 'none'}}>
                                    <option value="recepcionista">{t('recepcionista') || 'Recepcionista'}</option>
                                    <option value="gerente">{t('gerente') || 'Gerente'}</option>
                                    <option value="admin">{t('adminGlobal') || 'Administrador Global'}</option>
                                </select>
                            </div>
                            <div>
                                <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('clinicaAsignada') || 'Clínica Asignada'}</label>
                                <select value={newBranch} onChange={(e) => setNewBranch(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', outline: 'none'}}>
                                    <option value="null">{t('todasGlobal') || 'Todas (Global)'}</option>
                                    <option value="1">Nápoles</option>
                                    <option value="2">Obrera</option>
                                    <option value="3">Pedregal</option>
                                </select>
                            </div>
                        </div>

                        <div style={{display:'flex', gap:'15px'}}>
                            <button className="btn-action" style={{flex:1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold'}} onClick={() => setShowModal(false)}>{t('cancelar') || 'Cancelar'}</button>
                            <button className="btn-primary" style={{flex:2, padding: '16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}} onClick={crearUsuario}><i className="fa-solid fa-user-check"></i> {t('crearCuenta') || 'Crear Cuenta'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}