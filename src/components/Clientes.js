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
    const [curp, setCurp] = useState('');
    const [motivoSinCurp, setMotivoSinCurp] = useState('');
    const [correo, setCorreo] = useState('');
    const [domicilio, setDomicilio] = useState('');
    const [emergenciaNombre, setEmergenciaNombre] = useState('');
    const [emergenciaParentesco, setEmergenciaParentesco] = useState('');
    const [emergenciaTelefono, setEmergenciaTelefono] = useState('');
    const [idioma, setIdioma] = useState('Español');
    const [responsable, setResponsable] = useState('');
    const [avisoPrivacidad, setAvisoPrivacidad] = useState(false); // NUEVO ESTADO DE PRIVACIDAD

    // Estados del Formulario (Alertas Clínicas)
    const [alertas, setAlertas] = useState([]); // Array de objetos {tipo, descripcion, gravedad}
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

    // Limpiar formulario
    const resetForm = () => {
        setPacienteEditando(null); setNombre(''); setTelefono(''); setFechaNac(''); setSexo('');
        setCurp(''); setMotivoSinCurp(''); setCorreo(''); setDomicilio(''); setEmergenciaNombre('');
        setEmergenciaParentesco(''); setEmergenciaTelefono(''); setIdioma('Español'); setResponsable('');
        setAvisoPrivacidad(false);
        setAlertas([]); setNewAlertaTipo(''); setNewAlertaDesc('');
    };

    const abrirFormulario = (paciente = null) => {
        if (paciente) {
            setPacienteEditando(paciente.id);
            setNombre(paciente.nombre || '');
            setTelefono(paciente.telefono || '');
            setFechaNac(paciente.fecha_nacimiento || '');
            setSexo(paciente.sexo || '');
            setCurp(paciente.curp || '');
            setMotivoSinCurp(paciente.motivo_sin_curp || '');
            setCorreo(paciente.correo || '');
            setDomicilio(paciente.domicilio || '');
            setEmergenciaNombre(paciente.contacto_emergencia_nombre || '');
            setEmergenciaParentesco(paciente.contacto_emergencia_parentesco || '');
            setEmergenciaTelefono(paciente.contacto_emergencia_telefono || '');
            setIdioma(paciente.idioma_preferente || 'Español');
            setResponsable(paciente.responsable_legal || '');
            setAvisoPrivacidad(paciente.aviso_privacidad_aceptado || false); // Recordar el check legal
            
            // Cargar alertas existentes (solo activas para visualización en form)
            setAlertas(paciente.alertas_clinicas?.filter(a => a.activa) || []);
        } else {
            resetForm();
        }
        setVista('formulario');
    };

    const agregarAlerta = () => {
        if (!nuevaAlertaTipo || !nuevaAlertaDesc) return;
        
        let gravedad = 'media';
        if (nuevaAlertaTipo === 'Marcapasos' || nuevaAlertaTipo === 'Alergia') gravedad = 'alta';
        
        setAlertas([...alertas, { tipo_alerta: nuevaAlertaTipo, descripcion: nuevaAlertaDesc, nivel_gravedad: gravedad }]);
        setNewAlertaTipo(''); setNewAlertaDesc('');
    };

    const quitarAlertaTemporal = (index) => {
        setAlertas(alertas.filter((_, i) => i !== index));
    };

    const guardarExpediente = async () => {
        if (!nombre || !telefono || !sexo || !fechaNac) return alert(t('camposObligatorios') + ' (Nombre, Tel, Sexo, Fecha Nac.)');
        if (!avisoPrivacidad) return alert(t('aceptarAviso'));

        // VALIDACIÓN ANTIDUPLICADOS BÁSICA (Por teléfono o CURP)
        if (!pacienteEditando) {
            const duplicado = pacientes.find(p => (curp && p.curp === curp) || (p.telefono === telefono));
            if (duplicado) {
                if (!window.confirm(`Parece que este paciente ya existe (${duplicado.nombre}). ¿Estás seguro de crear un registro nuevo?`)) return;
            }
        }

        const payload = {
            nombre: nombre.trim(), telefono: telefono.trim(), fecha_nacimiento: fechaNac, sexo,
            curp: curp.trim(), motivo_sin_curp: motivoSinCurp.trim(), correo: correo.trim(), domicilio: domicilio.trim(),
            contacto_emergencia_nombre: emergenciaNombre.trim(), contacto_emergencia_parentesco: emergenciaParentesco.trim(),
            contacto_emergencia_telefono: emergenciaTelefono.trim(), idioma_preferente: idioma, responsable_legal: responsable.trim(),
            // CAMPOS DE PRIVACIDAD
            aviso_privacidad_aceptado: avisoPrivacidad,
            aviso_privacidad_version: 'v1.0',
            aviso_privacidad_fecha: avisoPrivacidad && !pacienteEditando ? new Date().toISOString() : undefined // Solo graba la fecha si es nuevo y aceptó
        };
        
        let currentPacienteId = pacienteEditando;

        // 1. Guardar Datos Generales
        if (pacienteEditando) {
            const { error } = await supabase.from('clientes').update(payload).eq('id', pacienteEditando);
            if (error) return alert('Error al actualizar: ' + error.message);
        } else {
            payload.sucursal_alta_id = sucursalId; // Se registra dónde se dio de alta
            const { data, error } = await supabase.from('clientes').insert([payload]).select();
            if (error) return alert('Error al crear: ' + error.message);
            currentPacienteId = data[0].id;
        }

        // 2. Gestionar Alertas Clínicas (Borramos actuales y reescribimos las que quedaron en el array visual)
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

        alert(t('altaPacienteExito'));
        setVista('directorio');
        fetchPacientes();
    };

    // Renderizado del Directorio (Búsqueda por nombre, curp, tel o exp)
    const pacientesFiltrados = pacientes.filter(p => {
        const busqueda = searchTerm.toLowerCase();
        return (p.nombre && p.nombre.toLowerCase().includes(busqueda)) || 
               (p.telefono && p.telefono.includes(busqueda)) ||
               (p.num_expediente && p.num_expediente.toLowerCase().includes(busqueda)) ||
               (p.curp && p.curp.toLowerCase().includes(busqueda));
    });

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '20px', overflowY: 'auto'}}>
            
            {vista === 'directorio' && (
                <>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                        <div style={{flex: 1, marginRight: '20px'}}>
                            <input 
                                type="text" 
                                placeholder={t('placeholderBuscarCliente')} 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                style={{width: '100%', padding: '15px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '1.1rem'}}
                            />
                        </div>
                        <button className="btn-action btn-primary" onClick={() => abrirFormulario()} style={{padding: '15px 25px', fontSize: '1.1rem'}}><i className="fa-solid fa-folder-plus"></i> {t('nuevoPaciente')}</button>
                    </div>

                    <div className="panel" style={{padding: 0, borderRadius: '12px', overflow: 'hidden'}}>
                        <table className="data-table">
                            <thead style={{background: 'var(--bg-dark)'}}>
                                <tr>
                                    <th>{t('expediente')}</th>
                                    <th>{t('nombreCompleto')}</th>
                                    <th>{t('telefono')}</th>
                                    <th>{t('sexo')} / Edad</th>
                                    <th><i className="fa-solid fa-triangle-exclamation" style={{color: 'var(--primary-red)'}}></i> Alertas</th>
                                    <th style={{textAlign: 'center'}}>{t('acciones')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pacientesFiltrados.map(p => {
                                    // Cálculo rápido de edad
                                    let edad = 'N/A';
                                    if (p.fecha_nacimiento) {
                                        const diff = Date.now() - new Date(p.fecha_nacimiento).getTime();
                                        edad = Math.abs(new Date(diff).getUTCFullYear() - 1970);
                                    }

                                    const alertasActivas = p.alertas_clinicas?.filter(a => a.activa) || [];

                                    return (
                                        <tr key={p.id}>
                                            <td style={{fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 'bold'}}>{p.num_expediente || 'S/E'}</td>
                                            <td>
                                                <strong>{p.nombre}</strong><br/>
                                                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{p.curp || 'Sin CURP'}</span>
                                            </td>
                                            <td>{p.telefono || t('sinTelefono')}</td>
                                            <td>{p.sexo || '-'} <br/><span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{edad} años</span></td>
                                            <td>
                                                {alertasActivas.length > 0 ? (
                                                    <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
                                                        {alertasActivas.map(a => (
                                                            <span key={a.id} style={{fontSize: '0.7rem', background: a.nivel_gravedad === 'alta' ? 'var(--primary-red)' : '#ffb300', color: 'white', padding: '3px 6px', borderRadius: '4px'}}>
                                                                {a.tipo_alerta}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : <span style={{color: 'var(--text-muted)', fontSize: '0.8rem'}}>Ninguna</span>}
                                            </td>
                                            <td style={{textAlign: 'center'}}>
                                                <button className="btn-action" onClick={() => abrirFormulario(p)} style={{background: 'var(--bg-lighter)', border: '1px solid var(--border-color)', color: 'white'}}>
                                                    <i className="fa-solid fa-pen"></i> Editar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {pacientesFiltrados.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>No se encontraron expedientes.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* FORMULARIO DE ALTA DE EXPEDIENTE */}
            {vista === 'formulario' && (
                <div style={{display: 'flex', gap: '20px', alignItems: 'flex-start'}}>
                    
                    {/* COLUMNA IZQUIERDA: DATOS ADMINISTRATIVOS */}
                    <div className="panel" style={{flex: 2, background: 'var(--bg-panel)', borderRadius: '12px', padding: '30px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px'}}>
                            <h2><i className="fa-solid fa-id-card-clip" style={{color: 'var(--accent)'}}></i> {pacienteEditando ? 'Editar Expediente' : 'Alta de Expediente Clínico'}</h2>
                            {pacienteEditando && <span style={{background: 'var(--bg-dark)', padding: '5px 15px', borderRadius: '20px', fontFamily: 'monospace', color: 'var(--accent)'}}>Exp: {pacientes.find(p => p.id === pacienteEditando)?.num_expediente}</span>}
                        </div>

                        <h4 style={{color: '#00b0ff', marginBottom: '15px'}}>1. {t('datosGenerales')}</h4>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px'}}>
                            <div><label className="form-label">{t('nombreCompleto')} *</label><input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="form-input" /></div>
                            <div><label className="form-label">{t('telefono')} *</label><input type="text" value={telefono} onChange={e => setTelefono(e.target.value)} className="form-input" /></div>
                            
                            <div><label className="form-label">{t('fechaNacimiento')} *</label><input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} className="form-input" /></div>
                            <div>
                                <label className="form-label">{t('sexo')} *</label>
                                <select value={sexo} onChange={e => setSexo(e.target.value)} className="form-input">
                                    <option value="">-- Seleccionar --</option>
                                    <option value="Femenino">Femenino</option>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>

                            <div><label className="form-label">{t('curp')}</label><input type="text" value={curp} onChange={e => setCurp(e.target.value)} className="form-input" maxLength="18" placeholder="18 Caracteres" style={{textTransform: 'uppercase'}} /></div>
                            <div><label className="form-label">{t('sinCurp')}</label><input type="text" value={motivoSinCurp} onChange={e => setMotivoSinCurp(e.target.value)} className="form-input" placeholder="Ej. Extranjero, no lo recuerda..." disabled={curp.length > 0} /></div>
                            
                            <div><label className="form-label">{t('correo')}</label><input type="email" value={correo} onChange={e => setCorreo(e.target.value)} className="form-input" /></div>
                            <div><label className="form-label">{t('idioma')}</label><input type="text" value={idioma} onChange={e => setIdioma(e.target.value)} className="form-input" /></div>
                            
                            <div style={{gridColumn: '1 / -1'}}><label className="form-label">{t('domicilio')}</label><input type="text" value={domicilio} onChange={e => setDomicilio(e.target.value)} className="form-input" placeholder="Calle, Número, Colonia, Alcaldía/Municipio, CP..." /></div>
                        </div>

                        <h4 style={{color: '#00b0ff', marginBottom: '15px'}}>2. {t('contactoEmergencia')}</h4>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '25px'}}>
                            <div><label className="form-label">Nombre</label><input type="text" value={emergenciaNombre} onChange={e => setEmergenciaNombre(e.target.value)} className="form-input" /></div>
                            <div><label className="form-label">{t('parentesco')}</label><input type="text" value={emergenciaParentesco} onChange={e => setEmergenciaParentesco(e.target.value)} className="form-input" /></div>
                            <div><label className="form-label">{t('telefono')}</label><input type="text" value={emergenciaTelefono} onChange={e => setEmergenciaTelefono(e.target.value)} className="form-input" /></div>
                        </div>

                        <div><label className="form-label">{t('responsableLegal')}</label><input type="text" value={responsable} onChange={e => setResponsable(e.target.value)} className="form-input" placeholder="Llenar solo si es menor de edad o persona que no puede consentir" /></div>
                    
                        {/* CASILLA ROJA OBLIGATORIA AVISO DE PRIVACIDAD */}
                        <label style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'rgba(198, 40, 40, 0.1)', padding: '15px', borderRadius: '8px', border: '1px dashed var(--primary-red)', marginTop: '25px'}}>
                            <input type="checkbox" checked={avisoPrivacidad} onChange={e => setAvisoPrivacidad(e.target.checked)} style={{width: '20px', height: '20px'}} />
                            <span style={{color: 'white', fontWeight: 'bold'}}>{t('avisoPrivacidad')} *</span>
                        </label>
                    </div>

                    {/* COLUMNA DERECHA: ALERTAS CLÍNICAS Y GUARDADO */}
                    <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '20px'}}>
                        
                        <div className="panel" style={{background: 'rgba(198, 40, 40, 0.05)', borderRadius: '12px', padding: '25px', border: '1px solid rgba(198, 40, 40, 0.3)'}}>
                            <h3 style={{color: 'var(--primary-red)', marginBottom: '15px'}}><i className="fa-solid fa-triangle-exclamation"></i> {t('alertasClinicas')}</h3>
                            <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px'}}>Estas alertas generarán un bloqueo visual rojo en el historial médico del paciente.</p>
                            
                            <div style={{background: 'var(--bg-dark)', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid var(--border-color)'}}>
                                <select value={nuevaAlertaTipo} onChange={e => setNewAlertaTipo(e.target.value)} className="form-input" style={{marginBottom: '10px'}}>
                                    <option value="">-- Seleccionar Alerta --</option>
                                    <option value="Alergia">{t('alergia')}</option>
                                    <option value="Marcapasos">{t('marcapasos')}</option>
                                    <option value="Anticoagulantes">{t('anticoagulantes')}</option>
                                    <option value="Embarazo">{t('embarazo')}</option>
                                    <option value="Enfermedad Transmisible">{t('enfermedadTransmisible')}</option>
                                    <option value="Riesgo Urgencia">{t('riesgoUrgencia')}</option>
                                </select>
                                <textarea 
                                    value={nuevaAlertaDesc} onChange={e => setNewAlertaDesc(e.target.value)} 
                                    className="form-input" rows="2" placeholder="Especificar detalle..." 
                                    style={{marginBottom: '10px', resize: 'none'}}
                                ></textarea>
                                <button className="btn-action" onClick={agregarAlerta} style={{width: '100%', background: 'var(--primary-red)', color: 'white', border: 'none'}}>+ Añadir Alerta</button>
                            </div>

                            {/* LISTA DE ALERTAS VISUALES */}
                            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                {alertas.map((a, i) => (
                                    <div key={i} style={{background: 'var(--bg-panel)', padding: '10px', borderRadius: '6px', borderLeft: `4px solid ${a.nivel_gravedad === 'alta' ? 'var(--primary-red)' : '#ffb300'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                        <div>
                                            <strong style={{fontSize: '0.85rem'}}>{a.tipo_alerta}</strong>
                                            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{a.descripcion}</div>
                                        </div>
                                        <button onClick={() => quitarAlertaTemporal(i)} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'}}><i className="fa-solid fa-xmark"></i></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="panel" style={{background: 'var(--bg-panel)', borderRadius: '12px', padding: '20px'}}>
                            <button onClick={guardarExpediente} className="pay-btn" style={{width: '100%', padding: '15px', background: '#1b5e20', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px'}}>
                                <i className="fa-solid fa-floppy-disk"></i> Guardar Expediente
                            </button>
                            <button onClick={() => setVista('directorio')} className="btn-action" style={{width: '100%', padding: '15px', background: 'transparent', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px'}}>
                                Cancelar
                            </button>
                        </div>

                    </div>
                </div>
            )}

            <style jsx>{`
                .form-label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px; }
                .form-input { width: 100%; padding: 12px; background: var(--bg-dark); color: white; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.95rem; }
                .form-input:focus { outline: none; border-color: var(--accent); }
            `}</style>
        </div>
    );
}