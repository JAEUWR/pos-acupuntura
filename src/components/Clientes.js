'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Clientes({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage();
    const [pacientes, setPacientes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Vistas: 'directorio', 'formulario', 'resumen'
    const [vista, setVista] = useState('directorio');
    const [activeSucursalTab, setActiveSucursalTab] = useState('todas'); 
    const [showLegacyClients, setShowLegacyClients] = useState(false); 
    const [sucursalesDB, setSucursalesDB] = useState([]);

    const [pacienteEditando, setPacienteEditando] = useState(null);

    // 🚀 ESTADO PARA EL WIZARD DEL FORMULARIO
    const [formStep, setFormStep] = useState(1);

    // 🚀 BLINDAJE ANTI-DOBLE CLIC
    const isProcessingRef = useRef(false);
    const [isProcessingBtn, setIsProcessingBtn] = useState(false);

    // Estados del Formulario (Paso 1 y 2: Generales y Legal)
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
    const [idioma, setIdioma] = useState(t('espanol') || 'Español');
    const [sabeIngles, setSabeIngles] = useState(false);
    const [responsable, setResponsable] = useState('');
    const [avisoPrivacidad, setAvisoPrivacidad] = useState(false);
    const [notaInterna, setNotaInterna] = useState('');

    // Estados del Formulario (Alertas Clínicas)
    const [alertas, setAlertas] = useState([]); 
    const [nuevaAlertaTipo, setNewAlertaTipo] = useState('');
    const [nuevaAlertaDesc, setNewAlertaDesc] = useState('');

    // 🚀 NUEVOS ESTADOS: Historia Clínica (Paso 3)
    const [hForm, setHForm] = useState({
        motivo_padecimiento: '', antecedentes_familiares: '', antecedentes_personales: '',
        habitos_sustancias: '', habitos_sueno: '', medicamentos_actuales: '', gineco_obstetricos: '', planificacion_familiar: ''
    });

    // 🚀 NUEVOS ESTADOS: Consentimiento Informado (Paso 4)
    const [cForm, setCForm] = useState({ testigo_1: '', testigo_2: '', acepta: false });
    const [consentimientosGuardados, setConsentimientosGuardados] = useState([]);

    // Modales rápidos
    const [showNewPatientModal, setShowNewPatientModal] = useState(false);
    const [npNombres, setNpNombres] = useState('');
    const [npApellidos, setNpApellidos] = useState('');
    const [npTelefono, setNpTelefono] = useState('');
    const [npFechaNacimiento, setNpFechaNacimiento] = useState('');
    const [npSexo, setNpSexo] = useState('');

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[(branch || '').toLowerCase()] || 1;

    const antecedentesList = ['diabetes', 'hipertension', 'cardiopatia', 'cancer', 'asma', 'bronquitis', 'hepatitis', 'artritis', 'depresion', 'alergias'];

    const formatUpperCase = (str) => {
        if (!str) return '';
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    const fetchPacientesYSucursales = async () => {
        const { data: sucursales } = await supabase.from('sucursales').select('id, nombre').order('id');
        if (sucursales) setSucursalesDB(sucursales);

        const { data } = await supabase.from('clientes').select(`
            *, 
            alertas_clinicas(id, tipo_alerta, descripcion, nivel_gravedad, activa),
            historia_clinica(id)
        `).order('nombre', { ascending: true });
        if (data) setPacientes(data);
    };

    useEffect(() => {
        fetchPacientesYSucursales();
    }, []);

    const resetForm = () => {
        setPacienteEditando(null); setNombres(''); setApellidos(''); setTelefono(''); setFechaNac(''); setSexo('');
        setEstadoCivil(''); setOcupacion(''); setCurp(''); setMotivoSinCurp(''); setCorreo(''); setDomicilio(''); 
        setEmergenciaNombre(''); setEmergenciaParentesco(''); setEmergenciaTelefono(''); setIdioma(t('espanol') || 'Español'); 
        setSabeIngles(false); setResponsable(''); setAvisoPrivacidad(false); setNotaInterna('');
        setAlertas([]); setNewAlertaTipo(''); setNewAlertaDesc('');
        
        setHForm({ motivo_padecimiento: '', antecedentes_familiares: '', antecedentes_personales: '', habitos_sustancias: '', habitos_sueno: '', medicamentos_actuales: '', gineco_obstetricos: '', planificacion_familiar: '' });
        setCForm({ testigo_1: '', testigo_2: '', acepta: false });
        setConsentimientosGuardados([]);
        
        setFormStep(1);
    };

    // 🚀 ABRIR PERFIL (Para Resumen o Para Edición)
    const abrirPerfilPaciente = async (paciente = null, modo = 'formulario') => {
        if (paciente) {
            setPacienteEditando(paciente.id);
            setNombres(paciente.nombres || ''); setApellidos(paciente.apellidos || ''); setTelefono(paciente.telefono || '');
            setFechaNac(paciente.fecha_nacimiento || ''); setSexo(paciente.sexo || ''); setEstadoCivil(paciente.estado_civil || '');
            setOcupacion(paciente.ocupacion || ''); setCurp(paciente.curp || ''); setMotivoSinCurp(paciente.motivo_sin_curp || '');
            setCorreo(paciente.correo || ''); setDomicilio(paciente.domicilio || ''); setEmergenciaNombre(paciente.contacto_emergencia_nombre || '');
            setEmergenciaParentesco(paciente.contacto_emergencia_parentesco || ''); setEmergenciaTelefono(paciente.contacto_emergencia_telefono || '');
            setIdioma(paciente.idioma_preferente || (t('espanol') || 'Español')); setSabeIngles(paciente.sabe_ingles || false);
            setResponsable(paciente.responsable_legal || ''); setAvisoPrivacidad(paciente.aviso_privacidad_aceptado || false); 
            setNotaInterna(paciente.nota_interna || ''); setAlertas(paciente.alertas_clinicas?.filter(a => a.activa) || []);
            
            // 🚀 Cargar Historia Clínica (maybeSingle previene errores si no existe)
            const { data: hData } = await supabase.from('historia_clinica').select('*').eq('paciente_id', paciente.id).maybeSingle();
            if (hData) {
                let textoMotivo = hData.motivo_consulta || '';
                if (hData.padecimiento_actual) {
                    textoMotivo += (textoMotivo ? '\n\n' : '') + 'Padecimiento Actual:\n' + hData.padecimiento_actual;
                }
                setHForm({
                    motivo_padecimiento: textoMotivo,
                    antecedentes_familiares: hData.antecedentes_familiares || '', antecedentes_personales: hData.antecedentes_personales || '',
                    habitos_sustancias: hData.habitos_sustancias || '', habitos_sueno: hData.habitos_sueno || '',
                    medicamentos_actuales: hData.medicamentos_actuales || '', gineco_obstetricos: hData.gineco_obstetricos || '',
                    planificacion_familiar: hData.planificacion_familiar || ''
                });
            } else {
                setHForm({ motivo_padecimiento: '', antecedentes_familiares: '', antecedentes_personales: '', habitos_sustancias: '', habitos_sueno: '', medicamentos_actuales: '', gineco_obstetricos: '', planificacion_familiar: '' });
            }
            
            // 🚀 Cargar Consentimientos Firmados
            const { data: cData } = await supabase.from('consentimientos_informados').select('*').eq('paciente_id', paciente.id).order('fecha_firma', { ascending: false });
            setConsentimientosGuardados(cData || []);
            setCForm({ testigo_1: '', testigo_2: '', acepta: false });
            
            setFormStep(1);
        } else {
            resetForm();
        }
        setVista(modo);
    };

    const agregarAlerta = () => {
        if (!nuevaAlertaTipo || !nuevaAlertaDesc) return;
        let gravedad = 'media';
        if (nuevaAlertaTipo === 'Marcapasos' || nuevaAlertaTipo === 'Alergia' || nuevaAlertaTipo === 'Embarazo') gravedad = 'alta';
        setAlertas([...alertas, { tipo_alerta: nuevaAlertaTipo, descripcion: nuevaAlertaDesc, nivel_gravedad: gravedad }]);
        setNewAlertaTipo(''); setNewAlertaDesc('');
    };

    const quitarAlertaTemporal = (index) => {
        setAlertas(alertas.filter((_, i) => i !== index));
    };

    const agregarTextoRapido = (campo, texto) => {
        setHForm(prev => {
            const actual = prev[campo];
            const nuevoTexto = actual ? `${actual}, ${texto}` : texto;
            return { ...prev, [campo]: nuevoTexto };
        });
    };

    // 🚀 FUNCIÓN BLINDADA ANTI-DOBLE CLIC (WIZARD EXPEDIENTE)
    const guardarExpediente = async () => {
        if (isProcessingRef.current) return;

        if (!nombres || !apellidos || !telefono || !sexo || !fechaNac || !estadoCivil) {
            setFormStep(1);
            return alert(t('camposObligatoriosGeneral') || 'Faltan campos obligatorios en la sección 1 (Nombres, Apellidos, Tel, Sexo, Fecha Nac, Estado Civil).');
        }
        if (!avisoPrivacidad) {
            setFormStep(2); 
            return alert(t('aceptarAviso') || 'Debes aceptar el Aviso de Privacidad antes de continuar.');
        }

        const nombresNorm = nombres.trim();
        const apellidosNorm = apellidos.trim();
        const fullName = `${nombresNorm} ${apellidosNorm}`;

        if (!pacienteEditando) {
            const nameDupe = pacientes.find(p => p.nombres === nombresNorm && p.apellidos === apellidosNorm);
            if (nameDupe) return alert((t('errorPacienteDuplicado') || '🚨 ERROR: El paciente ya existe con el expediente: ') + fullName + ' (' + (nameDupe.codigo_expediente || 'S/E') + ')');

            if (curp.trim()) {
                const curpDupe = pacientes.find(p => p.curp === curp.trim());
                if (curpDupe) return alert((t('errorCurpDuplicada') || '🚨 ERROR: La CURP ingresada ya pertenece al paciente: ') + curpDupe.nombre);
            }

            if (telefono.trim()) {
                const telDupe = pacientes.find(p => p.telefono === telefono.trim());
                if (telDupe) {
                    if (!window.confirm((t('avisoTelefonoDuplicado') || '⚠️ AVISO: El teléfono ya está registrado a nombre de: ') + telDupe.nombre + '. ' + (t('deseaContinuar') || '¿Deseas continuar de todos modos?'))) return;
                }
            }
        }

        isProcessingRef.current = true;
        setIsProcessingBtn(true);

        try {
            // 1. Guardar Cliente
            const payloadCliente = {
                nombre: fullName, nombres: nombresNorm, apellidos: apellidosNorm,
                telefono: telefono.trim(), fecha_nacimiento: fechaNac, sexo, estado_civil: estadoCivil, ocupacion: ocupacion.trim(), 
                sabe_ingles: sabeIngles, curp: curp.trim(), motivo_sin_curp: motivoSinCurp.trim(), correo: correo.trim().toLowerCase(), 
                domicilio: domicilio.trim(), contacto_emergencia_nombre: emergenciaNombre.trim(), contacto_emergencia_parentesco: emergenciaParentesco.trim(),
                contacto_emergencia_telefono: emergenciaTelefono.trim(), idioma_preferente: idioma, responsable_legal: responsable.trim(),
                nota_interna: notaInterna.trim(), aviso_privacidad_aceptado: avisoPrivacidad, aviso_privacidad_version: 'v1.0',
                aviso_privacidad_fecha: avisoPrivacidad && !pacienteEditando ? new Date().toISOString() : undefined 
            };
            
            let currentPacienteId = pacienteEditando;

            if (pacienteEditando) {
                const { error } = await supabase.from('clientes').update(payloadCliente).eq('id', pacienteEditando);
                if (error) {
                    alert((t('errorActualizar') || 'Error al actualizar Cliente: ') + error.message);
                    return;
                }
            } else {
                payloadCliente.sucursal_registro_id = sucursalId; 
                const { data, error } = await supabase.from('clientes').insert([payloadCliente]).select();
                if (error) {
                    alert((t('errorCrear') || 'Error al crear Cliente: ') + error.message);
                    return;
                }
                
                currentPacienteId = data[0].id;
                const yearMonth = new Date().getFullYear().toString().slice(-2) + (new Date().getMonth() + 1).toString().padStart(2, '0');
                const branchLetter = (branch || 'Napoles').charAt(0).toUpperCase();
                const generatedExpCode = `HK-${branchLetter}-${yearMonth}-${currentPacienteId.toString().padStart(4, '0')}`;
                await supabase.from('clientes').update({ codigo_expediente: generatedExpCode }).eq('id', currentPacienteId);
            }

            // 2. Guardar Alertas
            await supabase.from('alertas_clinicas').delete().eq('paciente_id', currentPacienteId);
            if (alertas.length > 0) {
                const alertasPayload = alertas.map(a => ({
                    paciente_id: currentPacienteId, tipo_alerta: a.tipo_alerta, descripcion: a.descripcion,
                    nivel_gravedad: a.nivel_gravedad, registrado_por: perfilActual?.nombre || 'Recepción'
                }));
                const { error: errAlertas } = await supabase.from('alertas_clinicas').insert(alertasPayload);
                if (errAlertas) console.error("Error alertas:", errAlertas);
            }

            // 3. Guardar Historia Clínica (Siempre como Borrador, SIN sucursal_id que causaba error)
            const payloadHistoria = {
                paciente_id: currentPacienteId,
                medico_nombre: perfilActual?.nombre || 'Recepción', 
                motivo_consulta: hForm.motivo_padecimiento, 
                padecimiento_actual: null, 
                antecedentes_personales: hForm.antecedentes_personales, 
                antecedentes_familiares: hForm.antecedentes_familiares,
                medicamentos_actuales: hForm.medicamentos_actuales, 
                habitos_sustancias: hForm.habitos_sustancias,
                habitos_sueno: hForm.habitos_sueno, 
                gineco_obstetricos: sexo === 'Femenino' ? hForm.gineco_obstetricos : '',
                planificacion_familiar: sexo === 'Femenino' ? hForm.planificacion_familiar : '',
                estado: 'borrador' 
            };

            const { data: existingHC } = await supabase.from('historia_clinica').select('id, estado').eq('paciente_id', currentPacienteId).maybeSingle();
            
            if (existingHC) {
                // Solo actualizamos si sigue siendo borrador.
                if(existingHC.estado === 'borrador') {
                    const { error: errHCUpd } = await supabase.from('historia_clinica').update(payloadHistoria).eq('id', existingHC.id);
                    if (errHCUpd) alert("Error actualizando historial médico: " + errHCUpd.message);
                }
            } else {
                const { error: errHCIns } = await supabase.from('historia_clinica').insert([payloadHistoria]);
                if (errHCIns) alert("Error creando historial médico: " + errHCIns.message);
            }

            // 4. Guardar Nuevo Consentimiento si se llenó
            if (cForm.acepta && cForm.testigo_1 && cForm.testigo_2) {
                const cPayload = {
                    paciente_id: currentPacienteId, 
                    medico_nombre: perfilActual?.nombre || 'Recepción',
                    texto_legal: t('textoLegalAcupuntura') || 'Declaro que se me ha explicado de manera clara y comprensible...',
                    paciente_acepta: true,
                    testigo_1_nombre: cForm.testigo_1, 
                    testigo_2_nombre: cForm.testigo_2,
                    firma_hash: Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
                };
                const { error: errConsent } = await supabase.from('consentimientos_informados').insert([cPayload]);
                if (errConsent) alert("Error al guardar el consentimiento legal: " + errConsent.message);
            } else if ((cForm.testigo_1 || cForm.testigo_2) && !cForm.acepta) {
                alert(t('avisoConsentimientoNoGuardado') || 'Nota: El consentimiento no se guardó porque faltó marcar la casilla de aceptación.');
            }

            alert(t('altaPacienteExito') || 'Expediente integral guardado exitosamente.');
            setVista('directorio');
            fetchPacientesYSucursales();

        } catch (error) {
            console.error(error);
            alert("Error general al guardar el expediente.");
        } finally {
            isProcessingRef.current = false;
            setIsProcessingBtn(false);
        }
    };

    // 🚀 FUNCIÓN BLINDADA ANTI-DOBLE CLIC (ALTA RÁPIDA)
    const guardarPacienteRapido = async () => {
        if (isProcessingRef.current) return;

        if (!npNombres || !npApellidos || !npTelefono || !npFechaNacimiento || !npSexo) {
            return alert(t('alertaCamposMinimos') || 'Nombres, Apellidos, Teléfono, Fecha Nacimiento y Sexo son obligatorios.');
        }

        const nombresNorm = npNombres.trim(); 
        const apellidosNorm = npApellidos.trim(); 
        const fullName = `${nombresNorm} ${apellidosNorm}`;
        const duplicado = pacientes.find(p => (p.telefono === npTelefono) || (p.nombres === nombresNorm && p.apellidos === apellidosNorm));
        
        if (duplicado) return alert(t('errorPacienteExistente') || `🚨 ERROR: El paciente ya existe.`);

        isProcessingRef.current = true;
        setIsProcessingBtn(true);

        try {
            const payload = { nombre: fullName, nombres: nombresNorm, apellidos: apellidosNorm, telefono: npTelefono.trim(), fecha_nacimiento: npFechaNacimiento, sexo: npSexo, sucursal_registro_id: sucursalId };
            const { data, error } = await supabase.from('clientes').insert([payload]).select();
            if (error) {
                alert((t('errorRegistrar') || 'Error al registrar: ') + error.message);
                return;
            }

            const newId = data[0].id;
            const yearMonth = new Date().getFullYear().toString().slice(-2) + (new Date().getMonth() + 1).toString().padStart(2, '0');
            const expCode = `HK-${(branch || 'N').charAt(0).toUpperCase()}-${yearMonth}-${newId.toString().padStart(4, '0')}`;
            await supabase.from('clientes').update({ codigo_expediente: expCode }).eq('id', newId);

            alert(t('crearExpedienteExito') || 'Expediente rápido creado.');
            setShowNewPatientModal(false); setNpNombres(''); setNpApellidos(''); setNpTelefono(''); setNpFechaNacimiento(''); setNpSexo('');
            fetchPacientesYSucursales();

        } catch (error) {
            console.error(error);
        } finally {
            isProcessingRef.current = false;
            setIsProcessingBtn(false);
        }
    };

    // 🚀 FUNCIÓN BLINDADA (ELIMINAR PACIENTE)
    const eliminarPaciente = async (id, nombreP) => {
        if (isProcessingRef.current) return;
        if (!window.confirm(`${t('confirmarEliminarExpediente') || '¿Eliminar permanentemente a'} ${nombreP}?`)) return;
        
        isProcessingRef.current = true;
        try {
            await supabase.from('alertas_clinicas').delete().eq('paciente_id', id);
            const { error } = await supabase.from('clientes').delete().eq('id', id);
            if (error) alert((t('errorEliminarExpediente') || 'Error: No se puede borrar si ya tiene historial clínico o ventas. ') + error.message);
            else fetchPacientesYSucursales(); 
        } finally {
            isProcessingRef.current = false;
        }
    };

    const getNombreSucursal = (id) => {
        const suc = sucursalesDB.find(s => s.id === id);
        return suc ? suc.nombre : 'S/A';
    };

    const pacientesFiltrados = pacientes.filter(p => {
        const isLegacy = p.codigo_expediente && p.codigo_expediente.includes('LEGACY');
        if (!showLegacyClients && isLegacy) return false;
        const busqueda = searchTerm.toLowerCase().trim();
        if (busqueda !== '') return (p.nombre && p.nombre.toLowerCase().includes(busqueda)) || (p.telefono && p.telefono.includes(busqueda)) || (p.codigo_expediente && p.codigo_expediente.toLowerCase().includes(busqueda)) || (p.curp && p.curp.toLowerCase().includes(busqueda));
        if (activeSucursalTab !== 'todas') return p.sucursal_registro_id === activeSucursalTab;
        return true;
    });

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '25px', overflowY: 'auto', paddingRight: '5px'}}>
            
            {/* 🚀 VISTA 1: DIRECTORIO GENERAL */}
            {vista === 'directorio' && (
                <>
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
                                title={t('alternarPacientesAntiguos') || "Mostrar/Ocultar pacientes antiguos"}
                            >
                                <i className={`fa-solid ${showLegacyClients ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                {showLegacyClients ? (t('ocultarLegacy') || 'Ocultar Legacy') : (t('verLegacy') || 'Ver Legacy')}
                            </button>
                        </div>
                        <div style={{display: 'flex', gap: '10px'}}>
                            <button className="btn-action" onClick={() => setShowNewPatientModal(true)} style={{padding: '14px 20px', fontSize: '1rem', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer'}}>
                                <i className="fa-solid fa-bolt" style={{marginRight: '8px', color: '#f59e0b'}}></i> {t('altaRapida') || 'Alta Rápida'}
                            </button>
                            <button className="btn-primary" onClick={() => abrirPerfilPaciente(null, 'formulario')} style={{padding: '14px 25px', fontSize: '1rem', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)', transition: 'all 0.3s'}}>
                                <i className="fa-solid fa-folder-plus" style={{marginRight: '8px'}}></i> {t('nuevoExpedienteIntegral') || 'Expediente Integral'}
                            </button>
                        </div>
                    </div>

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

                    <div className="panel" style={{padding: 0, borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)'}}>
                        <table className="data-table">
                            <thead style={{background: 'var(--bg-main)'}}>
                                <tr>
                                    <th>{t('expediente') || 'Expediente'}</th>
                                    <th>{t('nombreCompleto') || 'Nombre Completo'}</th>
                                    <th>{t('telefono') || 'Teléfono'}</th>
                                    <th>{t('sexo') || 'Sexo'} / {t('edad') || 'Edad'}</th>
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
                                    
                                    // 🚀 Lógica visual: Si tiene historia clínica, mostramos el Ojito
                                    const tieneHistoria = p.historia_clinica && p.historia_clinica.length > 0;

                                    let abandonoTratamiento = false; let diasInactivo = 0;
                                    if (p.ultima_asistencia) {
                                        diasInactivo = Math.floor((Date.now() - new Date(p.ultima_asistencia).getTime()) / (1000 * 60 * 60 * 24));
                                        if (diasInactivo > 60) abandonoTratamiento = true;
                                    }
                                    return (
                                        <tr key={p.id} className="animate-slide-up-row" style={{animationDelay: `${idx * 0.02}s`}}>
                                            <td style={{fontFamily: 'monospace', fontWeight: 'bold'}}>
                                                {p.codigo_expediente ? (
                                                    <span style={{background: isLegacy ? 'rgba(234, 88, 12, 0.1)' : 'rgba(2, 136, 209, 0.1)', color: isLegacy ? '#ea580c' : '#0288d1', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem'}}>
                                                        <i className="fa-solid fa-folder-open" style={{marginRight: '4px'}}></i> {p.codigo_expediente}
                                                    </span>
                                                ) : <span style={{color: 'var(--text-muted)'}}>{t('sinExpediente') || 'S/E'}</span>}
                                            </td>
                                            <td>
                                                <strong style={{color: 'var(--text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                    {p.nombre} {p.sabe_ingles && <span style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold'}}>🇺🇸 ENG</span>}
                                                </strong>
                                                <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{p.curp || (t('sinCurpAbrev') || 'Sin CURP')}</span>
                                            </td>
                                            <td style={{color: 'var(--text-main)'}}>{p.telefono || (t('sinTelefono') || 'Sin Teléfono')}</td>
                                            <td><span style={{color: 'var(--text-main)'}}>{t(p.sexo?.toLowerCase()) || p.sexo || '-'}</span> <br/><span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{edad} {t('anos') || 'años'}</span></td>
                                            <td style={{textAlign: 'center'}}>
                                                <span style={{fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', display: 'inline-block'}}>
                                                    {getNombreSucursal(p.sucursal_registro_id)}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
                                                    {abandonoTratamiento && <span style={{fontSize: '0.75rem', background: '#ea580c', color: 'white', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold'}} title={`${t('inactivoPor') || 'Inactivo por'} ${diasInactivo} ${t('dias') || 'días'}`}><i className="fa-solid fa-clock-rotate-left"></i> {t('abandonoTx') || 'Abandono de Tx'}</span>}
                                                    {alertasActivas.map(a => <span key={a.id} style={{fontSize: '0.75rem', background: a.nivel_gravedad === 'alta' ? 'var(--primary-red)' : '#eab308', color: 'white', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold'}}>{t(a.tipo_alerta.replace(/\s+/g, '').toLowerCase()) || a.tipo_alerta}</span>)}
                                                    {!abandonoTratamiento && alertasActivas.length === 0 && <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}><i className="fa-solid fa-check"></i> {t('alDia') || 'Al Día'}</span>}
                                                </div>
                                            </td>
                                            <td style={{textAlign: 'center'}}>
                                                <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                                                    {/* 🚀 BOTÓN DINÁMICO (OJO vs LÁPIZ) */}
                                                    {tieneHistoria ? (
                                                        <button className="btn-action" onClick={() => abrirPerfilPaciente(p, 'resumen')} style={{background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '8px 15px'}} title={t('verResumen') || 'Ver Resumen'}>
                                                            <i className="fa-solid fa-eye"></i>
                                                        </button>
                                                    ) : (
                                                        <button className="btn-action" onClick={() => abrirPerfilPaciente(p, 'formulario')} style={{background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '8px 15px'}} title={t('editar') || 'Editar'}>
                                                            <i className="fa-solid fa-pen"></i>
                                                        </button>
                                                    )}
                                                    <button className="btn-action" onClick={() => eliminarPaciente(p.id, p.nombre)} style={{background: 'transparent', border: '1px solid transparent', color: 'var(--primary-red)', padding: '8px 15px'}} title={t('eliminar') || 'Eliminar'}>
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

            {/* 🚀 VISTA 2: RESUMEN DE EXPEDIENTE (SOLO LECTURA) */}
            {vista === 'resumen' && (
                <div className="animate-fade-in" style={{display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px'}}>
                    
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)', padding: '25px 30px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                        <div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '5px'}}>
                                <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '2rem'}}>{nombres} {apellidos}</h2>
                                {pacienteEditando && (
                                    <span style={{background: 'rgba(2, 136, 209, 0.1)', color: '#0288d1', padding: '6px 12px', borderRadius: '8px', fontFamily: 'monospace', fontWeight: 'bold', border: '1px solid rgba(2, 136, 209, 0.3)'}}>
                                        <i className="fa-solid fa-folder-open"></i> {pacientes.find(p => p.id === pacienteEditando)?.codigo_expediente || 'S/E'}
                                    </span>
                                )}
                            </div>
                            <span style={{color: 'var(--text-muted)', fontSize: '1.1rem'}}><i className="fa-solid fa-person-half-dress" style={{color: 'var(--accent)', marginRight: '5px'}}></i> {sexo} • {fechaNac}</span>
                        </div>
                        <div style={{display: 'flex', gap: '15px'}}>
                            <button disabled={isProcessingBtn} className="btn-action" onClick={() => setVista('directorio')} style={{padding: '12px 20px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold', color: 'var(--text-main)', cursor: isProcessingBtn ? 'not-allowed' : 'pointer'}}>
                                <i className="fa-solid fa-arrow-left"></i> {t('atras') || 'Volver'}
                            </button>
                            <button disabled={isProcessingBtn} className="btn-primary" onClick={() => setVista('formulario')} style={{padding: '12px 25px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)', opacity: isProcessingBtn ? 0.7 : 1}}>
                                <i className="fa-solid fa-pen" style={{marginRight: '8px'}}></i> {t('editarExpediente') || 'Editar Expediente'}
                            </button>
                        </div>
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                        
                        {/* COLUMNA IZQUIERDA: Identidad, Contacto, Emergencia */}
                        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                            
                            {/* Alertas Rojas (Si existen) */}
                            {alertas.length > 0 && (
                                <div style={{background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--primary-red)', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)'}}>
                                    <h4 style={{color: 'var(--primary-red)', margin: '0 0 15px 0', display: 'flex', alignItems: 'center'}}><i className="fa-solid fa-triangle-exclamation" style={{fontSize: '1.4rem', marginRight: '10px'}}></i> {t('alertasRestrictivas') || 'Alertas Médicas'}</h4>
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                        {alertas.map((a, i) => (
                                            <div key={i} style={{background: 'var(--bg-panel)', padding: '10px 15px', borderRadius: '8px', borderLeft: '4px solid var(--primary-red)'}}>
                                                <strong style={{color: 'var(--text-main)', display: 'block'}}>{a.tipo_alerta}</strong>
                                                <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>{a.descripcion}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="panel" style={{padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)'}}>
                                <h4 style={{margin: '0 0 20px 0', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}><i className="fa-regular fa-address-book" style={{color: 'var(--accent)', marginRight: '8px'}}></i> {t('infoPersonal') || 'Información Personal'}</h4>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                                    <div><span className="summary-label">{t('telefono') || 'Teléfono'}</span><span className="summary-value">{telefono || '-'}</span></div>
                                    <div><span className="summary-label">{t('correo') || 'Correo'}</span><span className="summary-value">{correo || '-'}</span></div>
                                    <div><span className="summary-label">{t('curp') || 'CURP'}</span><span className="summary-value">{curp || motivoSinCurp || '-'}</span></div>
                                    <div><span className="summary-label">{t('estadoCivil') || 'Estado Civil'}</span><span className="summary-value">{estadoCivil || '-'}</span></div>
                                    <div><span className="summary-label">{t('ocupacion') || 'Ocupación'}</span><span className="summary-value">{ocupacion || '-'}</span></div>
                                    <div><span className="summary-label">{t('idioma') || 'Idioma'}</span><span className="summary-value">{idioma} {sabeIngles && '(+ Inglés)'}</span></div>
                                    <div style={{gridColumn: '1 / -1'}}><span className="summary-label">{t('domicilio') || 'Domicilio'}</span><span className="summary-value">{domicilio || '-'}</span></div>
                                </div>
                            </div>

                            <div className="panel" style={{padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)'}}>
                                <h4 style={{margin: '0 0 20px 0', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}><i className="fa-solid fa-truck-medical" style={{color: 'var(--accent)', marginRight: '8px'}}></i> {t('contactoEmergencia') || 'Emergencia y Legal'}</h4>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                                    <div><span className="summary-label">{t('nombreEmergencia') || 'Emergencia (Nombre)'}</span><span className="summary-value">{emergenciaNombre || '-'}</span></div>
                                    <div><span className="summary-label">{t('parentesco') || 'Parentesco'}</span><span className="summary-value">{emergenciaParentesco || '-'}</span></div>
                                    <div><span className="summary-label">{t('telefono') || 'Teléfono'}</span><span className="summary-value">{emergenciaTelefono || '-'}</span></div>
                                    <div><span className="summary-label">{t('responsableLegal') || 'Responsable Legal'}</span><span className="summary-value">{responsable || '-'}</span></div>
                                </div>
                            </div>
                            
                            {notaInterna && (
                                <div style={{ background: '#fef08a', padding: '25px', borderRadius: '16px', borderLeft: '6px solid #eab308', boxShadow: 'var(--shadow-sm)' }}>
                                    <h4 style={{ fontWeight: '900', margin: '0 0 10px 0', color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.5px' }}><i className="fa-solid fa-note-sticky"></i> {t('notaInterna') || 'Nota Interna (Staff)'}</h4>
                                    <p style={{margin: 0, color: '#713f12', fontSize: '0.95rem', lineHeight: '1.5'}}>{notaInterna}</p>
                                </div>
                            )}

                        </div>

                        {/* COLUMNA DERECHA: Historial Clínico Base y Consentimientos */}
                        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                            
                            <div className="panel" style={{padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)'}}>
                                <h4 style={{margin: '0 0 20px 0', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}><i className="fa-solid fa-clipboard-list" style={{color: 'var(--accent)', marginRight: '8px'}}></i> {t('historialMedicoBase') || 'Historial Médico Base'}</h4>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                    <div className="read-box"><span className="label">{t('motivoPadecimiento') || 'Motivo de Consulta y Padecimiento'}</span> {hForm.motivo_padecimiento || '-'}</div>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                                        <div className="read-box"><span className="label">{t('antecedentesPersonales') || 'A. Personales'}</span> {hForm.antecedentes_personales || '-'}</div>
                                        <div className="read-box"><span className="label">{t('antecedentesFamiliares') || 'A. Familiares'}</span> {hForm.antecedentes_familiares || '-'}</div>
                                        <div className="read-box"><span className="label">{t('medicamentosActuales') || 'Medicamentos'}</span> {hForm.medicamentos_actuales || '-'}</div>
                                        <div className="read-box"><span className="label">{t('habitosSustancias') || 'Hábitos/Sustancias'}</span> {hForm.habitos_sustancias || '-'}</div>
                                    </div>
                                    <div className="read-box"><span className="label">{t('habitosSueno') || 'Hábitos de Sueño'}</span> {hForm.habitos_sueno || '-'}</div>
                                    {sexo === 'Femenino' && (
                                        <div style={{background: 'rgba(236, 72, 153, 0.05)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(236, 72, 153, 0.2)'}}>
                                            <span className="label" style={{color: '#db2777'}}>{t('ginecoObstetricos') || 'Gineco-Obstétricos y Planificación'}</span> 
                                            {hForm.gineco_obstetricos || '-'} <br/> {hForm.planificacion_familiar || '-'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="panel" style={{padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)'}}>
                                <h4 style={{margin: '0 0 20px 0', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}><i className="fa-solid fa-file-signature" style={{color: 'var(--success)', marginRight: '8px'}}></i> {t('consentimientosFirmados') || 'Consentimientos Firmados'}</h4>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                    {consentimientosGuardados.length === 0 ? (
                                        <div style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontStyle: 'italic'}}>{t('noConsentimientos') || 'No hay consentimientos firmados.'}</div>
                                    ) : (
                                        consentimientosGuardados.map(c => (
                                            <div key={c.id} style={{background: 'var(--bg-main)', padding: '15px', borderRadius: '10px', borderLeft: '4px solid var(--success)', borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)'}}>
                                                <strong style={{color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', alignItems: 'center'}}><i className="fa-solid fa-check-circle" style={{color: 'var(--success)', marginRight: '8px'}}></i> Acupuntura Tradicional</strong>
                                                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)'}}>
                                                    <span>Testigos: {c.testigo_1_nombre}, {c.testigo_2_nombre}</span>
                                                    <span style={{fontFamily: 'monospace'}}>Hash: {c.firma_hash.substring(0,8)}...</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* 🚀 VISTA 3: WIZARD DE 4 PASOS PARA RECEPCIONISTAS */}
            {vista === 'formulario' && (
                <div className="wizard-container animate-slide-up">
                    <div className="wizard-header">
                        <div>
                            <h2 style={{margin: 0, color: 'var(--primary-red)', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '15px'}}>
                                <i className="fa-solid fa-address-card"></i> 
                                {pacienteEditando ? (t('edicionExpediente') || 'Edición de Expediente Integral') : (t('altaNuevoPaciente') || 'Alta de Nuevo Paciente')}
                            </h2>
                            <p style={{margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem'}}>{t('descWizard') || 'Completa la información en cada sección para armar el expediente base del doctor.'}</p>
                        </div>
                        {pacienteEditando && (
                            <div className="wizard-badge">
                                <i className="fa-solid fa-folder-open"></i> {t('expediente') || 'EXP'}: {pacientes.find(p => p.id === pacienteEditando)?.codigo_expediente || (t('sinExpediente') || 'S/E')}
                            </div>
                        )}
                    </div>

                    <div className="wizard-body">
                        {/* SIDEBAR DE NAVEGACIÓN DEL WIZARD */}
                        <div className="wizard-sidebar">
                            <button disabled={isProcessingBtn} className={`wizard-step ${formStep === 1 ? 'active' : (formStep > 1 ? 'completed' : '')}`} onClick={() => setFormStep(1)}>
                                <div className="step-icon"><i className="fa-solid fa-user"></i></div>
                                <div className="step-text">
                                    <span className="step-title">{t('paso1Titulo') || '1. Datos Generales'}</span>
                                    <span className="step-desc">{t('paso1Desc') || 'Identidad básica'}</span>
                                </div>
                                {formStep > 1 && <i className="fa-solid fa-check step-check"></i>}
                            </button>

                            <button disabled={isProcessingBtn} className={`wizard-step ${formStep === 2 ? 'active' : (formStep > 2 ? 'completed' : '')}`} onClick={() => setFormStep(2)}>
                                <div className="step-icon"><i className="fa-solid fa-house-chimney-medical"></i></div>
                                <div className="step-text">
                                    <span className="step-title">{t('paso2Titulo') || '2. Legal y Alertas'}</span>
                                    <span className="step-desc">{t('paso2Desc') || 'Privacidad y riesgos'}</span>
                                </div>
                                {formStep > 2 && <i className="fa-solid fa-check step-check"></i>}
                            </button>

                            <button disabled={isProcessingBtn} className={`wizard-step ${formStep === 3 ? 'active' : (formStep > 3 ? 'completed' : '')}`} onClick={() => setFormStep(3)}>
                                <div className="step-icon"><i className="fa-solid fa-clipboard-list"></i></div>
                                <div className="step-text">
                                    <span className="step-title">{t('paso3Titulo') || '3. Historial Médico'}</span>
                                    <span className="step-desc">{t('paso3Desc') || 'Anamnesis y hábitos'}</span>
                                </div>
                                {formStep > 3 && <i className="fa-solid fa-check step-check"></i>}
                            </button>

                            <button disabled={isProcessingBtn} className={`wizard-step ${formStep === 4 ? 'active' : ''}`} onClick={() => setFormStep(4)}>
                                <div className="step-icon"><i className="fa-solid fa-file-signature"></i></div>
                                <div className="step-text">
                                    <span className="step-title">{t('paso4Titulo') || '4. Consentimientos'}</span>
                                    <span className="step-desc">{t('paso4Desc') || 'Firma y testigos'}</span>
                                </div>
                            </button>
                        </div>

                        {/* CONTENIDO DEL FORMULARIO */}
                        <div className="wizard-content">
                            
                            {/* PASO 1: DATOS GENERALES */}
                            {formStep === 1 && (
                                <div className="step-pane animate-fade-in">
                                    <h3 className="pane-title"><i className="fa-solid fa-address-book" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('infoPersonal') || 'Información Personal'}</h3>
                                    
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '25px'}}>
                                        <div><label className="form-label">{t('nombres')} *</label><input disabled={isProcessingBtn} type="text" value={nombres} onChange={e => setNombres(formatUpperCase(e.target.value))} className="form-input" placeholder={t('phNombres') || "Ej. JOSE ADRIAN"} autoFocus/></div>
                                        <div><label className="form-label">{t('apellidos')} *</label><input disabled={isProcessingBtn} type="text" value={apellidos} onChange={e => setApellidos(formatUpperCase(e.target.value))} className="form-input" placeholder={t('phApellidos') || "Ej. ESTRADA URIBE"} /></div>
                                        
                                        <div><label className="form-label">{t('telefono')} *</label><input disabled={isProcessingBtn} type="text" value={telefono} onChange={e => setTelefono(e.target.value)} className="form-input" placeholder={t('phTelefono') || "10 dígitos"} /></div>
                                        <div><label className="form-label">{t('fechaNacimiento')} *</label><input disabled={isProcessingBtn} type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} className="form-input" /></div>
                                        
                                        <div>
                                            <label className="form-label">{t('sexo')} *</label>
                                            <select disabled={isProcessingBtn} value={sexo} onChange={e => setSexo(e.target.value)} className="form-input">
                                                <option value="">-- {t('seleccionar') || 'Seleccionar'} --</option>
                                                <option value="Femenino">{t('femenino') || 'Femenino'}</option>
                                                <option value="Masculino">{t('masculino') || 'Masculino'}</option>
                                                <option value="Otro">{t('otro') || 'Otro'}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">{t('estadoCivil')} *</label>
                                            <select disabled={isProcessingBtn} value={estadoCivil} onChange={e => setEstadoCivil(e.target.value)} className="form-input">
                                                <option value="">-- {t('seleccionar') || 'Seleccionar'} --</option>
                                                <option value="Soltero">{t('soltero') || 'Soltero'}</option>
                                                <option value="Casado">{t('casado') || 'Casado'}</option>
                                                <option value="Divorciado">{t('divorciado') || 'Divorciado'}</option>
                                                <option value="Viudo">{t('viudo') || 'Viudo'}</option>
                                                <option value="Unión Libre">{t('unionLibre') || 'Unión Libre'}</option>
                                                <option value="Otro">{t('otro') || 'Otro'}</option>
                                            </select>
                                        </div>
                                        
                                        <div><label className="form-label">{t('curp') || 'CURP'}</label><input disabled={isProcessingBtn} type="text" value={curp} onChange={e => setCurp(formatUpperCase(e.target.value))} className="form-input" maxLength="18" placeholder={t('phCurp') || "18 Caracteres alfanuméricos"} /></div>
                                        <div><label className="form-label">{t('sinCurp') || 'Sin CURP'} (Motivo)</label><input disabled={isProcessingBtn} type="text" value={motivoSinCurp} onChange={e => setMotivoSinCurp(formatUpperCase(e.target.value))} className="form-input" placeholder={t('phMotivoCurp') || "Ej. EXTRANJERO..."} disabled={curp.length > 0 || isProcessingBtn} style={{opacity: curp.length > 0 ? 0.5 : 1}} /></div>
                                        
                                        <div><label className="form-label">{t('ocupacion') || 'Ocupación'}</label><input disabled={isProcessingBtn} type="text" value={ocupacion} onChange={e => setOcupacion(formatUpperCase(e.target.value))} className="form-input" placeholder={t('phOcupacion') || "Ej. ESTUDIANTE..."} /></div>
                                        <div><label className="form-label">{t('correo') || 'Correo'}</label><input disabled={isProcessingBtn} type="email" value={correo} onChange={e => setCorreo(e.target.value.toLowerCase())} className="form-input" placeholder={t('phCorreo') || "correo@ejemplo.com"} /></div>
                                    </div>
                                    <div style={{width: '100%'}}>
                                        <label className="form-label">{t('domicilio') || 'Domicilio'}</label>
                                        <input disabled={isProcessingBtn} type="text" value={domicilio} onChange={e => setDomicilio(formatUpperCase(e.target.value))} className="form-input" placeholder={t('phDomicilio') || "Calle, Número, Colonia, Alcaldía/Municipio, CP..."} />
                                    </div>
                                </div>
                            )}

                            {/* PASO 2: LEGAL, ALERTAS Y CONTACTO */}
                            {formStep === 2 && (
                                <div className="step-pane animate-fade-in">
                                    <h3 className="pane-title"><i className="fa-solid fa-house-chimney-medical" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('contactoEmergencia') || 'Contacto de Emergencia, Legal y Alertas'}</h3>
                                    
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '25px'}}>
                                        <div><label className="form-label">{t('nombreEmergencia') || 'Emergencia (Nombre)'}</label><input disabled={isProcessingBtn} type="text" value={emergenciaNombre} onChange={e => setEmergenciaNombre(formatUpperCase(e.target.value))} className="form-input" placeholder={t('phEmergenciaNombre') || "Nombre completo"} /></div>
                                        <div><label className="form-label">{t('parentesco') || 'Parentesco'}</label><input disabled={isProcessingBtn} type="text" value={emergenciaParentesco} onChange={e => setEmergenciaParentesco(formatUpperCase(e.target.value))} className="form-input" placeholder={t('phParentesco') || "Ej. MADRE, ESPOSO..."} /></div>
                                        <div><label className="form-label">{t('telefono') || 'Teléfono'}</label><input disabled={isProcessingBtn} type="text" value={emergenciaTelefono} onChange={e => setEmergenciaTelefono(e.target.value)} className="form-input" placeholder={t('phTelefono') || "10 dígitos"} /></div>
                                    </div>
                                    
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px'}}>
                                        <div><label className="form-label">{t('responsableLegal') || 'Responsable Legal'}</label><input disabled={isProcessingBtn} type="text" value={responsable} onChange={e => setResponsable(formatUpperCase(e.target.value))} className="form-input" placeholder={t('phResponsable') || "Solo menores de edad o discapacitados"} /></div>
                                        <div style={{display: 'flex', alignItems: 'flex-end', gap: '15px'}}>
                                            <div style={{flex: 1}}><label className="form-label">{t('idioma') || 'Idioma'}</label><input disabled={isProcessingBtn} type="text" value={idioma} onChange={e => setIdioma(formatUpperCase(e.target.value))} className="form-input" /></div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', background: sabeIngles ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-main)', padding: '12px 15px', borderRadius: '10px', border: sabeIngles ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid var(--border-color)', height: '48px', transition: 'all 0.3s ease' }}>
                                                <input type="checkbox" disabled={isProcessingBtn} checked={sabeIngles} onChange={e => setSabeIngles(e.target.checked)} style={{width: '20px', height: '20px', accentColor: '#3b82f6'}} />
                                                <span style={{color: sabeIngles ? '#3b82f6' : 'var(--text-main)', fontWeight: 'bold', fontSize: '0.9rem'}}><i className="fa-solid fa-language"></i> {t('pacienteHablaIngles') || 'Habla Inglés'}</span>
                                            </label>
                                        </div>
                                    </div>

                                    <h3 className="pane-title" style={{color: 'var(--primary-red)', borderTop: '1px dashed var(--border-color)', paddingTop: '25px'}}><i className="fa-solid fa-triangle-exclamation"></i> {t('alertasRestrictivas') || 'Alertas Clínicas Restrictivas'}</h3>
                                    <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px'}}>{t('descAlertas') || 'Agrega alertas si el paciente tiene condiciones críticas (Alergias severas, Marcapasos, Embarazo).'}</p>
                                    
                                    <div style={{background: 'var(--bg-main)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px', display: 'flex', gap: '15px'}}>
                                        <select disabled={isProcessingBtn} value={nuevaAlertaTipo} onChange={e => setNewAlertaTipo(e.target.value)} className="form-input" style={{flex: 1}}>
                                            <option value="">{t('seleccionarAlerta') || '-- Seleccionar Alerta --'}</option>
                                            <option value="Alergia">{t('alergia') || 'Alergia'}</option>
                                            <option value="Marcapasos">{t('marcapasos') || 'Marcapasos'}</option>
                                            <option value="Anticoagulantes">{t('anticoagulantes') || 'Anticoagulantes'}</option>
                                            <option value="Embarazo">{t('embarazo') || 'Embarazo'}</option>
                                            <option value="Enfermedad Transmisible">{t('enfermedadTransmisible') || 'Enfermedad Transmisible'}</option>
                                            <option value="Riesgo Urgencia">{t('riesgoUrgencia') || 'Riesgo de Urgencia'}</option>
                                        </select>
                                        <input disabled={isProcessingBtn} type="text" value={nuevaAlertaDesc} onChange={e => setNewAlertaDesc(e.target.value)} className="form-input" placeholder={t('phEspecificarDetalle') || "Especificar detalle..."} style={{flex: 2}} />
                                        <button disabled={isProcessingBtn} className="btn-primary" onClick={agregarAlerta} style={{padding: '0 20px', borderRadius: '8px', border: 'none', background: 'var(--primary-red)', color: 'white', fontWeight: 'bold', cursor: isProcessingBtn ? 'not-allowed' : 'pointer'}}><i className="fa-solid fa-plus"></i></button>
                                    </div>

                                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '35px'}}>
                                        {alertas.map((a, i) => (
                                            <div key={i} style={{background: 'var(--bg-panel)', padding: '15px', borderRadius: '10px', borderLeft: `4px solid ${a.nivel_gravedad === 'alta' ? 'var(--primary-red)' : '#ea580c'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                                                <div>
                                                    <strong style={{fontSize: '0.9rem', color: 'var(--text-main)'}}>{a.tipo_alerta}</strong>
                                                    <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px'}}>{a.descripcion}</div>
                                                </div>
                                                <button disabled={isProcessingBtn} onClick={() => quitarAlertaTemporal(i)} style={{background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'}} onMouseEnter={e => {e.currentTarget.style.color = 'var(--primary-red)'; e.currentTarget.style.borderColor = 'var(--primary-red)';}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)';}}>
                                                    <i className="fa-solid fa-xmark"></i>
                                                </button>
                                            </div>
                                        ))}
                                        {alertas.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '10px'}}>{t('sinAlertas') || 'Sin alertas registradas.'}</div>}
                                    </div>

                                    <div style={{ background: '#fef08a', padding: '25px', borderRadius: '12px', borderLeft: '6px solid #eab308', marginBottom: '25px' }}>
                                        <label style={{ fontWeight: '900', display: 'block', marginBottom: '10px', color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <i className="fa-solid fa-note-sticky"></i> {t('notaInterna') || 'Nota Interna (Staff)'}
                                        </label>
                                        <p style={{fontSize: '0.8rem', color: '#a16207', marginBottom: '15px'}}>{t('notaInternaDesc') || 'Comentarios privados exclusivos para staff médico y recepción.'}</p>
                                        <textarea disabled={isProcessingBtn} value={notaInterna} onChange={e => setNotaInterna(e.target.value)} rows="3" style={{ width: '100%', background: 'rgba(255, 255, 255, 0.5)', border: '1px dashed #ca8a04', outline: 'none', color: '#713f12', padding: '15px', borderRadius: '8px', resize: 'vertical', fontSize: '0.95rem' }} placeholder={t('phNotaInterna') || "Ej. Cliente conflictivo..."} />
                                    </div>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', background: avisoPrivacidad ? 'rgba(22, 163, 74, 0.05)' : 'rgba(220, 38, 38, 0.05)', padding: '20px', borderRadius: '12px', border: avisoPrivacidad ? '1px solid var(--success)' : '1px dashed var(--primary-red)' }}>
                                        <input type="checkbox" disabled={isProcessingBtn} checked={avisoPrivacidad} onChange={e => setAvisoPrivacidad(e.target.checked)} style={{width: '24px', height: '24px', accentColor: 'var(--success)'}} />
                                        <div style={{display: 'flex', flexDirection: 'column'}}>
                                            <span style={{color: avisoPrivacidad ? 'var(--success)' : 'var(--primary-red)', fontWeight: 'bold', fontSize: '1.05rem'}}>
                                                {t('avisoPrivacidad') || 'Aviso de Privacidad'} * {avisoPrivacidad && <i className="fa-solid fa-check" style={{marginLeft: '10px'}}></i>}
                                            </span>
                                            <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px'}}>{t('avisoPrivacidadDesc') || 'Es obligatorio que el paciente haya leído y aceptado el aviso de privacidad antes de guardar.'}</span>
                                        </div>
                                    </label>
                                </div>
                            )}

                            {/* 🚀 PASO 3: HISTORIAL MÉDICO BASE (Anamnesis y Antecedentes) */}
                            {formStep === 3 && (
                                <div className="step-pane animate-fade-in">
                                    <h3 className="pane-title"><i className="fa-solid fa-clipboard-list" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('historialMedicoBase') || 'Historial Médico Base (Borrador)'}</h3>
                                    
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '25px'}}>
                                        <div>
                                            <label className="form-label">{t('motivoPadecimiento') || 'Motivo de Consulta y Padecimiento'}</label>
                                            <textarea disabled={isProcessingBtn} value={hForm.motivo_padecimiento} onChange={(e) => setHForm({...hForm, motivo_padecimiento: e.target.value})} className="form-input" rows="5" placeholder={t('phMotivoConsulta') || 'Razón de la visita, síntomas y duración...'}></textarea>
                                        </div>
                                    </div>

                                    <h4 style={{color: 'var(--accent)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginTop: '35px', fontSize: '1.2rem'}}><i className="fa-solid fa-clock-rotate-left"></i> {t('antecedentes') || 'Antecedentes'}</h4>
                                    
                                    <div style={{background: 'var(--bg-main)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '25px'}}>
                                        <label className="form-label">{t('antecedentesPersonales') || 'Antecedentes Personales'}</label>
                                        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px'}}>
                                            {antecedentesList.map(enf => (
                                                <button disabled={isProcessingBtn} key={enf} onClick={() => agregarTextoRapido('antecedentes_personales', t(enf) || enf)} className="smart-chip"><i className="fa-solid fa-plus"></i> {t(enf) || enf}</button>
                                            ))}
                                        </div>
                                        <textarea disabled={isProcessingBtn} value={hForm.antecedentes_personales} onChange={(e) => setHForm({...hForm, antecedentes_personales: e.target.value})} className="form-input" rows="3" placeholder={t('phPersonales') || 'Enfermedades crónicas...'}></textarea>
                                    </div>

                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px'}}>
                                        <div><label className="form-label">{t('antecedentesFamiliares') || 'Antecedentes Familiares'}</label><textarea disabled={isProcessingBtn} value={hForm.antecedentes_familiares} onChange={(e) => setHForm({...hForm, antecedentes_familiares: e.target.value})} className="form-input" rows="2" placeholder={t('phFamiliares') || 'Enfermedades hereditarias...'}></textarea></div>
                                        <div><label className="form-label">{t('medicamentosActuales') || 'Medicamentos Actuales'}</label><textarea disabled={isProcessingBtn} value={hForm.medicamentos_actuales} onChange={(e) => setHForm({...hForm, medicamentos_actuales: e.target.value})} className="form-input" rows="2" placeholder={t('phMedicamentos') || 'Fármacos actuales...'}></textarea></div>
                                        <div><label className="form-label">{t('habitosSustancias') || 'Hábitos (Sustancias)'}</label><textarea disabled={isProcessingBtn} value={hForm.habitos_sustancias} onChange={(e) => setHForm({...hForm, habitos_sustancias: e.target.value})} className="form-input" rows="2" placeholder={t('phHabitos') || 'Alcohol, tabaco, drogas...'}></textarea></div>
                                        <div><label className="form-label">{t('habitosSueno') || 'Hábitos de Sueño'}</label><textarea disabled={isProcessingBtn} value={hForm.habitos_sueno} onChange={(e) => setHForm({...hForm, habitos_sueno: e.target.value})} className="form-input" rows="2" placeholder={t('phSueno') || 'Horas de sueño, calidad...'}></textarea></div>
                                    </div>

                                    {sexo === 'Femenino' && (
                                        <div style={{background: 'rgba(236, 72, 153, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.2)'}}>
                                            <h4 style={{color: '#db2777', margin: '0 0 15px 0', fontSize: '1rem'}}><i className="fa-solid fa-venus"></i> {t('ginecoObstetricos') || 'Gineco-Obstétricos'}</h4>
                                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                                                <textarea disabled={isProcessingBtn} value={hForm.gineco_obstetricos} onChange={(e) => setHForm({...hForm, gineco_obstetricos: e.target.value})} className="form-input" rows="2" placeholder={t('phGineco') || 'Menstruación, embarazos...'}></textarea>
                                                <textarea disabled={isProcessingBtn} value={hForm.planificacion_familiar} onChange={(e) => setHForm({...hForm, planificacion_familiar: e.target.value})} className="form-input" rows="2" placeholder={t('phPlanificacion') || 'Métodos anticonceptivos...'}></textarea>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 🚀 PASO 4: CONSENTIMIENTOS INFORMADOS */}
                            {formStep === 4 && (
                                <div className="step-pane animate-fade-in">
                                    <h3 className="pane-title"><i className="fa-solid fa-file-signature" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('consentimientosLegales') || 'Consentimientos Legales'}</h3>
                                    
                                    <div style={{background: 'var(--bg-main)', padding: '35px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                                        <div style={{background: 'var(--bg-panel)', padding: '25px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '30px'}}>
                                            <h4 style={{margin: '0 0 15px 0', color: 'var(--text-main)'}}>{t('terminosAcupuntura') || 'Acupuntura Tradicional - Términos y Condiciones'}</h4>
                                            <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6'}}>{t('textoLegalAcupuntura') || 'Declaro que se me ha explicado de manera clara y comprensible la naturaleza, propósitos, riesgos y alternativas del tratamiento de acupuntura tradicional, y otorgo mi consentimiento libre y voluntario para someterse al mismo.'}</p>
                                        </div>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px'}}>
                                            <div><label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('testigo1') || 'Testigo 1'}</label><input disabled={isProcessingBtn} type="text" value={cForm.testigo_1} onChange={e => setCForm({...cForm, testigo_1: formatUpperCase(e.target.value)})} style={{width: '100%', padding: '15px', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', textTransform: 'uppercase'}} placeholder={t('phTestigo1') || "Familiar o Acompañante"} /></div>
                                            <div><label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('testigo2') || 'Testigo 2'}</label><input disabled={isProcessingBtn} type="text" value={cForm.testigo_2} onChange={e => setCForm({...cForm, testigo_2: formatUpperCase(e.target.value)})} style={{width: '100%', padding: '15px', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', textTransform: 'uppercase'}} placeholder={t('phTestigo2') || "Familiar, Acompañante o Staff"} /></div>
                                        </div>
                                        <label style={{display: 'flex', alignItems: 'center', gap: '15px', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', background: 'rgba(22, 163, 74, 0.05)', padding: '20px', borderRadius: '10px', border: '1px dashed var(--success)'}}>
                                            <input type="checkbox" disabled={isProcessingBtn} checked={cForm.acepta} onChange={e => setCForm({...cForm, acepta: e.target.checked})} style={{width: '24px', height: '24px', accentColor: 'var(--success)'}} />
                                            <span style={{color: 'var(--text-main)', fontWeight: 'bold', fontSize: '1.05rem'}}>{t('pacienteAcepta') || 'El paciente acepta los términos y firma el consentimiento.'}</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                    
                    {/* CONTROLES (FOOTER WIZARD) */}
                    <div className="wizard-footer">
                        <button className="btn-action" disabled={isProcessingBtn} onClick={() => setVista('directorio')} style={{padding: '14px 25px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold', cursor: isProcessingBtn ? 'not-allowed' : 'pointer'}}>
                            {t('cancelar') || 'Cancelar y Salir'}
                        </button>
                        
                        <div style={{display: 'flex', gap: '15px'}}>
                            <button 
                                className="btn-action" 
                                onClick={() => setFormStep(prev => prev - 1)} 
                                disabled={formStep === 1 || isProcessingBtn}
                                style={{padding: '14px 25px', background: 'transparent', color: formStep === 1 ? 'transparent' : 'var(--text-main)', border: 'none', fontWeight: 'bold', cursor: (formStep === 1 || isProcessingBtn) ? 'default' : 'pointer'}}
                            >
                                <i className="fa-solid fa-arrow-left"></i> {t('atras') || 'Atrás'}
                            </button>
                            
                            {formStep < 4 ? (
                                <button className="btn-primary" disabled={isProcessingBtn} onClick={() => setFormStep(prev => prev + 1)} style={{padding: '14px 30px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)', opacity: isProcessingBtn ? 0.7 : 1}}>
                                    {t('siguientePaso') || 'Siguiente Paso'} <i className="fa-solid fa-arrow-right" style={{marginLeft: '8px'}}></i>
                                </button>
                            ) : (
                                <button className="btn-primary" disabled={isProcessingBtn} onClick={guardarExpediente} style={{padding: '14px 35px', background: 'var(--success)', border: 'none', borderRadius: '10px', fontWeight: '900', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(22, 163, 74, 0.4)', opacity: isProcessingBtn ? 0.7 : 1}}>
                                    {isProcessingBtn ? <><i className="fa-solid fa-spinner fa-spin"></i> Procesando...</> : <><i className="fa-solid fa-floppy-disk" style={{marginRight: '8px'}}></i> {t('finalizarGuardar') || 'Finalizar y Guardar'}</>}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODALES RÁPIDOS */}
            {showNewPatientModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box animate-scale-in" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '500px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '10px', color: 'var(--text-main)', fontSize: '1.5rem'}}><i className="fa-solid fa-user-plus" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('altaRapida') || 'Alta Rápida'}</h3>
                        <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '30px'}}>{t('camposMinimosRequeridos') || 'Campos mínimos requeridos para abrir expediente'}</p>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '35px'}}>
                            <div><label className="form-label">{t('nombres') || 'Nombres'}</label><input disabled={isProcessingBtn} type="text" value={npNombres} onChange={e => setNpNombres(formatUpperCase(e.target.value))} className="form-input" style={{textTransform: 'uppercase'}} autoFocus /></div>
                            <div><label className="form-label">{t('apellidos') || 'Apellidos'}</label><input disabled={isProcessingBtn} type="text" value={npApellidos} onChange={e => setApellidos(formatUpperCase(e.target.value))} className="form-input" style={{textTransform: 'uppercase'}} /></div>
                            <div><label className="form-label">{t('telefono') || 'Teléfono'}</label><input disabled={isProcessingBtn} type="text" value={npTelefono} onChange={e => setNpTelefono(e.target.value)} className="form-input" /></div>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                                <div><label className="form-label">{t('fechaNac') || 'Fecha de Nac.'}</label><input disabled={isProcessingBtn} type="date" value={npFechaNacimiento} onChange={e => setNpFechaNacimiento(e.target.value)} className="form-input" /></div>
                                <div>
                                    <label className="form-label">{t('sexo') || 'Sexo'}</label>
                                    <select disabled={isProcessingBtn} value={npSexo} onChange={e => setNpSexo(e.target.value)} className="form-input">
                                        <option value="">{t('seleccionar') || 'Seleccionar'}</option>
                                        <option value="Femenino">{t('femenino') || 'Femenino'}</option>
                                        <option value="Masculino">{t('masculino') || 'Masculino'}</option>
                                        <option value="Otro">{t('otro') || 'Otro'}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{display: 'flex', gap: '15px'}}>
                            <button disabled={isProcessingBtn} className="btn-action" onClick={() => setShowNewPatientModal(false)} style={{flex: 1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold', borderRadius: '8px', cursor: isProcessingBtn ? 'not-allowed' : 'pointer'}}>{t('cancelar') || 'Cancelar y Salir'}</button>
                            <button disabled={isProcessingBtn} className="btn-primary" onClick={guardarPacienteRapido} style={{flex: 1, padding: '16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', opacity: isProcessingBtn ? 0.7 : 1}}>
                                {isProcessingBtn ? <><i className="fa-solid fa-spinner fa-spin"></i></> : <><i className="fa-solid fa-save"></i> {t('crearExpediente') || 'Crear Expediente'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .summary-label { font-weight: bold; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; display: block; margin-bottom: 2px;}
                .summary-value { font-size: 1.05rem; color: var(--text-main); font-weight: 500;}
                .read-box { border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; background: var(--bg-main); font-size: 1rem; color: var(--text-main); line-height: 1.5; }
                .read-box .label { font-weight: bold; font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 5px; text-transform: uppercase; }

                .form-label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                .form-input { width: 100%; padding: 14px; background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 10px; font-size: 1rem; transition: all 0.3s ease; }
                .form-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15); }
                .form-input:disabled { opacity: 0.6; cursor: not-allowed; }
                .smart-chip { background: var(--bg-panel); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 20px; font-size: 0.9rem; cursor: pointer; transition: 0.2s; }
                .smart-chip:hover { background: var(--accent); color: white; border-color: var(--accent); }
                
                .animate-slide-up-row { opacity: 0; animation: slideUpRow 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                .animate-slide-up { opacity: 0; animation: slideUpRow 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes slideUpRow { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                /* 🚀 CSS DEL WIZARD PREMIUM */
                .wizard-container { display: flex; flex-direction: column; background: var(--bg-panel); border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); border: 1px solid var(--border-color); overflow: hidden; min-height: 75vh; }
                .wizard-header { padding: 30px; background: var(--bg-main); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
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