'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Clientes({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage();
    const [pacientes, setPacientes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Vistas: 'directorio', 'formulario'
    const [vista, setVista] = useState('directorio');
    const [pacienteEditando, setPacienteEditando] = useState(null);

    // Estados del Formulario (Datos Generales)
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [fechaNac, setFechaNac] = useState('');
    const [sexo, setSexo] = useState('');
    const [estadoCivil, setEstadoCivil] = useState('');
    const [ocupacion, setOcupacion] = useState('');
    const [curp, setCurp] = useState('');
    const [motivoSinCurp, setMotivoSinCurp] = useState('');
    const [correo, setCorreo] = useState('');
    const [domicilio, setDomicilio] = useState('');
    const [emergenciaNombre, setEmergenciaNombre] = useState('');
    const [emergenciaParentesco, setEmergenciaParentesco] = useState('');
    const [emergenciaTelefono, setEmergenciaTelefono] = useState('');
    const [idioma, setIdioma] = useState('Español');
    const [sabeIngles, setSabeIngles] = useState(false);
    const [responsable, setResponsable] = useState('');
    const [avisoPrivacidad, setAvisoPrivacidad] = useState(false);
    
    // Estado Nota Interna (Staff)
    const [notaInterna, setNotaInterna] = useState('');

    // Estados del Formulario (Alertas Clínicas)
    const [alertas, setAlertas] = useState([]); 
    const [nuevaAlertaTipo, setNewAlertaTipo] = useState('');
    const [nuevaAlertaDesc, setNewAlertaDesc] = useState('');

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const fetchPacientes = async () => {
        const { data, error } = await supabase
            .from('clientes')
            .select(`
                *,
                alertas_clinicas (id, tipo_alerta, descripcion, nivel_gravedad, activa)
            `)
            .order('nombre', { ascending: true });
        
        if (data) setPacientes(data);
    };

    useEffect(() => {
        fetchPacientes();
    }, []);

    const resetForm = () => {
        setPacienteEditando(null); setNombre(''); setTelefono(''); setFechaNac(''); setSexo('');
        setEstadoCivil(''); setOcupacion('');
        setCurp(''); setMotivoSinCurp(''); setCorreo(''); setDomicilio(''); setEmergenciaNombre('');
        setEmergenciaParentesco(''); setEmergenciaTelefono(''); setIdioma('Español'); setSabeIngles(false);
        setResponsable(''); setAvisoPrivacidad(false); setNotaInterna('');
        setAlertas([]); setNewAlertaTipo(''); setNewAlertaDesc('');
    };

    const abrirFormulario = (paciente = null) => {
        if (paciente) {
            setPacienteEditando(paciente.id);
            setNombre(paciente.nombre || '');
            setTelefono(paciente.telefono || '');
            setFechaNac(paciente.fecha_nacimiento || '');
            setSexo(paciente.sexo || '');
            setEstadoCivil(paciente.estado_civil || '');
            setOcupacion(paciente.ocupacion || '');
            setCurp(paciente.curp || '');
            setMotivoSinCurp(paciente.motivo_sin_curp || '');
            setCorreo(paciente.correo || '');
            setDomicilio(paciente.domicilio || '');
            setEmergenciaNombre(paciente.contacto_emergencia_nombre || '');
            setEmergenciaParentesco(paciente.contacto_emergencia_parentesco || '');
            setEmergenciaTelefono(paciente.contacto_emergencia_telefono || '');
            setIdioma(paciente.idioma_preferente || 'Español');
            setSabeIngles(paciente.sabe_ingles || false);
            setResponsable(paciente.responsable_legal || '');
            setAvisoPrivacidad(paciente.aviso_privacidad_aceptado || false); 
            setNotaInterna(paciente.nota_interna || ''); 
            
            setAlertas(paciente.alertas_clinicas?.filter(a => a.activa) || []);
        } else {
            resetForm();
        }
        setVista('formulario');
    };

    const agregarAlerta = () => {
        if (!nuevaAlertaTipo || !nuevaAlertaDesc) return;
        
        let gravedad = 'media';
        if (nuevaAlertaTipo === 'Marcapasos' || nuevaAlertaTipo === 'Alergia' || nuevaAlertaTipo === 'Enfermedad Transmisible') gravedad = 'alta';
        
        setAlertas([...alertas, { tipo_alerta: nuevaAlertaTipo, descripcion: nuevaAlertaDesc, nivel_gravedad: gravedad }]);
        setNewAlertaTipo(''); setNewAlertaDesc('');
    };

    const quitarAlertaTemporal = (index) => {
        setAlertas(alertas.filter((_, i) => i !== index));
    };

    const guardarExpediente = async () => {
        if (!nombre || !telefono || !sexo || !fechaNac || !estadoCivil) return alert(t('camposObligatoriosGeneral') || 'Faltan campos obligatorios (Nombre, Tel, Sexo, Fecha Nac, Estado Civil).');
        if (!avisoPrivacidad) return alert(t('aceptarAviso') || 'Debes aceptar el Aviso de Privacidad.');

        if (!pacienteEditando) {
            const duplicado = pacientes.find(p => (curp && p.curp === curp) || (p.telefono === telefono));
            if (duplicado) {
                if (!window.confirm(`${t('pacienteYaExiste') || 'Parece que este paciente ya existe'} (${duplicado.nombre}). ${t('confirmarCrearNuevo') || '¿Estás seguro de crear un registro nuevo?'}`)) return;
            }
        }

        const payload = {
            nombre: nombre.trim(), telefono: telefono.trim(), fecha_nacimiento: fechaNac, sexo,
            estado_civil: estadoCivil, ocupacion: ocupacion.trim(), sabe_ingles: sabeIngles,
            curp: curp.trim(), motivo_sin_curp: motivoSinCurp.trim(), correo: correo.trim(), domicilio: domicilio.trim(),
            contacto_emergencia_nombre: emergenciaNombre.trim(), contacto_emergencia_parentesco: emergenciaParentesco.trim(),
            contacto_emergencia_telefono: emergenciaTelefono.trim(), idioma_preferente: idioma, responsable_legal: responsable.trim(),
            nota_interna: notaInterna.trim(),
            aviso_privacidad_aceptado: avisoPrivacidad,
            aviso_privacidad_version: 'v1.0',
            aviso_privacidad_fecha: avisoPrivacidad && !pacienteEditando ? new Date().toISOString() : undefined 
        };
        
        let currentPacienteId = pacienteEditando;

        if (pacienteEditando) {
            const { error } = await supabase.from('clientes').update(payload).eq('id', pacienteEditando);
            if (error) return alert((t('errorActualizar') || 'Error al actualizar: ') + error.message);
        } else {
            payload.sucursal_alta_id = sucursalId; 
            const { data, error } = await supabase.from('clientes').insert([payload]).select();
            if (error) return alert((t('errorCrear') || 'Error al crear: ') + error.message);
            currentPacienteId = data[0].id;
        }

        if (pacienteEditando) {
            await supabase.from('alertas_clinicas').delete().eq('paciente_id', currentPacienteId);
        }
        
        if (alertas.length > 0) {
            const alertasPayload = alertas.map(a => ({
                paciente_id: currentPacienteId,
                tipo_alerta: a.tipo_alerta,
                descripcion: a.descripcion,
                nivel_gravedad: a.nivel_gravedad,
                registrado_por: perfilActual?.nombre || 'Administración'
            }));
            await supabase.from('alertas_clinicas').insert(alertasPayload);
        }

        alert(t('altaPacienteExito') || 'Paciente guardado exitosamente.');
        setVista('directorio');
        fetchPacientes();
    };

    const eliminarPaciente = async (id, nombreP) => {
        if (!window.confirm(`${t('confirmarEliminarExpediente') || '¿Estás seguro de que deseas eliminar permanentemente el expediente de'} ${nombreP}?\n\n${t('accionNoDeshacer') || 'Esta acción no se puede deshacer.'}`)) return;
        await supabase.from('alertas_clinicas').delete().eq('paciente_id', id);
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) {
            alert((t('errorEliminarExpediente') || 'Error al eliminar: Es probable que este paciente ya tenga ventas o historial clínico asociado y no pueda borrarse por seguridad. \n\nDetalle: ') + error.message);
        } else {
            alert(t('expedienteEliminadoExito') || 'Expediente duplicado eliminado correctamente.');
            fetchPacientes(); 
        }
    };

    const pacientesFiltrados = pacientes.filter(p => {
        const busqueda = searchTerm.toLowerCase();
        return (p.nombre && p.nombre.toLowerCase().includes(busqueda)) || 
               (p.telefono && p.telefono.includes(busqueda)) ||
               (p.num_expediente && p.num_expediente.toLowerCase().includes(busqueda)) ||
               (p.curp && p.curp.toLowerCase().includes(busqueda));
    });

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '25px', overflowY: 'auto', paddingRight: '5px'}}>
            
            {vista === 'directorio' && (
                <>
                    {/* BARRA DE BÚSQUEDA Y NUEVO PACIENTE */}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)', padding: '20px 25px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                        <div style={{position: 'relative', flex: 1, maxWidth: '600px', marginRight: '20px'}}>
                            <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)'}}></i>
                            <input 
                                type="text" 
                                placeholder={t('placeholderBuscarCliente') || 'Buscar por nombre, expediente o teléfono...'} 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                style={{width: '100%', padding: '14px 14px 14px 45px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', transition: 'all 0.3s'}}
                            />
                        </div>
                        <button className="btn-primary" onClick={() => abrirFormulario()} style={{padding: '14px 25px', fontSize: '1rem', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)', transition: 'all 0.3s'}}>
                            <i className="fa-solid fa-user-plus" style={{marginRight: '8px'}}></i> {t('nuevoPaciente') || 'Nuevo Paciente'}
                        </button>
                    </div>

                    {/* TABLA DEL DIRECTORIO */}
                    <div className="panel" style={{padding: 0, borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)'}}>
                        <table className="data-table">
                            <thead style={{background: 'var(--bg-main)'}}>
                                <tr>
                                    <th>{t('expediente') || 'Expediente'}</th>
                                    <th>{t('nombreCompleto') || 'Nombre Completo'}</th>
                                    <th>{t('telefono') || 'Teléfono'}</th>
                                    <th>{t('sexo') || 'Sexo'} / {t('edad') || 'Edad'}</th>
                                    <th><i className="fa-solid fa-triangle-exclamation" style={{color: 'var(--primary-red)', marginRight: '5px'}}></i> {t('alertasClinicas') || 'Alertas'} / {t('estado') || 'Estatus'}</th>
                                    <th style={{textAlign: 'center'}}>{t('acciones') || 'Acciones'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pacientesFiltrados.map(p => {
                                    let edad = 'N/A';
                                    if (p.fecha_nacimiento) {
                                        const diff = Date.now() - new Date(p.fecha_nacimiento).getTime();
                                        edad = Math.abs(new Date(diff).getUTCFullYear() - 1970);
                                    }
                                    const alertasActivas = p.alertas_clinicas?.filter(a => a.activa) || [];
                                    
                                    // CÁLCULO DE ALARMA DE ABANDONO (60 DÍAS)
                                    let abandonoTratamiento = false;
                                    let diasInactivo = 0;
                                    if (p.ultima_asistencia) {
                                        const diffTime = Date.now() - new Date(p.ultima_asistencia).getTime();
                                        diasInactivo = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                        if (diasInactivo > 60) abandonoTratamiento = true;
                                    }

                                    return (
                                        <tr key={p.id}>
                                            <td style={{fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 'bold'}}>{p.num_expediente || 'S/E'}</td>
                                            <td>
                                                <strong style={{color: 'var(--text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                    {p.nombre} 
                                                    {p.sabe_ingles && <span style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold'}}>🇺🇸 ENG</span>}
                                                </strong>
                                                <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{p.curp || (t('sinCurpAbrev') || 'Sin CURP')}</span>
                                            </td>
                                            <td style={{color: 'var(--text-main)'}}>{p.telefono || t('sinTelefono')}</td>
                                            <td><span style={{color: 'var(--text-main)'}}>{p.sexo || '-'}</span> <br/><span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{edad} {t('anos') || 'años'}</span></td>
                                            <td>
                                                <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
                                                    {abandonoTratamiento && (
                                                        <span style={{fontSize: '0.75rem', background: '#ea580c', color: 'white', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}} title={`${t('inactivoPor') || 'Inactivo por'} ${diasInactivo} ${t('dias') || 'días'}`}>
                                                            <i className="fa-solid fa-clock-rotate-left"></i> {t('abandonoTx') || 'Abandono de Tx'}
                                                        </span>
                                                    )}
                                                    {alertasActivas.map(a => (
                                                        <span key={a.id} style={{fontSize: '0.75rem', background: a.nivel_gravedad === 'alta' ? 'var(--primary-red)' : '#eab308', color: 'white', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
                                                            {t(a.tipo_alerta.replace(/\s+/g, '').toLowerCase()) || a.tipo_alerta}
                                                        </span>
                                                    ))}
                                                    {!abandonoTratamiento && alertasActivas.length === 0 && <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}><i className="fa-solid fa-check"></i> {t('alDia') || 'Al Día'}</span>}
                                                </div>
                                            </td>
                                            <td style={{textAlign: 'center'}}>
                                                <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                                                    <button className="btn-action" onClick={() => abrirFormulario(p)} style={{background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '8px 15px'}} title={t('editar') || 'Editar'}>
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button className="btn-action" onClick={() => eliminarPaciente(p.id, p.nombre)} style={{background: 'transparent', border: '1px solid transparent', color: 'var(--primary-red)', padding: '8px 15px', transition: 'all 0.2s'}} title={t('eliminar') || 'Eliminar'} onMouseEnter={e => e.currentTarget.style.border = '1px solid var(--primary-red)'} onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}>
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {pacientesFiltrados.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-folder-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('noExpedientes') || 'No se encontraron expedientes.'}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {vista === 'formulario' && (
                <div style={{display: 'flex', gap: '25px', alignItems: 'flex-start'}}>
                    
                    {/* COLUMNA IZQUIERDA: DATOS ADMINISTRATIVOS */}
                    <div className="panel" style={{flex: 2, background: 'var(--bg-panel)', borderRadius: '16px', padding: '35px', boxShadow: 'var(--shadow-sm)'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px'}}>
                            <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.5rem'}}><i className="fa-solid fa-id-card-clip" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {pacienteEditando ? (t('editarExpediente') || 'Editar Expediente') : (t('altaExpedienteClinico') || 'Alta de Expediente Clínico')}</h2>
                            {pacienteEditando && <span style={{background: 'var(--bg-main)', padding: '6px 15px', border: '1px solid var(--border-color)', borderRadius: '20px', fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 'bold'}}>{t('expAbrev') || 'Exp:'} {pacientes.find(p => p.id === pacienteEditando)?.num_expediente}</span>}
                        </div>

                        <h4 style={{color: 'var(--accent)', marginBottom: '20px', fontSize: '1.1rem'}}><i className="fa-solid fa-address-book" style={{marginRight: '8px'}}></i> {t('datosGeneralesNum') || '1. Datos Generales'}</h4>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px'}}>
                            <div><label className="form-label">{t('nombreCompleto')} *</label><input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="form-input" /></div>
                            <div><label className="form-label">{t('telefono')} *</label><input type="text" value={telefono} onChange={e => setTelefono(e.target.value)} className="form-input" /></div>
                            
                            <div><label className="form-label">{t('fechaNacimiento')} *</label><input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} className="form-input" /></div>
                            <div>
                                <label className="form-label">{t('sexo')} *</label>
                                <select value={sexo} onChange={e => setSexo(e.target.value)} className="form-input">
                                    <option value="">-- {t('seleccionar') || 'Seleccionar'} --</option>
                                    <option value="Femenino">{t('femenino') || 'Femenino'}</option>
                                    <option value="Masculino">{t('masculino') || 'Masculino'}</option>
                                    <option value="Otro">{t('otro') || 'Otro'}</option>
                                </select>
                            </div>

                            <div>
                                <label className="form-label">{t('estadoCivil') || 'Estado Civil'} *</label>
                                <select value={estadoCivil} onChange={e => setEstadoCivil(e.target.value)} className="form-input">
                                    <option value="">-- {t('seleccionar') || 'Seleccionar'} --</option>
                                    <option value="Soltero">{t('soltero') || 'Soltero(a)'}</option>
                                    <option value="Casado">{t('casado') || 'Casado(a)'}</option>
                                    <option value="Divorciado">{t('divorciado') || 'Divorciado(a)'}</option>
                                    <option value="Viudo">{t('viudo') || 'Viudo(a)'}</option>
                                    <option value="Unión Libre">{t('unionLibre') || 'Unión Libre'}</option>
                                    <option value="Otro">{t('otro') || 'Otro'}</option>
                                </select>
                            </div>
                            <div><label className="form-label">{t('ocupacion') || 'Ocupación'}</label><input type="text" value={ocupacion} onChange={e => setOcupacion(e.target.value)} className="form-input" placeholder={t('ejOcupacion') || 'Ej. Estudiante, Docente, Ing...'} /></div>

                            <div><label className="form-label">{t('curp')}</label><input type="text" value={curp} onChange={e => setCurp(e.target.value)} className="form-input" maxLength="18" placeholder="18 Caracteres" style={{textTransform: 'uppercase'}} /></div>
                            <div><label className="form-label">{t('sinCurp') || 'Motivo Sin CURP'}</label><input type="text" value={motivoSinCurp} onChange={e => setMotivoSinCurp(e.target.value)} className="form-input" placeholder="Ej. Extranjero, no lo recuerda..." disabled={curp.length > 0} style={{opacity: curp.length > 0 ? 0.5 : 1}} /></div>
                            
                            <div><label className="form-label">{t('correo')}</label><input type="email" value={correo} onChange={e => setCorreo(e.target.value)} className="form-input" /></div>
                            <div><label className="form-label">{t('idioma')}</label><input type="text" value={idioma} onChange={e => setIdioma(e.target.value)} className="form-input" /></div>
                            
                            <div style={{gridColumn: '1 / -1'}}><label className="form-label">{t('domicilio')}</label><input type="text" value={domicilio} onChange={e => setDomicilio(e.target.value)} className="form-input" placeholder="Calle, Número, Colonia, Alcaldía/Municipio, CP..." /></div>
                        </div>

                        {/* SWITCH HABLA INGLÉS */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', background: sabeIngles ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-main)', padding: '15px 20px', borderRadius: '12px', border: sabeIngles ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid var(--border-color)', marginBottom: '40px', transition: 'all 0.3s ease' }}>
                            <input type="checkbox" checked={sabeIngles} onChange={e => setSabeIngles(e.target.checked)} style={{width: '24px', height: '24px', accentColor: '#3b82f6'}} />
                            <span style={{color: sabeIngles ? '#3b82f6' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1rem'}}><i className="fa-solid fa-language"></i> {t('pacienteHablaIngles') || 'Paciente habla Inglés (Pase directo con Médico)'}</span>
                        </label>

                        <h4 style={{color: 'var(--accent)', marginBottom: '20px', fontSize: '1.1rem'}}><i className="fa-solid fa-kit-medical" style={{marginRight: '8px'}}></i> {t('contactoEmergenciaNum') || '2. Contacto de Emergencia'}</h4>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '40px'}}>
                            <div><label className="form-label">{t('nombre') || 'Nombre'}</label><input type="text" value={emergenciaNombre} onChange={e => setEmergenciaNombre(e.target.value)} className="form-input" /></div>
                            <div><label className="form-label">{t('parentesco')}</label><input type="text" value={emergenciaParentesco} onChange={e => setEmergenciaParentesco(e.target.value)} className="form-input" /></div>
                            <div><label className="form-label">{t('telefono')}</label><input type="text" value={emergenciaTelefono} onChange={e => setEmergenciaTelefono(e.target.value)} className="form-input" /></div>
                        </div>

                        <div><label className="form-label">{t('responsableLegal')}</label><input type="text" value={responsable} onChange={e => setResponsable(e.target.value)} className="form-input" placeholder="Llenar solo si es menor de edad o persona que no puede consentir" /></div>
                    
                        {/* CASILLA DINÁMICA DE AVISO DE PRIVACIDAD */}
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', 
                            background: avisoPrivacidad ? 'rgba(22, 163, 74, 0.05)' : 'rgba(220, 38, 38, 0.05)', 
                            padding: '20px', borderRadius: '12px', 
                            border: avisoPrivacidad ? '1px solid var(--success)' : '1px dashed var(--primary-red)', 
                            marginTop: '35px', transition: 'all 0.3s ease'
                        }}>
                            <input type="checkbox" checked={avisoPrivacidad} onChange={e => setAvisoPrivacidad(e.target.checked)} style={{width: '24px', height: '24px', accentColor: 'var(--success)'}} />
                            <span style={{color: avisoPrivacidad ? 'var(--success)' : 'var(--primary-red)', fontWeight: 'bold', fontSize: '1.05rem', transition: 'color 0.3s ease'}}>
                                {t('avisoPrivacidad')} * {avisoPrivacidad && <i className="fa-solid fa-check" style={{marginLeft: '10px'}}></i>}
                            </span>
                        </label>
                    </div>

                    {/* COLUMNA DERECHA: ALERTAS, NOTA INTERNA Y GUARDADO */}
                    <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '25px'}}>
                        
                        <div className="panel" style={{background: 'rgba(220, 38, 38, 0.03)', borderRadius: '16px', padding: '30px', border: '1px solid rgba(220, 38, 38, 0.15)', boxShadow: 'var(--shadow-sm)'}}>
                            <h3 style={{color: 'var(--primary-red)', margin: '0 0 10px 0', fontSize: '1.2rem'}}><i className="fa-solid fa-triangle-exclamation"></i> {t('alertasClinicas')}</h3>
                            <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '25px'}}>{t('descAlertasClinicas') || 'Estas alertas generarán un bloqueo visual rojo en el historial del paciente.'}</p>
                            
                            <div style={{background: 'var(--bg-main)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-color)'}}>
                                <select value={nuevaAlertaTipo} onChange={e => setNewAlertaTipo(e.target.value)} className="form-input" style={{marginBottom: '15px'}}>
                                    <option value="">{t('seleccionarAlerta') || '-- Seleccionar Alerta --'}</option>
                                    <option value="Alergia">{t('alergia') || 'Alergia'}</option>
                                    <option value="Marcapasos">{t('marcapasos') || 'Marcapasos'}</option>
                                    <option value="Anticoagulantes">{t('anticoagulantes') || 'Anticoagulantes'}</option>
                                    <option value="Embarazo">{t('embarazo') || 'Embarazo'}</option>
                                    <option value="Enfermedad Transmisible">{t('enfermedadTransmisible') || 'Enfermedad Transmisible'}</option>
                                    <option value="Riesgo Urgencia">{t('riesgoUrgencia') || 'Riesgo de Urgencia'}</option>
                                </select>
                                <textarea 
                                    value={nuevaAlertaDesc} onChange={e => setNewAlertaDesc(e.target.value)} 
                                    className="form-input" rows="3" placeholder={t('especificarDetalleAlerta') || 'Especificar detalle de la alerta...'}
                                    style={{marginBottom: '15px', resize: 'none'}}
                                ></textarea>
                                <button className="btn-action" onClick={agregarAlerta} style={{width: '100%', background: 'var(--primary-red)', color: 'white', border: 'none', padding: '12px', fontWeight: 'bold', borderRadius: '8px'}}><i className="fa-solid fa-plus"></i> {t('anadirAlerta') || 'Añadir Alerta'}</button>
                            </div>

                            {/* LISTA DE ALERTAS VISUALES */}
                            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                {alertas.map((a, i) => (
                                    <div key={i} style={{background: 'var(--bg-panel)', padding: '15px', borderRadius: '10px', borderLeft: `4px solid ${a.nivel_gravedad === 'alta' ? 'var(--primary-red)' : '#ea580c'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                                        <div>
                                            <strong style={{fontSize: '0.9rem', color: 'var(--text-main)'}}>{t(a.tipo_alerta.replace(/\s+/g, '').toLowerCase()) || a.tipo_alerta}</strong>
                                            <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px'}}>{a.descripcion}</div>
                                        </div>
                                        <button onClick={() => quitarAlertaTemporal(i)} style={{background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'}} onMouseEnter={e => {e.currentTarget.style.color = 'var(--primary-red)'; e.currentTarget.style.borderColor = 'var(--primary-red)';}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)';}}>
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                ))}
                                {alertas.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic'}}>{t('sinDatos') || 'No hay alertas registradas.'}</div>}
                            </div>
                        </div>

                        {/* 🚀 POST-IT NOTA INTERNA STAFF */}
                        <div style={{ background: '#fef08a', padding: '25px', borderRadius: '12px', borderLeft: '6px solid #eab308', boxShadow: '2px 4px 10px rgba(0,0,0,0.1)' }}>
                            <label style={{ fontWeight: '900', display: 'block', marginBottom: '10px', color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <i className="fa-solid fa-note-sticky"></i> {t('notaInterna') || 'Nota Interna (Staff)'}
                            </label>
                            <p style={{fontSize: '0.8rem', color: '#a16207', marginBottom: '15px'}}>{t('notaInternaDesc') || 'Comentarios privados. El paciente no verá esto.'}</p>
                            <textarea 
                                value={notaInterna} 
                                onChange={e => setNotaInterna(e.target.value)} 
                                rows="4" 
                                style={{ width: '100%', background: 'rgba(255, 255, 255, 0.4)', border: '1px dashed #ca8a04', outline: 'none', color: '#713f12', padding: '15px', borderRadius: '8px', resize: 'vertical', fontSize: '0.95rem' }} 
                                placeholder={t('ejNotaInterna') || 'Ej. Cliente conflictivo, prefiere pasar con la Dra. Ana...'}
                            />
                        </div>

                        <div className="panel" style={{background: 'var(--bg-panel)', borderRadius: '16px', padding: '30px', boxShadow: 'var(--shadow-sm)'}}>
                            <button onClick={guardarExpediente} className="btn-primary" style={{width: '100%', padding: '16px', border: 'none', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}}>
                                <i className="fa-solid fa-floppy-disk" style={{marginRight: '8px'}}></i> {t('guardarExpediente') || 'Guardar Expediente'}
                            </button>
                            <button onClick={() => setVista('directorio')} className="btn-action" style={{width: '100%', padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold'}}>
                                {t('cancelar') || 'Cancelar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .form-label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                .form-input { width: 100%; padding: 14px; background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 10px; font-size: 1rem; transition: all 0.3s ease; }
                .form-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15); }
                .form-input:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>
        </div>
    );
}