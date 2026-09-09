'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Clientes({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage();
    const [pacientes, setPacientes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Vistas
    const [vista, setVista] = useState('directorio');
    const [activeSucursalTab, setActiveSucursalTab] = useState('todas'); 
    const [showLegacyClients, setShowLegacyClients] = useState(false); 
    const [sucursalesDB, setSucursalesDB] = useState([]);

    const [pacienteEditando, setPacienteEditando] = useState(null);

    // 🚀 NUEVO ESTADO PARA EL WIZARD DEL FORMULARIO
    const [formStep, setFormStep] = useState(1);

    // Estados del Formulario (Datos Generales)
    const [nombres, setNombres] = useState('');
    const [apellidos, setApellidos] = useState('');
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
    const sucursalId = branchIdMap[(branch || '').toLowerCase()] || 1;

    const formatUpperCase = (str) => {
        if (!str) return '';
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    const fetchPacientesYSucursales = async () => {
        const { data: sucursales } = await supabase.from('sucursales').select('id, nombre').order('id');
        if (sucursales) setSucursalesDB(sucursales);

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
        fetchPacientesYSucursales();
    }, []);

    const resetForm = () => {
        setPacienteEditando(null); setNombres(''); setApellidos(''); setTelefono(''); setFechaNac(''); setSexo('');
        setEstadoCivil(''); setOcupacion('');
        setCurp(''); setMotivoSinCurp(''); setCorreo(''); setDomicilio(''); setEmergenciaNombre('');
        setEmergenciaParentesco(''); setEmergenciaTelefono(''); setIdioma('Español'); setSabeIngles(false);
        setResponsable(''); setAvisoPrivacidad(false); setNotaInterna('');
        setAlertas([]); setNewAlertaTipo(''); setNewAlertaDesc('');
        setFormStep(1); // 🚀 Reiniciar el wizard al paso 1
    };

    const abrirFormulario = (paciente = null) => {
        if (paciente) {
            setPacienteEditando(paciente.id);
            setNombres(paciente.nombres || '');
            setApellidos(paciente.apellidos || '');
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
            setFormStep(1);
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
        // 🚀 Validación Inteligente: Regresa al paso correspondiente si falta algo
        if (!nombres || !apellidos || !telefono || !sexo || !fechaNac || !estadoCivil) {
            setFormStep(1);
            return alert(t('camposObligatoriosGeneral') || 'Faltan campos obligatorios en la sección 1 (Nombres, Apellidos, Tel, Sexo, Fecha Nac, Estado Civil).');
        }
        if (!avisoPrivacidad) {
            setFormStep(3);
            return alert(t('aceptarAviso') || 'Debes aceptar el Aviso de Privacidad en la sección 3.');
        }

        const nombresNorm = nombres.trim();
        const apellidosNorm = apellidos.trim();
        const fullName = `${nombresNorm} ${apellidosNorm}`;

        if (!pacienteEditando) {
            const nameDupe = pacientes.find(p => p.nombres === nombresNorm && p.apellidos === apellidosNorm);
            if (nameDupe) return alert(`🚨 ERROR: El paciente "${fullName}" ya existe con el expediente ${nameDupe.codigo_expediente || 'S/E'}.`);

            if (curp.trim()) {
                const curpDupe = pacientes.find(p => p.curp === curp.trim());
                if (curpDupe) return alert(`🚨 ERROR: La CURP ingresada ya pertenece al paciente ${curpDupe.nombre} (Exp: ${curpDupe.codigo_expediente || 'S/E'}).`);
            }

            if (telefono.trim()) {
                const telDupe = pacientes.find(p => p.telefono === telefono.trim());
                if (telDupe) {
                    if (!window.confirm(`⚠️ AVISO: El teléfono ${telefono.trim()} ya está registrado a nombre de ${telDupe.nombre}. ¿Deseas continuar de todos modos?`)) return;
                }
            }
        }

        const payload = {
            nombre: fullName, 
            nombres: nombresNorm,
            apellidos: apellidosNorm,
            telefono: telefono.trim(), fecha_nacimiento: fechaNac, sexo,
            estado_civil: estadoCivil, ocupacion: ocupacion.trim(), sabe_ingles: sabeIngles,
            curp: curp.trim(), motivo_sin_curp: motivoSinCurp.trim(), correo: correo.trim().toLowerCase(), domicilio: domicilio.trim(),
            contacto_emergencia_nombre: emergenciaNombre.trim(), contacto_emergencia_parentesco: emergenciaParentesco.trim(),
            contacto_emergencia_telefono: emergenciaTelefono.trim(), idioma_preferente: idioma, responsable_legal: responsable.trim(),
            nota_interna: notaInterna.trim(),
            aviso_privacidad_aceptado: avisoPrivacidad,
            aviso_privacidad_version: 'v1.0',
            aviso_privacidad_fecha: avisoPrivacidad && !pacienteEditando ? new Date().toISOString() : undefined 
        };
        
        let currentPacienteId = pacienteEditando;
        let generatedExpCode = '';

        if (pacienteEditando) {
            const { error } = await supabase.from('clientes').update(payload).eq('id', pacienteEditando);
            if (error) return alert((t('errorActualizar') || 'Error al actualizar: ') + error.message);
        } else {
            payload.sucursal_registro_id = sucursalId; 
            const { data, error } = await supabase.from('clientes').insert([payload]).select();
            if (error) return alert((t('errorCrear') || 'Error al crear: ') + error.message);
            
            currentPacienteId = data[0].id;
            
            const yearMonth = new Date().getFullYear().toString().slice(-2) + (new Date().getMonth() + 1).toString().padStart(2, '0');
            const branchLetter = (branch || 'Napoles').charAt(0).toUpperCase();
            generatedExpCode = `HK-${branchLetter}-${yearMonth}-${currentPacienteId.toString().padStart(4, '0')}`;
            
            await supabase.from('clientes').update({ codigo_expediente: generatedExpCode }).eq('id', currentPacienteId);
        }

        if (pacienteEditando) await supabase.from('alertas_clinicas').delete().eq('paciente_id', currentPacienteId);
        
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
        fetchPacientesYSucursales();
    };

    const eliminarPaciente = async (id, nombreP) => {
        if (!window.confirm(`${t('confirmarEliminarExpediente') || '¿Estás seguro de que deseas eliminar permanentemente el expediente de'} ${nombreP}?\n\n${t('accionNoDeshacer') || 'Esta acción no se puede deshacer.'}`)) return;
        await supabase.from('alertas_clinicas').delete().eq('paciente_id', id);
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) {
            alert((t('errorEliminarExpediente') || 'Error al eliminar: Es probable que este paciente ya tenga ventas o historial clínico asociado y no pueda borrarse por seguridad. \n\nDetalle: ') + error.message);
        } else {
            alert(t('expedienteEliminadoExito') || 'Expediente eliminado correctamente.');
            fetchPacientesYSucursales(); 
        }
    };

    const pacientesFiltrados = pacientes.filter(p => {
        const isLegacy = p.codigo_expediente && p.codigo_expediente.includes('LEGACY');
        if (!showLegacyClients && isLegacy) return false;

        const busqueda = searchTerm.toLowerCase().trim();
        if (busqueda !== '') {
            return (p.nombre && p.nombre.toLowerCase().includes(busqueda)) || 
                   (p.telefono && p.telefono.includes(busqueda)) ||
                   (p.codigo_expediente && p.codigo_expediente.toLowerCase().includes(busqueda)) ||
                   (p.curp && p.curp.toLowerCase().includes(busqueda));
        }

        if (activeSucursalTab !== 'todas') {
            return p.sucursal_registro_id === activeSucursalTab;
        }

        return true;
    });

    const getNombreSucursal = (id) => {
        const suc = sucursalesDB.find(s => s.id === id);
        return suc ? suc.nombre : 'S/A';
    };

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '25px', overflowY: 'auto', paddingRight: '5px'}}>
            
            {vista === 'directorio' && (
                <>
                    {/* BARRA DE BÚSQUEDA Y NUEVO PACIENTE */}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)', padding: '20px 25px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                        <div style={{display: 'flex', alignItems: 'center', flex: 1, maxWidth: '600px', marginRight: '20px', gap: '15px'}}>
                            <div style={{position: 'relative', flex: 1}}>
                                <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)'}}></i>
                                <input 
                                    type="text" 
                                    placeholder={t('placeholderBuscarCliente') || 'Buscar por nombre, expediente o teléfono...'} 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                    style={{width: '100%', padding: '14px 14px 14px 45px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', transition: 'all 0.3s'}}
                                />
                            </div>
                            <button 
                                onClick={() => setShowLegacyClients(!showLegacyClients)}
                                style={{padding: '14px', background: showLegacyClients ? 'rgba(2, 136, 209, 0.1)' : 'var(--bg-main)', color: showLegacyClients ? '#0288d1' : 'var(--text-muted)', border: `1px solid ${showLegacyClients ? '#0288d1' : 'var(--border-color)'}`, borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', transition: '0.3s', display: 'flex', alignItems: 'center', gap: '8px'}}
                                title="Mostrar/Ocultar pacientes antiguos"
                            >
                                <i className={`fa-solid ${showLegacyClients ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                {showLegacyClients ? (t('ocultarLegacy') || 'Ocultar Legacy') : (t('verLegacy') || 'Ver Legacy')}
                            </button>
                        </div>
                        <button className="btn-primary" onClick={() => abrirFormulario()} style={{padding: '14px 25px', fontSize: '1rem', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)', transition: 'all 0.3s'}}>
                            <i className="fa-solid fa-user-plus" style={{marginRight: '8px'}}></i> {t('nuevoPaciente') || 'Nuevo Paciente'}
                        </button>
                    </div>

                    {/* PESTAÑAS CARPETAS POR SUCURSAL */}
                    <div style={{display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '5px'}}>
                        <button onClick={() => setActiveSucursalTab('todas')} style={{padding: '10px 20px', background: activeSucursalTab === 'todas' ? 'var(--text-main)' : 'var(--bg-panel)', color: activeSucursalTab === 'todas' ? 'var(--bg-panel)' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'}}>
                            {t('verTodos') || 'Todos'} ({pacientes.filter(p => showLegacyClients || (!p.codigo_expediente || !p.codigo_expediente.includes('LEGACY'))).length})
                        </button>
                        {sucursalesDB.map(suc => {
                            const conteoSucursal = pacientes.filter(p => p.sucursal_registro_id === suc.id && (showLegacyClients || (!p.codigo_expediente || !p.codigo_expediente.includes('LEGACY')))).length;
                            return (
                                <button key={suc.id} onClick={() => setActiveSucursalTab(suc.id)} style={{padding: '10px 20px', background: activeSucursalTab === suc.id ? '#0288d1' : 'var(--bg-panel)', color: activeSucursalTab === suc.id ? 'white' : 'var(--text-muted)', border: activeSucursalTab === suc.id ? '1px solid #0288d1' : '1px solid var(--border-color)', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'}}>
                                    <i className="fa-solid fa-building" style={{marginRight: '8px'}}></i> {suc.nombre} ({conteoSucursal})
                                </button>
                            );
                        })}
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
                                    {/* 🚀 NUEVA COLUMNA DE SUCURSAL */}
                                    <th style={{textAlign: 'center'}}><i className="fa-solid fa-location-dot" style={{marginRight: '5px'}}></i> {t('sucursal') || 'Sucursal'}</th>
                                    <th><i className="fa-solid fa-triangle-exclamation" style={{color: 'var(--primary-red)', marginRight: '5px'}}></i> {t('alertasClinicas') || 'Alertas'} / {t('estado') || 'Estatus'}</th>
                                    <th style={{textAlign: 'center'}}>{t('acciones') || 'Acciones'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pacientesFiltrados.map((p, idx) => {
                                    let edad = 'N/A';
                                    if (p.fecha_nacimiento) {
                                        const diff = Date.now() - new Date(p.fecha_nacimiento).getTime();
                                        edad = Math.abs(new Date(diff).getUTCFullYear() - 1970);
                                    }
                                    const alertasActivas = p.alertas_clinicas?.filter(a => a.activa) || [];
                                    const isLegacy = p.codigo_expediente && p.codigo_expediente.includes('LEGACY');
                                    
                                    let abandonoTratamiento = false;
                                    let diasInactivo = 0;
                                    if (p.ultima_asistencia) {
                                        const diffTime = Date.now() - new Date(p.ultima_asistencia).getTime();
                                        diasInactivo = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                        if (diasInactivo > 60) abandonoTratamiento = true;
                                    }

                                    return (
                                        <tr key={p.id} className="animate-slide-up-row" style={{animationDelay: `${idx * 0.02}s`}}>
                                            <td style={{fontFamily: 'monospace', fontWeight: 'bold'}}>
                                                {p.codigo_expediente ? (
                                                    <span style={{background: isLegacy ? 'rgba(234, 88, 12, 0.1)' : 'rgba(2, 136, 209, 0.1)', color: isLegacy ? '#ea580c' : '#0288d1', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem'}}>
                                                        <i className="fa-solid fa-folder-open" style={{marginRight: '4px'}}></i> {p.codigo_expediente}
                                                    </span>
                                                ) : <span style={{color: 'var(--text-muted)'}}>S/E</span>}
                                            </td>
                                            <td>
                                                <strong style={{color: 'var(--text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                    {p.nombre} 
                                                    {p.sabe_ingles && <span style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold'}}>🇺🇸 ENG</span>}
                                                </strong>
                                                <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{p.curp || (t('sinCurpAbrev') || 'Sin CURP')}</span>
                                            </td>
                                            <td style={{color: 'var(--text-main)'}}>{p.telefono || t('sinTelefono')}</td>
                                            <td><span style={{color: 'var(--text-main)'}}>{p.sexo || '-'}</span> <br/><span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{edad} {t('anos') || 'años'}</span></td>
                                            
                                            {/* 🚀 CELDA SUCURSAL */}
                                            <td style={{textAlign: 'center'}}>
                                                <span style={{fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', display: 'inline-block'}}>
                                                    {getNombreSucursal(p.sucursal_registro_id)}
                                                </span>
                                            </td>

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
                                {pacientesFiltrados.length === 0 && <tr><td colSpan="7" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-folder-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('noExpedientes') || 'No se encontraron expedientes.'}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* 🚀 NUEVO WIZARD DE FORMULARIO (ESTÉTICA PREMIUM MÉDICA-ASIÁTICA) */}
            {vista === 'formulario' && (
                <div className="wizard-container animate-slide-up">
                    <div className="wizard-header">
                        <div>
                            <h2 style={{margin: 0, color: 'var(--primary-red)', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '15px'}}>
                                <i className="fa-solid fa-address-card"></i> 
                                {pacienteEditando ? 'Edición de Expediente' : 'Alta de Nuevo Paciente'}
                            </h2>
                            <p style={{margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem'}}>Completa la información en cada sección para registrar al paciente en el sistema Freedom HK.</p>
                        </div>
                        {pacienteEditando && (
                            <div className="wizard-badge">
                                <i className="fa-solid fa-folder-open"></i> EXP: {pacientes.find(p => p.id === pacienteEditando)?.codigo_expediente || 'S/E'}
                            </div>
                        )}
                    </div>

                    <div className="wizard-body">
                        {/* 🚀 SIDEBAR DE NAVEGACIÓN DEL WIZARD */}
                        <div className="wizard-sidebar">
                            <button className={`wizard-step ${formStep === 1 ? 'active' : (formStep > 1 ? 'completed' : '')}`} onClick={() => setFormStep(1)}>
                                <div className="step-icon"><i className="fa-solid fa-user"></i></div>
                                <div className="step-text">
                                    <span className="step-title">1. Datos Generales</span>
                                    <span className="step-desc">Identidad y Contacto</span>
                                </div>
                                {formStep > 1 && <i className="fa-solid fa-check step-check"></i>}
                            </button>

                            <button className={`wizard-step ${formStep === 2 ? 'active' : (formStep > 2 ? 'completed' : '')}`} onClick={() => setFormStep(2)}>
                                <div className="step-icon"><i className="fa-solid fa-heart-pulse"></i></div>
                                <div className="step-text">
                                    <span className="step-title">2. Perfil Clínico</span>
                                    <span className="step-desc">Alertas y Emergencias</span>
                                </div>
                                {formStep > 2 && <i className="fa-solid fa-check step-check"></i>}
                            </button>

                            <button className={`wizard-step ${formStep === 3 ? 'active' : ''}`} onClick={() => setFormStep(3)}>
                                <div className="step-icon"><i className="fa-solid fa-shield-halved"></i></div>
                                <div className="step-text">
                                    <span className="step-title">3. Privacidad</span>
                                    <span className="step-desc">Avisos y Notas Internas</span>
                                </div>
                            </button>
                        </div>

                        {/* 🚀 ÁREA DE CONTENIDO DEL FORMULARIO */}
                        <div className="wizard-content">
                            
                            {/* PASO 1: DATOS GENERALES */}
                            {formStep === 1 && (
                                <div className="step-pane animate-fade-in">
                                    <h3 className="pane-title"><i className="fa-solid fa-address-book" style={{color: 'var(--accent)', marginRight: '10px'}}></i> Información Personal</h3>
                                    
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '25px'}}>
                                        <div><label className="form-label">{t('nombres')} *</label><input type="text" value={nombres} onChange={e => setNombres(formatUpperCase(e.target.value))} className="form-input" placeholder="Ej. JOSE ADRIAN" autoFocus/></div>
                                        <div><label className="form-label">{t('apellidos')} *</label><input type="text" value={apellidos} onChange={e => setApellidos(formatUpperCase(e.target.value))} className="form-input" placeholder="Ej. ESTRADA URIBE" /></div>
                                        
                                        <div><label className="form-label">{t('telefono')} *</label><input type="text" value={telefono} onChange={e => setTelefono(e.target.value)} className="form-input" placeholder="10 dígitos" /></div>
                                        <div><label className="form-label">{t('fechaNacimiento')} *</label><input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} className="form-input" /></div>
                                        
                                        <div>
                                            <label className="form-label">{t('sexo')} *</label>
                                            <select value={sexo} onChange={e => setSexo(e.target.value)} className="form-input">
                                                <option value="">-- {t('seleccionar')} --</option>
                                                <option value="Femenino">{t('femenino')}</option>
                                                <option value="Masculino">{t('masculino')}</option>
                                                <option value="Otro">{t('otro')}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">{t('estadoCivil')} *</label>
                                            <select value={estadoCivil} onChange={e => setEstadoCivil(e.target.value)} className="form-input">
                                                <option value="">-- {t('seleccionar')} --</option>
                                                <option value="Soltero">{t('soltero')}</option>
                                                <option value="Casado">{t('casado')}</option>
                                                <option value="Divorciado">{t('divorciado')}</option>
                                                <option value="Viudo">{t('viudo')}</option>
                                                <option value="Unión Libre">{t('unionLibre')}</option>
                                                <option value="Otro">{t('otro')}</option>
                                            </select>
                                        </div>
                                        
                                        <div><label className="form-label">{t('curp')}</label><input type="text" value={curp} onChange={e => setCurp(formatUpperCase(e.target.value))} className="form-input" maxLength="18" placeholder="18 Caracteres alfanuméricos" /></div>
                                        <div><label className="form-label">{t('sinCurp')} (Motivo)</label><input type="text" value={motivoSinCurp} onChange={e => setMotivoSinCurp(formatUpperCase(e.target.value))} className="form-input" placeholder="Ej. EXTRANJERO, NO LO RECUERDA..." disabled={curp.length > 0} style={{opacity: curp.length > 0 ? 0.5 : 1}} /></div>
                                        
                                        <div><label className="form-label">{t('ocupacion')}</label><input type="text" value={ocupacion} onChange={e => setOcupacion(formatUpperCase(e.target.value))} className="form-input" placeholder="Ej. ESTUDIANTE, DOCENTE..." /></div>
                                        <div><label className="form-label">{t('correo')}</label><input type="email" value={correo} onChange={e => setCorreo(e.target.value.toLowerCase())} className="form-input" placeholder="correo@ejemplo.com" /></div>
                                    </div>
                                    <div style={{width: '100%'}}>
                                        <label className="form-label">{t('domicilio')}</label>
                                        <input type="text" value={domicilio} onChange={e => setDomicilio(formatUpperCase(e.target.value))} className="form-input" placeholder="Calle, Número, Colonia, Alcaldía/Municipio, CP..." />
                                    </div>
                                </div>
                            )}

                            {/* PASO 2: PERFIL CLÍNICO Y EMERGENCIAS */}
                            {formStep === 2 && (
                                <div className="step-pane animate-fade-in">
                                    <h3 className="pane-title"><i className="fa-solid fa-truck-medical" style={{color: 'var(--accent)', marginRight: '10px'}}></i> Contacto de Emergencia y Lenguaje</h3>
                                    
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '25px'}}>
                                        <div><label className="form-label">{t('nombre')}</label><input type="text" value={emergenciaNombre} onChange={e => setEmergenciaNombre(formatUpperCase(e.target.value))} className="form-input" placeholder="Nombre completo" /></div>
                                        <div><label className="form-label">{t('parentesco')}</label><input type="text" value={emergenciaParentesco} onChange={e => setEmergenciaParentesco(formatUpperCase(e.target.value))} className="form-input" placeholder="Ej. MADRE, ESPOSO..." /></div>
                                        <div><label className="form-label">{t('telefono')}</label><input type="text" value={emergenciaTelefono} onChange={e => setEmergenciaTelefono(e.target.value)} className="form-input" placeholder="10 dígitos" /></div>
                                    </div>
                                    
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px'}}>
                                        <div><label className="form-label">{t('responsableLegal')}</label><input type="text" value={responsable} onChange={e => setResponsable(formatUpperCase(e.target.value))} className="form-input" placeholder="Llenar solo si es menor de edad o discapacitado" /></div>
                                        <div style={{display: 'flex', alignItems: 'flex-end', gap: '15px'}}>
                                            <div style={{flex: 1}}><label className="form-label">{t('idioma')}</label><input type="text" value={idioma} onChange={e => setIdioma(formatUpperCase(e.target.value))} className="form-input" /></div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: sabeIngles ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-main)', padding: '12px 15px', borderRadius: '10px', border: sabeIngles ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid var(--border-color)', height: '48px', transition: 'all 0.3s ease' }}>
                                                <input type="checkbox" checked={sabeIngles} onChange={e => setSabeIngles(e.target.checked)} style={{width: '20px', height: '20px', accentColor: '#3b82f6'}} />
                                                <span style={{color: sabeIngles ? '#3b82f6' : 'var(--text-main)', fontWeight: 'bold', fontSize: '0.9rem'}}><i className="fa-solid fa-language"></i> {t('pacienteHablaIngles')}</span>
                                            </label>
                                        </div>
                                    </div>

                                    <h3 className="pane-title" style={{color: 'var(--primary-red)', borderTop: '1px dashed var(--border-color)', paddingTop: '25px'}}><i className="fa-solid fa-triangle-exclamation"></i> Alertas Clínicas Restrictivas</h3>
                                    <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px'}}>Agrega alertas si el paciente tiene condiciones que impidan o modifiquen el tratamiento (Alergias, Marcapasos, Embarazo).</p>
                                    
                                    <div style={{background: 'var(--bg-main)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px', display: 'flex', gap: '15px'}}>
                                        <select value={nuevaAlertaTipo} onChange={e => setNewAlertaTipo(e.target.value)} className="form-input" style={{flex: 1}}>
                                            <option value="">-- Seleccionar Alerta --</option>
                                            <option value="Alergia">Alergia</option>
                                            <option value="Marcapasos">Marcapasos</option>
                                            <option value="Anticoagulantes">Anticoagulantes</option>
                                            <option value="Embarazo">Embarazo</option>
                                            <option value="Enfermedad Transmisible">Enfermedad Transmisible</option>
                                            <option value="Riesgo Urgencia">Riesgo de Urgencia</option>
                                        </select>
                                        <input type="text" value={nuevaAlertaDesc} onChange={e => setNewAlertaDesc(e.target.value)} className="form-input" placeholder="Especificar detalle..." style={{flex: 2}} />
                                        <button className="btn-primary" onClick={agregarAlerta} style={{padding: '0 20px', borderRadius: '8px', border: 'none', background: 'var(--primary-red)', color: 'white', fontWeight: 'bold'}}><i className="fa-solid fa-plus"></i></button>
                                    </div>

                                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                        {alertas.map((a, i) => (
                                            <div key={i} style={{background: 'var(--bg-panel)', padding: '15px', borderRadius: '10px', borderLeft: `4px solid ${a.nivel_gravedad === 'alta' ? 'var(--primary-red)' : '#ea580c'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                                                <div>
                                                    <strong style={{fontSize: '0.9rem', color: 'var(--text-main)'}}>{a.tipo_alerta}</strong>
                                                    <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px'}}>{a.descripcion}</div>
                                                </div>
                                                <button onClick={() => quitarAlertaTemporal(i)} style={{background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'}} onMouseEnter={e => {e.currentTarget.style.color = 'var(--primary-red)'; e.currentTarget.style.borderColor = 'var(--primary-red)';}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)';}}>
                                                    <i className="fa-solid fa-xmark"></i>
                                                </button>
                                            </div>
                                        ))}
                                        {alertas.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '10px'}}>Sin alertas registradas.</div>}
                                    </div>
                                </div>
                            )}

                            {/* PASO 3: PRIVACIDAD Y NOTAS */}
                            {formStep === 3 && (
                                <div className="step-pane animate-fade-in">
                                    <h3 className="pane-title"><i className="fa-solid fa-shield-halved" style={{color: 'var(--accent)', marginRight: '10px'}}></i> Legal y Operativo</h3>
                                    
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', background: avisoPrivacidad ? 'rgba(22, 163, 74, 0.05)' : 'rgba(220, 38, 38, 0.05)', padding: '20px', borderRadius: '12px', border: avisoPrivacidad ? '1px solid var(--success)' : '1px dashed var(--primary-red)', marginBottom: '35px', transition: 'all 0.3s ease' }}>
                                        <input type="checkbox" checked={avisoPrivacidad} onChange={e => setAvisoPrivacidad(e.target.checked)} style={{width: '24px', height: '24px', accentColor: 'var(--success)'}} />
                                        <div style={{display: 'flex', flexDirection: 'column'}}>
                                            <span style={{color: avisoPrivacidad ? 'var(--success)' : 'var(--primary-red)', fontWeight: 'bold', fontSize: '1.05rem', transition: 'color 0.3s ease'}}>
                                                {t('avisoPrivacidad')} * {avisoPrivacidad && <i className="fa-solid fa-check" style={{marginLeft: '10px'}}></i>}
                                            </span>
                                            <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px'}}>Es obligatorio que el paciente haya leído y aceptado el aviso de privacidad antes de guardar el expediente.</span>
                                        </div>
                                    </label>

                                    <div style={{ background: '#fef08a', padding: '25px', borderRadius: '12px', borderLeft: '6px solid #eab308', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                                        <label style={{ fontWeight: '900', display: 'block', marginBottom: '10px', color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <i className="fa-solid fa-note-sticky"></i> {t('notaInterna') || 'Nota Interna (Staff)'}
                                        </label>
                                        <p style={{fontSize: '0.8rem', color: '#a16207', marginBottom: '15px'}}>{t('notaInternaDesc') || 'Comentarios privados para uso exclusivo de recepción y médicos. El paciente no verá esto.'}</p>
                                        <textarea 
                                            value={notaInterna} 
                                            onChange={e => setNotaInterna(e.target.value)} 
                                            rows="5" 
                                            style={{ width: '100%', background: 'rgba(255, 255, 255, 0.5)', border: '1px dashed #ca8a04', outline: 'none', color: '#713f12', padding: '15px', borderRadius: '8px', resize: 'vertical', fontSize: '0.95rem' }} 
                                            placeholder={t('ejNotaInterna') || 'Ej. Cliente conflictivo, prefiere pasar con la Dra. Ana...'}
                                        />
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                    
                    {/* 🚀 FOOTER DEL WIZARD (CONTROLES) */}
                    <div className="wizard-footer">
                        <button className="btn-action" onClick={() => setVista('directorio')} style={{padding: '14px 25px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold'}}>
                            {t('cancelar') || 'Cancelar y Salir'}
                        </button>
                        
                        <div style={{display: 'flex', gap: '15px'}}>
                            <button 
                                className="btn-action" 
                                onClick={() => setFormStep(prev => prev - 1)} 
                                disabled={formStep === 1}
                                style={{padding: '14px 25px', background: 'transparent', color: formStep === 1 ? 'transparent' : 'var(--text-main)', border: 'none', fontWeight: 'bold', cursor: formStep === 1 ? 'default' : 'pointer'}}
                            >
                                <i className="fa-solid fa-arrow-left"></i> Atrás
                            </button>
                            
                            {formStep < 3 ? (
                                <button className="btn-primary" onClick={() => setFormStep(prev => prev + 1)} style={{padding: '14px 30px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}}>
                                    Siguiente Paso <i className="fa-solid fa-arrow-right" style={{marginLeft: '8px'}}></i>
                                </button>
                            ) : (
                                <button className="btn-primary" onClick={guardarExpediente} style={{padding: '14px 35px', background: 'var(--success)', border: 'none', borderRadius: '10px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 15px rgba(22, 163, 74, 0.4)'}}>
                                    <i className="fa-solid fa-floppy-disk" style={{marginRight: '8px'}}></i> Finalizar y Guardar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 🚀 ESTILOS PREMIUM PARA EL WIZARD */}
            <style jsx>{`
                .form-label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                .form-input { width: 100%; padding: 14px; background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 10px; font-size: 1rem; transition: all 0.3s ease; }
                .form-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15); }
                .form-input:disabled { opacity: 0.6; cursor: not-allowed; }
                
                .animate-slide-up-row { opacity: 0; animation: slideUpRow 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                .animate-slide-up { opacity: 0; animation: slideUpRow 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                
                @keyframes slideUpRow { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                /* 🚀 CSS DEL WIZARD (MÉDICO-ASIÁTICO) */
                .wizard-container { display: flex; flex-direction: column; background: var(--bg-panel); border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); border: 1px solid var(--border-color); overflow: hidden; min-height: 75vh; }
                .wizard-header { padding: 30px; background: var(--bg-main); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; alignItems: center; }
                .wizard-badge { background: rgba(2, 136, 209, 0.1); color: #0288d1; padding: 8px 16px; border-radius: 20px; font-family: monospace; font-weight: bold; border: 1px solid rgba(2, 136, 209, 0.3); font-size: 1.1rem; }
                
                .wizard-body { display: flex; flex: 1; overflow: hidden; }
                
                .wizard-sidebar { width: 280px; background: var(--bg-main); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; padding: 20px 0; }
                .wizard-step { display: flex; align-items: center; gap: 15px; padding: 20px 25px; background: transparent; border: none; width: 100%; text-align: left; cursor: pointer; transition: all 0.3s ease; position: relative; }
                .wizard-step::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: transparent; transition: 0.3s; }
                .wizard-step:hover { background: rgba(211, 47, 47, 0.03); }
                .wizard-step.active { background: var(--bg-panel); }
                .wizard-step.active::before { background: var(--primary-red); }
                
                .step-icon { width: 40px; height: 40px; border-radius: 50%; background: var(--bg-panel); border: 2px solid var(--border-color); color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; transition: 0.3s; }
                .wizard-step.active .step-icon { background: rgba(211, 47, 47, 0.1); border-color: var(--primary-red); color: var(--primary-red); }
                .wizard-step.completed .step-icon { background: var(--success); border-color: var(--success); color: white; }
                
                .step-text { display: flex; flex-direction: column; flex: 1; }
                .step-title { font-weight: bold; color: var(--text-muted); font-size: 0.95rem; transition: 0.3s; }
                .wizard-step.active .step-title, .wizard-step.completed .step-title { color: var(--text-main); }
                .step-desc { font-size: 0.75rem; color: var(--text-muted); margin-top: 3px; }
                .step-check { color: var(--success); font-size: 1.2rem; }

                .wizard-content { flex: 1; padding: 40px; overflow-y: auto; background: var(--bg-panel); }
                .step-pane { max-width: 800px; margin: 0 auto; }
                .pane-title { color: var(--text-main); font-size: 1.3rem; margin: 0 0 25px 0; padding-bottom: 15px; border-bottom: 1px solid var(--border-color); }
                
                .wizard-footer { padding: 20px 40px; background: var(--bg-main); border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
            `}</style>
        </div>
    );
}