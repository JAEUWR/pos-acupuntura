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
        if (error) alert(`${t('errorActualizandoPermisos')}${error.message}`);
        else fetchUsuarios();
    };

    const crearUsuario = async () => {
        if (!newEmail || !newPassword || !newName) return alert(t('faltanCampos'));
        
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

        if (error) alert(`${t('errorCrearUsuario')}${error.message}`);
        else {
            alert(t('usuarioCreadoExito'));
            window.location.reload(); 
        }
    };

    if (perfilActual?.rol !== 'admin') {
        return (
            <div className="view-section active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-shield-halved" style={{ fontSize: '3rem', marginBottom: '15px' }}></i>
                    <h2>{t('accesoRestringido')}</h2>
                    <p>{t('soloAdminConfig')}</p>
                </div>
            </div>
        );
    }

    const modulosDisponibles = ['ventas', 'inventario', 'promociones', 'reportes', 'clientes', 'configuracion', 'doctores'];

    return (
        <div className="view-section active" style={{ overflowY: 'auto' }}>
            <div className="panel" style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2><i className="fa-solid fa-users-gear" style={{ color: 'var(--accent)', marginRight: '10px' }}></i> {t('gestionUsuariosPermisos')}</h2>
                    <button className="btn-action btn-primary" onClick={() => setShowModal(true)}>+ {t('registrarEmpleado')}</button>
                </div>

                {loading ? <p style={{ color: 'white' }}>{t('cargandoPersonal')}</p> : (
                    <table className="data-table" style={{ minWidth: '1000px' }}>
                        <thead>
                            <tr>
                                <th>{t('empleado')}</th>
                                <th>{t('rolPrincipal')}</th>
                                <th>{t('clinica')}</th>
                                <th>{t('permisosAccesoModulos')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usuarios.map(user => (
                                <tr key={user.id}>
                                    <td>
                                        <strong>{user.nombre}</strong>
                                        <div style={{fontSize: '0.75rem', color: user.activo ? 'var(--success)' : 'var(--primary-red)'}}>
                                            {user.activo ? t('activo') : t('suspendido')}
                                        </div>
                                    </td>
                                    <td>
                                        <select value={user.rol} onChange={(e) => actualizarCampo(user.id, 'rol', e.target.value)} style={{ background: 'var(--bg-dark)', color: 'white', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)' }} disabled={user.id === perfilActual.id}>
                                            <option value="recepcionista">{t('recepcionista')}</option>
                                            <option value="gerente">{t('gerente')}</option>
                                            <option value="admin">{t('adminGlobal')}</option>
                                        </select>
                                    </td>
                                    <td>
                                        <select value={user.sucursal_id === null ? 'null' : user.sucursal_id} onChange={(e) => actualizarCampo(user.id, 'sucursal_id', e.target.value === 'null' ? null : parseInt(e.target.value))} style={{ background: 'var(--bg-dark)', color: 'white', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                            <option value="null">{t('todasGlobal')}</option>
                                            <option value="1">Nápoles</option>
                                            <option value="2">Obrera</option>
                                            <option value="3">Pedregal</option>
                                        </select>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                            {modulosDisponibles.map(mod => {
                                                const hasPerm = (user.permisos || []).includes(mod);
                                                const isGlobalAdmin = user.rol === 'admin';
                                                return (
                                                    <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', cursor: isGlobalAdmin ? 'not-allowed' : 'pointer', opacity: isGlobalAdmin ? 0.5 : 1 }}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isGlobalAdmin || hasPerm} 
                                                            disabled={isGlobalAdmin}
                                                            onChange={() => togglePermiso(user.id, user.permisos, mod)}
                                                        />
                                                        {mod.charAt(0).toUpperCase() + mod.slice(1)}
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '450px'}}>
                        <h3 style={{marginBottom: '20px'}}><i className="fa-solid fa-user-plus"></i> {t('altaNuevoEmpleado')}</h3>
                        
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('nombreCompleto')} style={{width:'100%', padding:'10px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t('correoLogin')} style={{width:'100%', padding:'10px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('contrasenaTemporal')} style={{width:'100%', padding:'10px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'20px'}}>
                            <div>
                                <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('rol')}</label>
                                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                                    <option value="recepcionista">{t('recepcionista')}</option>
                                    <option value="gerente">{t('gerente')}</option>
                                    <option value="admin">{t('adminGlobal')}</option>
                                </select>
                            </div>
                            <div>
                                <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('clinicaAsignada')}</label>
                                <select value={newBranch} onChange={(e) => setNewBranch(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                                    <option value="null">{t('todasGlobal')}</option>
                                    <option value="1">Nápoles</option>
                                    <option value="2">Obrera</option>
                                    <option value="3">Pedregal</option>
                                </select>
                            </div>
                        </div>

                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1, padding: '12px'}} onClick={crearUsuario}>{t('crearCuenta')}</button>
                            <button className="btn-action" style={{flex:1, padding: '12px'}} onClick={() => setShowModal(false)}>{t('cancelar')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}