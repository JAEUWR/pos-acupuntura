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

    // 🚀 FIX: Aseguramos que la sucursal se mapee correctamente sin importar mayúsculas/minúsculas
    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[(branch || '').toLowerCase()] || 1;

    // 🚀 FORMATEADOR ESTRICTO: Quita acentos y fuerza Mayúsculas en tiempo real
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

    // 🚀 LÓGICA DE GUARDADO ESTRICTO Y ANTI-DUPLICADOS
    const guardarExpediente = async () => {
        if (!nombres || !apellidos || !telefono || !sexo || !fechaNac || !estadoCivil) return alert(t('camposObligatoriosGeneral') || 'Faltan campos obligatorios (Nombres, Apellidos, Tel, Sexo, Fecha Nac, Estado Civil).');
        if (!avisoPrivacidad) return alert(t('aceptarAviso') || 'Debes aceptar el Aviso de Privacidad.');

        const nombresNorm = nombres.trim();
        const apellidosNorm = apellidos.trim();
        const fullName = `${nombresNorm} ${apellidosNorm}`;

        // 🚀 BLOQUEO ESTRICTO DE DUPLICADOS (Si no estamos editando)
        if (!pacienteEditando) {
            // 1. Verificamos coincidencia exacta de Nombre + Apellido
            const nameDupe = pacientes.find(p => p.nombres === nombresNorm && p.apellidos === apellidosNorm);
            if (nameDupe) {
                return alert(`🚨 ERROR: El paciente "${fullName}" ya existe en el sistema con el expediente ${nameDupe.codigo_expediente || 'S/E'}. No se pueden crear duplicados.`);
            }

            // 2. Verificamos CURP duplicado (Si ingresaron uno)
            if (curp.trim()) {
                const curpDupe = pacientes.find(p => p.curp === curp.trim());
                if (curpDupe) {
                    return alert(`🚨 ERROR: La CURP ingresada ya pertenece al paciente ${curpDupe.nombre} (Exp: ${curpDupe.codigo_expediente || 'S/E'}).`);
                }
            }

            // 3. Verificamos Teléfono duplicado (Este es un aviso suave porque las familias pueden compartir número)
            if (telefono.trim()) {
                const telDupe = pacientes.find(p => p.telefono === telefono.trim());
                if (telDupe) {
                    if (!window.confirm(`⚠️ AVISO: El teléfono ${telefono.trim()} ya está registrado a nombre de ${telDupe.nombre}. ¿Deseas continuar de todos modos? (Puede ser un número familiar compartido)`)) return;
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
            
            // Generar Código Expediente Nuevo asegurando que extraiga la inicial correcta
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
                        <button className="btn-primary" onClick={() => abrirFormulario()} style={{padding: '14px 25px', fontSize: '1rem', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)', transition: 'all 0.3s'}}>
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
                <div className="animate-fade-in" style={{display: 'flex', gap: '25px', alignItems: 'flex-start'}}>
                    
                    {/* COLUMNA IZQUIERDA: DATOS ADMINISTRATIVOS */}
                    <div className="panel" style={{flex: 2, background: 'var(--bg-panel)', borderRadius: '16px', padding: '35px', boxShadow: 'var(--shadow-sm)'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px'}}>
                            <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.5rem'}}><i className="fa-solid fa-id-card-clip" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {pacienteEditando ? (t('editarExpediente') || 'Editar Expediente') : (t('altaExpedienteClinico') || 'Alta de Expediente Clínico')}</h2>
                            {pacienteEditando && <span style={{background: 'var(--bg-main)', padding: '6px 15px', border: '1px solid var(--border-color)', borderRadius: '20px', fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 'bold'}}>{t('expAbrev') || 'Exp:'} {pacientes.find(p => p.id === pacienteEditando)?.codigo_expediente || 'S/E'}</span>}
                        </div>

                        <h4 style={{color: 'var(--accent)', marginBottom: '20px', fontSize: '1.1rem'}}><i className="fa-solid fa-address-book" style={{marginRight: '8px'}}></i> {t('datosGeneralesNum') || '1. Datos Generales'}</h4>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px'}}>
                            
                            {/* 🚀 CAMPOS QUE SE FORMATEAN A MAYÚSCULAS EN TIEMPO REAL */}
                            <div><label className="form-label">{t('nombres') || 'Nombres'} *</label><input type="text" value={nombres} onChange={e => setNombres(formatUpperCase(e.target.value))} className="form-input" placeholder="Ej. JOSE ADRIAN" /></div>
                            <div><label className="form-label">{t('apellidos') || 'Apellidos'} *</label><input type="text" value={apellidos} onChange={e => setApellidos(formatUpperCase(e.target.value))} className="form-input" placeholder="Ej. ESTRADA URIBE" /></div>
                            
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
                            <div><label className="form-label">{t('ocupacion') || 'Ocupación'}</label><input type="text" value={ocupacion} onChange={e => setOcupacion(formatUpperCase(e.target.value))} className="form-input" placeholder={t('ejOcupacion') || 'Ej. ESTUDIANTE, DOCENTE, ING...'} /></div>

                            <div><label className="form-label">{t('curp')}</label><input type="text" value={curp} onChange={e => setCurp(formatUpperCase(e.target.value))} className="form-input" maxLength="18" placeholder="18 Caracteres" /></div>
                            <div><label className="form-label">{t('sinCurp') || 'Motivo Sin CURP'}</label><input type="text" value={motivoSinCurp} onChange={e => setMotivoSinCurp(formatUpperCase(e.target.value))} className="form-input" placeholder="Ej. EXTRANJERO, NO LO RECUERDA..." disabled={curp.length > 0} style={{opacity: curp.length > 0 ? 0.5 : 1}} /></div>
                            
                            {/* Correo se mantiene en minúsculas */}
                            <div><label className="form-label">{t('correo')}</label><input type="email" value={correo} onChange={e => setCorreo(e.target.value.toLowerCase())} className="form-input" /></div>
                            <div><label className="form-label">{t('idioma')}</label><input type="text" value={idioma} onChange={e => setIdioma(formatUpperCase(e.target.value))} className="form-input" /></div>
                            
                            <div style={{gridColumn: '1 / -1'}}><label className="form-label">{t('domicilio')}</label><input type="text" value={domicilio} onChange={e => setDomicilio(formatUpperCase(e.target.value))} className="form-input" placeholder="CALLE, NÚMERO, COLONIA, ALCALDÍA/MUNICIPIO, CP..." /></div>
                        </div>

                        {/* SWITCH HABLA INGLÉS */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', background: sabeIngles ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-main)', padding: '15px 20px', borderRadius: '12px', border: sabeIngles ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid var(--border-color)', marginBottom: '40px', transition: 'all 0.3s ease' }}>
                            <input type="checkbox" checked={sabeIngles} onChange={e => setSabeIngles(e.target.checked)} style={{width: '24px', height: '24px', accentColor: '#3b82f6'}} />
                            <span style={{color: sabeIngles ? '#3b82f6' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1rem'}}><i className="fa-solid fa-language"></i> {t('pacienteHablaIngles') || 'Paciente habla Inglés (Pase directo con Médico)'}</span>
                        </label>

                        <h4 style={{color: 'var(--accent)', marginBottom: '20px', fontSize: '1.1rem'}}><i className="fa-solid fa-kit-medical" style={{marginRight: '8px'}}></i> {t('contactoEmergenciaNum') || '2. Contacto de Emergencia'}</h4>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '40px'}}>
                            <div><label className="form-label">{t('nombre') || 'Nombre'}</label><input type="text" value={emergenciaNombre} onChange={e => setEmergenciaNombre(formatUpperCase(e.target.value))} className="form-input" /></div>
                            <div><label className="form-label">{t('parentesco')}</label><input type="text" value={emergenciaParentesco} onChange={e => setEmergenciaParentesco(formatUpperCase(e.target.value))} className="form-input" /></div>
                            <div><label className="form-label">{t('telefono')}</label><input type="text" value={emergenciaTelefono} onChange={e => setEmergenciaTelefono(e.target.value)} className="form-input" /></div>
                        </div>

                        <div><label className="form-label">{t('responsableLegal')}</label><input type="text" value={responsable} onChange={e => setResponsable(formatUpperCase(e.target.value))} className="form-input" placeholder="Llenar solo si es menor de edad o persona que no puede consentir" /></div>
                    
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

                        {/* POST-IT NOTA INTERNA STAFF */}
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
                .animate-slide-up-row { opacity: 0; animation: slideUpRow 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                @keyframes slideUpRow { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}