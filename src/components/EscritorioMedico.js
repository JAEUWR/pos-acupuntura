'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function EscritorioMedico({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage();
    
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    const formatDate = (dateString) => {
        if (!isMounted || !dateString) return '';
        return new Date(dateString).toLocaleString();
    };

    const formatDateOnly = (dateString) => {
        if (!isMounted || !dateString) return '';
        return new Date(dateString).toLocaleDateString();
    };

    const [pacientes, setPacientes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
    const [tabActiva, setTabActiva] = useState('historia'); // 'historia' | 'evolucion' | 'consentimientos'
    
    // 🚀 NUEVOS ESTADOS DE VISTA (Directorios y Legacy)
    const [activeSucursalTab, setActiveSucursalTab] = useState('todas');
    const [showLegacyClients, setShowLegacyClients] = useState(false);
    const [sucursalesDB, setSucursalesDB] = useState([]);

    // ESTADOS: Alta Rápida de Paciente (ESTRICTA)
    const [showNewPatientModal, setShowNewPatientModal] = useState(false);
    const [npNombres, setNpNombres] = useState('');
    const [npApellidos, setNpApellidos] = useState('');
    const [npTelefono, setNpTelefono] = useState('');
    const [npFechaNacimiento, setNpFechaNacimiento] = useState('');
    const [npSexo, setNpSexo] = useState('');

    // ESTADOS: Hoja de Referencia Médica
    const [showReferenciaModal, setShowReferenciaModal] = useState(false);
    const [rForm, setRForm] = useState({ receptor: '', motivo: '', diagnostico: '' });

    // ESTADOS: Historia Clínica
    const [historia, setHistoria] = useState(null);
    const [hForm, setHForm] = useState({
        motivo_consulta: '', padecimiento_actual: '', antecedentes_familiares: '', antecedentes_personales: '',
        antecedentes_renales_psicologicos: '', habitos_sustancias: '', habitos_sueno: '', medicamentos_actuales: '', 
        gineco_obstetricos: '', planificacion_familiar: '', esfera_mental: '', interrogatorio_sistemas: '',
        exploracion_fisica: '', diagnostico_cie: '', valoracion_mtc: '', mtc_pulso_lengua: '', mtc_rostro_ojos: '', 
        mtc_colores_sabores_sonidos: '', pronostico: '', plan_tratamiento: ''
    });

    // ESTADOS: Notas de Evolución
    const [notas, setNotas] = useState([]);
    const [notaActiva, setNotaActiva] = useState(null);
    const [nForm, setNForm] = useState({ 
        evolucion: '', evaluacion_signos: '', procedimiento_tecnica: '', material_agujas: '', 
        resultado_tolerancia: '', plan_indicaciones: '',
        puntos_acupuntura: '', tiempo_retencion_minutos: '', diagnostico_sesion: '', sesiones_requeridas: '' 
    });
    
    // ESTADOS: Adendas y Consentimientos
    const [adendasActivas, setAdendasActivas] = useState([]);
    const [nuevaAdenda, setNuevaAdenda] = useState('');
    const [consentimientos, setConsentimientos] = useState([]);
    const [vistaConsentimiento, setVistaConsentimiento] = useState('lista');
    const [cForm, setCForm] = useState({ testigo_1: '', testigo_2: '', acepta: false });

    // 🚀 Lógica robusta de sucursal
    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[(branch || '').toLowerCase()] || 1;

    const fetchPacientesYSucursales = async () => {
        const { data: sucursales } = await supabase.from('sucursales').select('id, nombre').order('id');
        if (sucursales) setSucursalesDB(sucursales);

        const { data } = await supabase.from('clientes').select('*, alertas_clinicas(id, tipo_alerta, descripcion, nivel_gravedad, activa)').order('nombre', { ascending: true });
        if (data) setPacientes(data);
    };

    useEffect(() => {
        fetchPacientesYSucursales();
    }, []);

    useEffect(() => {
        if (!pacienteSeleccionado) return;
        
        const fetchExpediente = async () => {
            const { data: hData } = await supabase.from('historia_clinica').select('*').eq('paciente_id', pacienteSeleccionado.id).single();
            if (hData) { setHistoria(hData); setHForm(hData); } 
            else { 
                setHistoria(null); 
                setHForm({ motivo_consulta: '', padecimiento_actual: '', antecedentes_familiares: '', antecedentes_personales: '', antecedentes_renales_psicologicos: '', habitos_sustancias: '', habitos_sueno: '', medicamentos_actuales: '', gineco_obstetricos: '', planificacion_familiar: '', esfera_mental: '', interrogatorio_sistemas: '', exploracion_fisica: '', diagnostico_cie: '', valoracion_mtc: '', mtc_pulso_lengua: '', mtc_rostro_ojos: '', mtc_colores_sabores_sonidos: '', pronostico: '', plan_tratamiento: '' }); 
            }

            const { data: nData } = await supabase.from('notas_evolucion').select('*').eq('paciente_id', pacienteSeleccionado.id).order('fecha_registro', { ascending: false });
            if (nData) { setNotas(nData); setNotaActiva(null); }

            const { data: cData } = await supabase.from('consentimientos_informados').select('*').eq('paciente_id', pacienteSeleccionado.id).order('fecha_firma', { ascending: false });
            if (cData) { setConsentimientos(cData); setVistaConsentimiento('lista'); }
        };
        fetchExpediente();
    }, [pacienteSeleccionado]);

    const formatUpperCase = (str) => {
        if (!str) return '';
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    const guardarHistoria = async (firmar = false) => {
        if (firmar && (!hForm.motivo_consulta || !hForm.diagnostico_cie || !hForm.plan_tratamiento)) return alert(t('alertaFaltanCamposHistoria') || 'Para firmar, debes llenar al menos el Motivo, Diagnóstico y Plan.');
        if (firmar && !window.confirm(t('confirmarFirmaHistoria') || '¿Estás seguro de firmar? El documento quedará bloqueado e inalterable por ley.')) return;

        const payload = {
            paciente_id: pacienteSeleccionado.id, medico_nombre: perfilActual?.nombre || 'Médico', ...hForm,
            estado: firmar ? 'firmada' : 'borrador', fecha_firma: firmar ? new Date().toISOString() : null, firma_hash: firmar ? Math.random().toString(36).substring(2, 15) + Date.now().toString(36) : null
        };

        if (historia?.id) { await supabase.from('historia_clinica').update(payload).eq('id', historia.id); } 
        else { const { data } = await supabase.from('historia_clinica').insert([payload]).select(); setHistoria(data[0]); }
        
        alert(firmar ? t('documentoFirmado') : (t('borradorGuardado') || 'Borrador Guardado'));
        if (firmar) setHistoria({ ...historia, ...payload });
    };

    const abrirNota = async (nota) => {
        setNotaActiva(nota.id);
        setNForm(nota);
        setNuevaAdenda('');
        
        if (nota.estado === 'firmada') {
            const { data } = await supabase.from('adendas').select('*').eq('nota_id', nota.id).order('fecha_registro', { ascending: true });
            if (data) setAdendasActivas(data);
        } else {
            setAdendasActivas([]);
        }
    };

    const crearNuevaNota = () => { 
        setNotaActiva('nueva'); 
        setNForm({ evolucion: '', evaluacion_signos: '', procedimiento_tecnica: '', material_agujas: '', resultado_tolerancia: '', plan_indicaciones: '', puntos_acupuntura: '', tiempo_retencion_minutos: '', diagnostico_sesion: '', sesiones_requeridas: '' }); 
    };

    const guardarNota = async (firmar = false) => {
        if (firmar) {
            if (!nForm.evolucion && !nForm.procedimiento_tecnica && !nForm.diagnostico_sesion) {
                return alert(t('normaFirmaNota') || 'Por norma, no puedes firmar con campos vacíos. Describe la evolución, el procedimiento o el diagnóstico de la sesión.');
            }
            if (!window.confirm(t('confirmarFirmaNota') || '¿Estás seguro de firmar esta nota? No podrá ser borrada ni alterada.')) return;
        }

        const payload = {
            paciente_id: pacienteSeleccionado.id, sucursal_id: sucursalId, medico_nombre: perfilActual?.nombre || 'Médico', ...nForm,
            estado: firmar ? 'firmada' : 'borrador', fecha_firma: firmar ? new Date().toISOString() : null, firma_hash: firmar ? Math.random().toString(36).substring(2, 15) + Date.now().toString(36) : null
        };

        if (notaActiva !== 'nueva') { await supabase.from('notas_evolucion').update(payload).eq('id', notaActiva); } 
        else { await supabase.from('notas_evolucion').insert([payload]); }
        
        alert(firmar ? t('documentoFirmado') : (t('borradorGuardado') || 'Borrador Guardado'));
        const { data } = await supabase.from('notas_evolucion').select('*').eq('paciente_id', pacienteSeleccionado.id).order('fecha_registro', { ascending: false });
        if (data) { setNotas(data); setNotaActiva(null); }
    };

    const generarPDFDiagnostico = () => {
        if (!nForm.diagnostico_sesion) return alert(t('alertaSinDiagnostico') || 'No hay un diagnóstico de sesión escrito para imprimir.');
        
        const printWindow = window.open('', '_blank');
        let htmlContent = `
            <html><head><title>Diagnóstico - ${pacienteSeleccionado.codigo_expediente || 'S/E'}</title>
            <style>
                body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #000; line-height: 1.5; font-size: 14px; background: white; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
                h1 { margin: 0; font-size: 20px; text-transform: uppercase; color: #b71c1c; }
                .box { border: 1px solid #ccc; padding: 20px; border-radius: 8px; margin-bottom: 20px; background: #fafafa; }
                .label { font-weight: bold; font-size: 12px; display: block; margin-bottom: 5px; color: #555; text-transform: uppercase; }
                .dato { font-size: 16px; margin-bottom: 15px; }
                .firma-box { margin-top: 60px; text-align: center; width: 250px; float: right; border-top: 1px solid #000; padding-top: 10px; }
            </style></head><body>
                <div class="header">
                    <h1>ACUPUNTURA CHINA TRADICIONAL H.K.</h1>
                    <p style="margin:5px 0;">Dictamen de Evaluación y Seguimiento</p>
                </div>
                
                <table style="width:100%; margin-bottom: 30px; font-size: 14px;">
                    <tr>
                        <td><strong>Paciente:</strong> ${pacienteSeleccionado.nombre}</td>
                        <td style="text-align: right;"><strong>Fecha:</strong> ${formatDateOnly(nForm.fecha_registro || new Date())}</td>
                    </tr>
                    <tr>
                        <td><strong>Expediente:</strong> ${pacienteSeleccionado.codigo_expediente || 'S/E'}</td>
                        <td style="text-align: right;"><strong>Terapeuta:</strong> ${nForm.medico_nombre || perfilActual?.nombre}</td>
                    </tr>
                </table>

                <div class="box">
                    <span class="label">Diagnóstico / Evaluación Clínica:</span> 
                    <div class="dato" style="white-space: pre-wrap;">${nForm.diagnostico_sesion}</div>
                    
                    <span class="label">Pronóstico y Tratamiento Sugerido:</span> 
                    <div class="dato" style="white-space: pre-wrap;">Se recomiendan <b>${nForm.sesiones_requeridas || '____'}</b> sesiones de seguimiento para observar evolución.</div>
                    
                    ${nForm.plan_indicaciones ? `<span class="label">Indicaciones para Casa:</span><div class="dato" style="white-space: pre-wrap;">${nForm.plan_indicaciones}</div>` : ''}
                </div>

                <div class="firma-box">
                    <strong>${nForm.medico_nombre || perfilActual?.nombre}</strong><br/>Firma del Terapeuta
                </div>
            </body></html>`;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 800);
    };

    // 🚀 LÓGICA DE ALTA RÁPIDA ESTANDARIZADA
    const guardarPacienteRapido = async () => {
        if (!npNombres || !npApellidos || !npTelefono || !npFechaNacimiento || !npSexo) {
            return alert(t('alertaCamposMinimos') || 'Nombres, Apellidos, Teléfono, Fecha de Nacimiento y Sexo son obligatorios.');
        }

        const nombresNorm = npNombres.trim();
        const apellidosNorm = npApellidos.trim();
        const fullName = `${nombresNorm} ${apellidosNorm}`;

        // Verificamos si existe por nombre exacto o teléfono
        const duplicado = pacientes.find(p => (p.telefono === npTelefono) || (p.nombres === nombresNorm && p.apellidos === apellidosNorm));
        if (duplicado) {
            return alert(`🚨 ERROR: El paciente "${fullName}" ya existe o el teléfono está registrado en el expediente de ${duplicado.nombre}.`);
        }

        const payload = {
            nombre: fullName,
            nombres: nombresNorm,
            apellidos: apellidosNorm,
            telefono: npTelefono.trim(),
            fecha_nacimiento: npFechaNacimiento,
            sexo: npSexo,
            sucursal_registro_id: sucursalId
        };

        const { data, error } = await supabase.from('clientes').insert([payload]).select();
        if (error) return alert((t('errorRegistrar') || 'Error al registrar: ') + error.message);

        const newId = data[0].id;
        const yearMonth = new Date().getFullYear().toString().slice(-2) + (new Date().getMonth() + 1).toString().padStart(2, '0');
        const branchLetter = (branch || 'Napoles').charAt(0).toUpperCase();
        const expCode = `HK-${branchLetter}-${yearMonth}-${newId.toString().padStart(4, '0')}`;
        
        await supabase.from('clientes').update({ codigo_expediente: expCode }).eq('id', newId);

        const nuevoPaciente = { ...data[0], codigo_expediente: expCode, alertas_clinicas: [] };
        
        setPacientes(prev => [...prev, nuevoPaciente].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setPacienteSeleccionado(nuevoPaciente);
        setShowNewPatientModal(false);
        setNpNombres(''); setNpApellidos(''); setNpTelefono(''); setNpFechaNacimiento(''); setNpSexo('');
        alert(t('expedienteCreadoExito') || 'Expediente creado exitosamente.');
    };

    const firmarAdenda = async () => {
        if (nuevaAdenda.trim().length < 10) return alert(t('alertaAdendaCorta') || 'La adenda debe ser clara y justificada.');
        if (!window.confirm(t('confirmarFirmaAdenda') || '¿Firmar y anexar esta adenda al expediente?')) return;

        const payload = {
            nota_id: notaActiva, medico_nombre: perfilActual?.nombre || 'Médico', texto_adenda: nuevaAdenda.trim(),
            firma_hash: Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
        };

        const { data, error } = await supabase.from('adendas').insert([payload]).select();
        if (error) return alert(error.message);

        setAdendasActivas([...adendasActivas, data[0]]);
        setNuevaAdenda('');
        alert(t('adendaFirmadaExito') || 'Adenda firmada y anexada exitosamente.');
    };

    const generarConsentimiento = async () => {
        if (!cForm.testigo_1 || !cForm.testigo_2) return alert(t('alertaTestigos') || 'Se requieren los nombres de dos testigos legales.');
        if (!cForm.acepta) return alert(t('alertaAceptarTerminos') || 'El paciente debe aceptar los términos marcando la casilla.');
        if (!window.confirm(t('confirmarConsentimientoLegal') || 'Al firmar, el consentimiento será registrado legalmente a nombre del paciente y testigos.')) return;

        const payload = {
            paciente_id: pacienteSeleccionado.id, medico_nombre: perfilActual?.nombre || 'Médico',
            texto_legal: t('textoLegalAcupuntura'), paciente_acepta: true,
            testigo_1_nombre: cForm.testigo_1, testigo_2_nombre: cForm.testigo_2,
            firma_hash: Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
        };

        const { data, error } = await supabase.from('consentimientos_informados').insert([payload]).select();
        if (error) return alert(error.message);

        setConsentimientos([data[0], ...consentimientos]);
        setVistaConsentimiento('lista');
        setCForm({ testigo_1: '', testigo_2: '', acepta: false });
        alert(t('consentimientoGeneradoExito') || 'Consentimiento oficial generado y firmado.');
    };

    const generarPDFReferencia = () => {
        if (!rForm.receptor || !rForm.motivo || !rForm.diagnostico) return alert(t('alertaDatosTraslado') || 'Debes llenar todos los datos de traslado.');
        
        const printWindow = window.open('', '_blank');
        let htmlContent = `
            <html><head><title>Hoja de Referencia - ${pacienteSeleccionado.codigo_expediente || 'S/E'}</title>
            <style>
                body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #000; line-height: 1.5; font-size: 14px; background: white; }
                .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
                h1 { margin: 0; font-size: 22px; text-transform: uppercase; }
                h2 { font-size: 16px; background: #eee; padding: 5px; border: 1px solid #ccc; text-align: center; }
                .box { border: 1px solid #000; padding: 15px; margin-bottom: 20px; }
                .label { font-weight: bold; font-size: 12px; display: block; margin-top: 10px; color: #333; text-transform: uppercase; }
                .dato { font-size: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 5px; }
                .firma-box { margin-top: 50px; text-align: center; width: 300px; float: right; border-top: 1px solid #000; padding-top: 10px; }
            </style></head><body>
                <div class="header">
                    <h1>ACUPUNTURA CHINA TRADICIONAL H.K.</h1>
                    <h2>HOJA DE REFERENCIA Y TRASLADO MÉDICO</h2>
                </div>
                <div class="box">
                    <span class="label">Establecimiento Receptor:</span> <div class="dato"><strong>${rForm.receptor.toUpperCase()}</strong></div>
                    <span class="label">Fecha y Hora de Emisión:</span> <div class="dato">${new Date().toLocaleString()}</div>
                </div>
                <div class="box">
                    <h3>DATOS DEL PACIENTE</h3>
                    <span class="label">Nombre del Paciente:</span> <div class="dato">${pacienteSeleccionado.nombre}</div>
                    <span class="label">Expediente Clínico / CURP:</span> <div class="dato">${pacienteSeleccionado.codigo_expediente || 'S/E'} / ${pacienteSeleccionado.curp || 'N/A'}</div>
                    <span class="label">Edad / Sexo:</span> <div class="dato">${pacienteSeleccionado.sexo}</div>
                </div>
                <div class="box">
                    <h3>RESUMEN CLÍNICO Y MOTIVO DE ENVÍO</h3>
                    <span class="label">Impresión Diagnóstica:</span> <div class="dato">${rForm.diagnostico}</div>
                    <span class="label">Motivo de Referencia / Urgencia:</span> <div class="dato">${rForm.motivo}</div>
                </div>
                <div class="firma-box">
                    <strong>${perfilActual?.nombre || 'Médico Tratante'}</strong><br/>Nombre y Firma del Médico
                </div>
            </body></html>`;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 800);
        setShowReferenciaModal(false);
        setRForm({ receptor: '', motivo: '', diagnostico: '' });
    };

    const generarPDF = () => {
        const printWindow = window.open('', '_blank');
        let htmlContent = `
            <html>
            <head>
                <title>Expediente Clínico - ${pacienteSeleccionado.codigo_expediente || 'S/E'}</title>
                <style>
                    body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #000; line-height: 1.5; font-size: 12px; background: white;}
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
                    h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
                    h2 { font-size: 14px; background: #eee; padding: 5px; margin-top: 20px; border: 1px solid #ccc; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
                    .box { border: 1px solid #ccc; padding: 10px; border-radius: 5px; margin-bottom: 10px; }
                    .label { font-weight: bold; font-size: 11px; color: #555; display: block; }
                    .firma-hash { font-family: monospace; font-size: 10px; color: #666; background: #f9f9f9; padding: 5px; border: 1px dashed #ccc; display: inline-block; margin-top: 5px; }
                    .alerta { color: red; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ACUPUNTURA CHINA TRADICIONAL H.K.</h1>
                    <p>Expediente Clínico Oficial (Cumplimiento NOM-004-SSA3-2012)</p>
                </div>
                <h2>IDENTIFICACIÓN DEL PACIENTE</h2>
                <div class="info-grid">
                    <div><span class="label">Nombre:</span> ${pacienteSeleccionado.nombre}</div>
                    <div><span class="label">Expediente:</span> ${pacienteSeleccionado.codigo_expediente || 'S/E'}</div>
                    <div><span class="label">CURP:</span> ${pacienteSeleccionado.curp || 'No proporcionado'}</div>
                    <div><span class="label">Sexo / Teléfono:</span> ${pacienteSeleccionado.sexo} / ${pacienteSeleccionado.telefono}</div>
                </div>`;

        if (pacienteSeleccionado.alertas_clinicas?.filter(a => a.activa).length > 0) {
            htmlContent += `<h2>ALERTAS CLÍNICAS</h2><ul>`;
            pacienteSeleccionado.alertas_clinicas.filter(a => a.activa).forEach(a => { htmlContent += `<li class="alerta">${a.tipo_alerta}: ${a.descripcion}</li>`; });
            htmlContent += `</ul>`;
        }

        if (historia && historia.estado === 'firmada') {
            htmlContent += `<h2>HISTORIA CLÍNICA INICIAL</h2>`;
            htmlContent += `<div class="box"><span class="label">Motivo Consulta:</span> ${historia.motivo_consulta}</div>`;
            htmlContent += `<div class="box"><span class="label">Diagnóstico (CIE):</span> ${historia.diagnostico_cie}</div>`;
            htmlContent += `<div class="box"><span class="label">Plan de Tratamiento:</span> ${historia.plan_tratamiento}</div>`;
            htmlContent += `<div class="firma-hash">FIRMADO POR: ${historia.medico_nombre} | FECHA: ${formatDate(historia.fecha_firma)} | HASH: ${historia.firma_hash}</div>`;
        }

        htmlContent += `</body></html>`;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 800);
    };

    // 🚀 FILTRO QUIRÚRGICO (Búsqueda + Ocultar Legacy + Carpetas de Sucursal)
    const pacientesFiltrados = pacientes.filter(p => {
        const isLegacy = p.codigo_expediente && p.codigo_expediente.includes('LEGACY');
        
        // 1. Regla Legacy
        if (!showLegacyClients && isLegacy) return false;

        // 2. Regla de Búsqueda
        const busqueda = searchTerm.toLowerCase().trim();
        if (busqueda !== '') {
            return (p.nombre && p.nombre.toLowerCase().includes(busqueda)) || 
                   (p.telefono && p.telefono.includes(busqueda)) ||
                   (p.codigo_expediente && p.codigo_expediente.toLowerCase().includes(busqueda));
        }

        // 3. Regla de Pestañas
        if (activeSucursalTab !== 'todas') {
            return p.sucursal_registro_id === activeSucursalTab;
        }

        return true;
    });

    return (
        <div className="view-section active" style={{ display: 'flex', gap: '20px', overflow: 'hidden', height: '100%' }}>
            
            {/* PANEL IZQUIERDO: DIRECTORIO MÉDICO */}
            <div className="panel" style={{ width: '400px', flex: 'none', display: 'flex', flexDirection: 'column', padding: '25px 20px', borderRight: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                    <h3 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.2rem'}}><i className="fa-solid fa-users-medical" style={{color: 'var(--accent)', marginRight: '8px'}}></i> Mis Pacientes</h3>
                </div>

                <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                    <div style={{position: 'relative', flex: 1}}>
                        <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)'}}></i>
                        <input type="text" placeholder="Buscar expediente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{width: '100%', padding: '12px 12px 12px 35px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.9rem'}} />
                    </div>
                    {/* Botón Ocultar/Mostrar Legacy */}
                    <button 
                        onClick={() => setShowLegacyClients(!showLegacyClients)}
                        style={{padding: '12px', background: showLegacyClients ? 'rgba(2, 136, 209, 0.1)' : 'var(--bg-main)', color: showLegacyClients ? '#0288d1' : 'var(--text-muted)', border: `1px solid ${showLegacyClients ? '#0288d1' : 'var(--border-color)'}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s'}}
                        title="Alternar pacientes antiguos"
                    >
                        <i className={`fa-solid ${showLegacyClients ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                </div>

                {/* 🚀 PESTAÑAS CARPETAS POR SUCURSAL */}
                <div style={{display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '10px', scrollbarWidth: 'none'}}>
                    <button onClick={() => setActiveSucursalTab('todas')} style={{padding: '6px 12px', background: activeSucursalTab === 'todas' ? 'var(--text-main)' : 'var(--bg-panel)', color: activeSucursalTab === 'todas' ? 'var(--bg-panel)' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '15px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'}}>
                        Todos
                    </button>
                    {sucursalesDB.map(suc => {
                        return (
                            <button key={suc.id} onClick={() => setActiveSucursalTab(suc.id)} style={{padding: '6px 12px', background: activeSucursalTab === suc.id ? '#0288d1' : 'var(--bg-panel)', color: activeSucursalTab === suc.id ? 'white' : 'var(--text-muted)', border: activeSucursalTab === suc.id ? '1px solid #0288d1' : '1px solid var(--border-color)', borderRadius: '15px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'}}>
                                {suc.nombre}
                            </button>
                        );
                    })}
                </div>
                
                <button className="btn-primary" onClick={() => setShowNewPatientModal(true)} style={{padding: '12px', borderRadius: '8px', width: '100%', marginBottom: '20px', fontSize: '0.9rem'}}><i className="fa-solid fa-plus" style={{marginRight: '8px'}}></i> Alta Rápida de Paciente</button>

                <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px'}}>
                    {pacientesFiltrados.map(p => {
                        const isSelected = pacienteSeleccionado?.id === p.id;
                        const isLegacy = p.codigo_expediente && p.codigo_expediente.includes('LEGACY');
                        return (
                            <div 
                                key={p.id} 
                                onClick={() => setPacienteSeleccionado(p)} 
                                style={{
                                    padding: '15px', background: isSelected ? 'var(--bg-lighter)' : 'var(--bg-main)', 
                                    border: '1px solid', borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)', 
                                    borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease',
                                    borderLeft: isSelected ? '4px solid var(--accent)' : '1px solid var(--border-color)',
                                    boxShadow: isSelected ? '0 4px 10px rgba(0,0,0,0.05)' : 'none'
                                }}
                            >
                                <strong style={{display: 'block', color: isSelected ? 'var(--accent)' : 'var(--text-main)', fontSize: '0.95rem', marginBottom: '6px'}}>{p.nombre}</strong>
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                    {p.codigo_expediente ? (
                                        <span style={{background: isLegacy ? 'rgba(234, 88, 12, 0.1)' : 'rgba(2, 136, 209, 0.1)', color: isLegacy ? '#ea580c' : '#0288d1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold'}}>
                                            <i className="fa-solid fa-folder-open" style={{marginRight: '4px'}}></i> {p.codigo_expediente}
                                        </span>
                                    ) : <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>S/E</span>}
                                </div>
                            </div>
                        )
                    })}
                    {pacientesFiltrados.length === 0 && <div style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem'}}><i className="fa-regular fa-folder-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('noResultados') || 'No se encontraron resultados.'}</div>}
                </div>
            </div>

            {/* PANEL DERECHO: ESCRITORIO CLÍNICO */}
            <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                {pacienteSeleccionado ? (
                    <>
                        <div style={{padding: '25px 30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0}}>
                            <div>
                                <h1 style={{margin: '0 0 5px 0', color: 'var(--text-main)', fontSize: '1.6rem'}}>{pacienteSeleccionado.nombre}</h1>
                                <span style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>
                                    <i className="fa-solid fa-person-half-dress" style={{marginRight: '5px'}}></i> {pacienteSeleccionado.sexo} <span style={{margin: '0 10px', opacity: 0.3}}>|</span> 
                                    <i className="fa-regular fa-id-card" style={{marginRight: '5px'}}></i> {pacienteSeleccionado.curp || 'Sin CURP'} <span style={{margin: '0 10px', opacity: 0.3}}>|</span> 
                                    {pacienteSeleccionado.codigo_expediente && (
                                        <span style={{background: pacienteSeleccionado.codigo_expediente.includes('LEGACY') ? 'rgba(234, 88, 12, 0.1)' : 'rgba(2, 132, 199, 0.1)', color: pacienteSeleccionado.codigo_expediente.includes('LEGACY') ? '#ea580c' : 'var(--accent)', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold'}}>{pacienteSeleccionado.codigo_expediente}</span>
                                    )}
                                </span>
                            </div>
                            <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                                <button onClick={() => setShowReferenciaModal(true)} className="btn-action" style={{background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.3)', padding: '12px', borderRadius: '8px'}} title={t('hojaReferencia')}>
                                    <i className="fa-solid fa-truck-medical fa-lg"></i>
                                </button>
                                <button onClick={generarPDF} className="btn-action" style={{background: 'var(--bg-lighter)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px'}} title={t('exportarPdf')}>
                                    <i className="fa-solid fa-file-pdf fa-lg"></i>
                                </button>
                            </div>
                        </div>

                        {/* PESTAÑAS */}
                        <div style={{display: 'flex', gap: '30px', padding: '0 30px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', flexShrink: 0}}>
                            <button className="tab-btn" onClick={() => setTabActiva('historia')} style={{borderBottom: tabActiva === 'historia' ? '3px solid var(--accent)' : '3px solid transparent', color: tabActiva === 'historia' ? 'var(--accent)' : 'var(--text-muted)'}}><i className="fa-solid fa-file-medical" style={{marginRight: '8px'}}></i> {t('historiaClinica')}</button>
                            <button className="tab-btn" onClick={() => setTabActiva('evolucion')} style={{borderBottom: tabActiva === 'evolucion' ? '3px solid var(--accent)' : '3px solid transparent', color: tabActiva === 'evolucion' ? 'var(--accent)' : 'var(--text-muted)'}}><i className="fa-solid fa-stethoscope" style={{marginRight: '8px'}}></i> {t('notasEvolucion')}</button>
                            <button className="tab-btn" onClick={() => setTabActiva('consentimientos')} style={{borderBottom: tabActiva === 'consentimientos' ? '3px solid var(--accent)' : '3px solid transparent', color: tabActiva === 'consentimientos' ? 'var(--accent)' : 'var(--text-muted)'}}><i className="fa-solid fa-file-signature" style={{marginRight: '8px'}}></i> {t('consentimientos')}</button>
                        </div>

                        <div style={{flex: 1, overflowY: 'auto', padding: '30px', background: 'var(--bg-main)'}}>
                            
                            {/* PESTAÑA 1: HISTORIA CLÍNICA */}
                            {tabActiva === 'historia' && (
                                <div style={{maxWidth: '900px', margin: '0 auto', background: 'var(--bg-panel)', padding: '35px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                                    
                                    <h4 style={{color: 'var(--accent)', marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}><i className="fa-solid fa-clipboard-question"></i> {t('interrogatorio') || 'Interrogatorio'}</h4>
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '35px'}}>
                                        <div><label className="form-label">{t('motivoConsulta')} *</label><textarea value={hForm.motivo_consulta} onChange={(e) => setHForm({...hForm, motivo_consulta: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('padecimientoActual')} *</label><textarea value={hForm.padecimiento_actual} onChange={(e) => setHForm({...hForm, padecimiento_actual: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="3"></textarea></div>
                                    </div>

                                    <h4 style={{color: 'var(--accent)', marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}><i className="fa-solid fa-clock-rotate-left"></i> {t('antecedentesHabitos') || 'Antecedentes y Hábitos'}</h4>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px'}}>
                                        <div><label className="form-label">{t('antecedentesFamiliares')}</label><textarea value={hForm.antecedentes_familiares} onChange={(e) => setHForm({...hForm, antecedentes_familiares: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('antecedentesPersonales')}</label><textarea value={hForm.antecedentes_personales} onChange={(e) => setHForm({...hForm, antecedentes_personales: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('ginecoObstetricos')}</label><textarea value={hForm.gineco_obstetricos} onChange={(e) => setHForm({...hForm, gineco_obstetricos: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('planificacionFamiliar') || 'Métodos de Planificación Familiar'}</label><textarea value={hForm.planificacion_familiar} onChange={(e) => setHForm({...hForm, planificacion_familiar: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('antecedentesRenalesPsicologicos') || 'Antecedentes Renales y Psicológicos'}</label><textarea value={hForm.antecedentes_renales_psicologicos} onChange={(e) => setHForm({...hForm, antecedentes_renales_psicologicos: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('medicamentosActuales')}</label><textarea value={hForm.medicamentos_actuales} onChange={(e) => setHForm({...hForm, medicamentos_actuales: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                    </div>

                                    <h4 style={{color: 'var(--accent)', marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}><i className="fa-solid fa-brain"></i> {t('esferaFisicaMental') || 'Esfera Física y Mental'}</h4>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px'}}>
                                        <div><label className="form-label">{t('esferaMental') || 'Esfera Mental (TDAH, Estrés, Depresión...)'}</label><textarea value={hForm.esfera_mental} onChange={(e) => setHForm({...hForm, esfera_mental: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('habitosSustancias')}</label><textarea value={hForm.habitos_sustancias} onChange={(e) => setHForm({...hForm, habitos_sustancias: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('habitosSueno') || 'Hábitos de Sueño (¿Cómo duerme?)'}</label><textarea value={hForm.habitos_sueno} onChange={(e) => setHForm({...hForm, habitos_sueno: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('interrogatorioSistemas')}</label><textarea value={hForm.interrogatorio_sistemas} onChange={(e) => setHForm({...hForm, interrogatorio_sistemas: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                    </div>

                                    <h4 style={{color: '#ffb300', marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}><i className="fa-solid fa-yin-yang"></i> {t('diagnosticoMtc') || 'Diagnóstico MTC (Medicina Tradicional China)'}</h4>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px', background: 'rgba(255, 179, 0, 0.05)', padding: '20px', borderRadius: '12px', border: '1px dashed #ffb300'}}>
                                        <div style={{gridColumn: '1 / -1'}}><label className="form-label" style={{color: '#d97706'}}>{t('valoracionMtc')}</label><textarea value={hForm.valoracion_mtc} onChange={(e) => setHForm({...hForm, valoracion_mtc: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2" style={{borderColor: 'rgba(255, 179, 0, 0.3)'}}></textarea></div>
                                        <div><label className="form-label" style={{color: '#d97706'}}>{t('mtcPulsoLengua') || 'Pulso y Lengua'}</label><textarea value={hForm.mtc_pulso_lengua} onChange={(e) => setHForm({...hForm, mtc_pulso_lengua: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2" style={{borderColor: 'rgba(255, 179, 0, 0.3)'}}></textarea></div>
                                        <div><label className="form-label" style={{color: '#d97706'}}>{t('mtcRostroOjos') || 'Rostro y Ojos'}</label><textarea value={hForm.mtc_rostro_ojos} onChange={(e) => setHForm({...hForm, mtc_rostro_ojos: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2" style={{borderColor: 'rgba(255, 179, 0, 0.3)'}}></textarea></div>
                                        <div style={{gridColumn: '1 / -1'}}><label className="form-label" style={{color: '#d97706'}}>{t('mtcColoresSaboresSonidos') || 'Colores, Sabores y Sonidos'}</label><textarea value={hForm.mtc_colores_sabores_sonidos} onChange={(e) => setHForm({...hForm, mtc_colores_sabores_sonidos: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2" style={{borderColor: 'rgba(255, 179, 0, 0.3)'}}></textarea></div>
                                    </div>

                                    <h4 style={{color: 'var(--success)', marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}><i className="fa-solid fa-stethoscope"></i> {t('conclusionTratamiento') || 'Conclusión y Tratamiento'}</h4>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '20px'}}>
                                        <div><label className="form-label">{t('exploracionFisica')}</label><textarea value={hForm.exploracion_fisica} onChange={(e) => setHForm({...hForm, exploracion_fisica: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('diagnosticoCie')} *</label><textarea value={hForm.diagnostico_cie} onChange={(e) => setHForm({...hForm, diagnostico_cie: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('pronostico')}</label><textarea value={hForm.pronostico} onChange={(e) => setHForm({...hForm, pronostico: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                        <div><label className="form-label">{t('planTratamiento')} *</label><textarea value={hForm.plan_tratamiento} onChange={(e) => setHForm({...hForm, plan_tratamiento: e.target.value})} disabled={historia?.estado === 'firmada'} className="form-input" rows="3"></textarea></div>
                                    </div>

                                    {historia?.estado !== 'firmada' && (
                                        <div style={{display: 'flex', gap: '15px', marginTop: '40px', borderTop: '1px solid var(--border-color)', paddingTop: '30px'}}>
                                            <button className="btn-action" onClick={() => guardarHistoria(false)} style={{flex: 1, padding: '16px', background: 'var(--bg-lighter)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem'}}><i className="fa-regular fa-floppy-disk"></i> {t('guardarBorrador')}</button>
                                            <button className="btn-primary" onClick={() => guardarHistoria(true)} style={{flex: 1, padding: '16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}}><i className="fa-solid fa-lock"></i> {t('firmar')}</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PESTAÑA 2: NOTAS DE EVOLUCIÓN */}
                            {tabActiva === 'evolucion' && (
                                <div style={{display: 'flex', gap: '30px', height: '100%'}}>
                                    <div style={{width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                        <button className="btn-primary" onClick={crearNuevaNota} style={{padding: '15px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'}}><i className="fa-solid fa-plus"></i> {t('nuevaNota')}</button>
                                        <div style={{overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px'}}>
                                            {notas.map(nota => {
                                                const isActive = notaActiva === nota.id;
                                                const isFirmada = nota.estado === 'firmada';
                                                return (
                                                    <div 
                                                        key={nota.id} 
                                                        onClick={() => abrirNota(nota)} 
                                                        style={{
                                                            padding: '15px', background: isActive ? 'var(--bg-panel)' : 'var(--bg-main)', 
                                                            borderTop: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-color)'}`,
                                                            borderRight: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-color)'}`,
                                                            borderBottom: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-color)'}`,
                                                            borderLeft: isFirmada ? '4px solid var(--success)' : '4px solid #ffb300', 
                                                            borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', 
                                                            boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
                                                        }}
                                                    >
                                                        <span style={{fontSize: '0.85rem', color: 'var(--text-main)', display: 'block', fontWeight: 'bold', marginBottom: '5px'}}>{formatDateOnly(nota.fecha_registro)}</span>
                                                        <span style={{fontSize: '0.75rem', color: isFirmada ? 'var(--success)' : '#ffb300', background: isFirmada ? 'rgba(22, 163, 74, 0.1)' : 'rgba(255, 179, 0, 0.1)', padding: '2px 8px', borderRadius: '12px'}}>{nota.estado.toUpperCase()}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div style={{flex: 1, overflowY: 'auto'}}>
                                        {notaActiva ? (
                                            <div style={{maxWidth: '850px', background: 'var(--bg-panel)', padding: '35px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                                                
                                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px'}}>
                                                    <h3 style={{margin: 0, color: 'var(--text-main)'}}><i className="fa-solid fa-file-pen" style={{color: 'var(--accent)', marginRight: '8px'}}></i> {t('notasEvolucion')}</h3>
                                                    {nForm.estado === 'firmada' && (
                                                        <button onClick={generarPDFDiagnostico} className="btn-action" style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold'}} title="Imprimir Receta/Diagnóstico para el paciente">
                                                            <i className="fa-solid fa-print"></i> {t('imprimirDiagnostico') || 'Imprimir Diagnóstico'}
                                                        </button>
                                                    )}
                                                </div>

                                                {nForm.estado === 'firmada' && (
                                                    <div style={{background: 'rgba(22, 163, 74, 0.05)', border: '1px solid rgba(22, 163, 74, 0.3)', color: 'var(--success)', padding: '15px', borderRadius: '8px', marginBottom: '30px', textAlign: 'center'}}>
                                                        <i className="fa-solid fa-lock"></i> {t('documentoFirmado')} por <strong style={{color: 'var(--text-main)'}}>{nForm.medico_nombre}</strong> el {formatDate(nForm.fecha_firma)}
                                                        <br/><span style={{fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '5px', display: 'block'}}>Hash: {nForm.firma_hash}</span>
                                                    </div>
                                                )}

                                                <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px'}}>
                                                    <div><label className="form-label">{t('evolucion')}</label><textarea value={nForm.evolucion} onChange={(e) => setNForm({...nForm, evolucion: e.target.value})} disabled={nForm.estado === 'firmada'} className="form-input" rows="3"></textarea></div>
                                                    <div><label className="form-label">{t('evaluacionSignos')}</label><textarea value={nForm.evaluacion_signos} onChange={(e) => setNForm({...nForm, evaluacion_signos: e.target.value})} disabled={nForm.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                                    <div><label className="form-label">{t('procedimientoTecnica')}</label><textarea value={nForm.procedimiento_tecnica} onChange={(e) => setNForm({...nForm, procedimiento_tecnica: e.target.value})} disabled={nForm.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                                    <div><label className="form-label">{t('materialAgujas')}</label><textarea value={nForm.material_agujas} onChange={(e) => setNForm({...nForm, material_agujas: e.target.value})} disabled={nForm.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                                    <div><label className="form-label">{t('resultadoTolerancia')}</label><textarea value={nForm.resultado_tolerancia} onChange={(e) => setNForm({...nForm, resultado_tolerancia: e.target.value})} disabled={nForm.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                                    <div><label className="form-label">{t('planIndicaciones')}</label><textarea value={nForm.plan_indicaciones} onChange={(e) => setNForm({...nForm, plan_indicaciones: e.target.value})} disabled={nForm.estado === 'firmada'} className="form-input" rows="2"></textarea></div>
                                                </div>

                                                {/* SECCIÓN DE RESUMEN CLÍNICO (PUNTOS Y SESIONES) */}
                                                <div style={{background: 'rgba(2, 132, 199, 0.03)', padding: '25px', borderRadius: '12px', border: '1px dashed var(--accent)', marginBottom: '30px'}}>
                                                    <h4 style={{color: 'var(--accent)', marginBottom: '15px'}}><i className="fa-solid fa-notes-medical"></i> {t('resumenSesionImpresion') || 'Resumen de Sesión (Para Impresión)'}</h4>
                                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
                                                        <div style={{gridColumn: '1 / -1'}}><label className="form-label">{t('puntosAcupuntura') || 'Puntos de Acupuntura Utilizados'}</label><input type="text" value={nForm.puntos_acupuntura} onChange={(e) => setNForm({...nForm, puntos_acupuntura: e.target.value})} disabled={nForm.estado === 'firmada'} className="form-input" placeholder="Ej. IG4, E36, PC6..." style={{textTransform: 'uppercase'}} /></div>
                                                        <div><label className="form-label">{t('tiempoRetencion') || 'Tiempo de Retención (Minutos)'}</label><input type="number" value={nForm.tiempo_retencion_minutos} onChange={(e) => setNForm({...nForm, tiempo_retencion_minutos: e.target.value})} disabled={nForm.estado === 'firmada'} className="form-input" placeholder="Ej. 20" /></div>
                                                        <div><label className="form-label">{t('sesionesRequeridas') || 'Sesiones Requeridas (Sugeridas)'}</label><input type="number" value={nForm.sesiones_requeridas} onChange={(e) => setNForm({...nForm, sesiones_requeridas: e.target.value})} disabled={nForm.estado === 'firmada'} className="form-input" placeholder="Ej. 5" /></div>
                                                        <div style={{gridColumn: '1 / -1'}}><label className="form-label">{t('diagnosticoSesion') || 'Diagnóstico de la Sesión (Dictamen)'}</label><textarea value={nForm.diagnostico_sesion} onChange={(e) => setNForm({...nForm, diagnostico_sesion: e.target.value})} disabled={nForm.estado === 'firmada'} className="form-input" rows="2" placeholder="Diagnóstico final para el paciente..."></textarea></div>
                                                    </div>
                                                </div>

                                                {nForm.estado !== 'firmada' ? (
                                                    <div style={{display: 'flex', gap: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '30px'}}>
                                                        <button className="btn-action" onClick={() => guardarNota(false)} style={{flex: 1, padding: '16px', background: 'var(--bg-lighter)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem'}}><i className="fa-regular fa-floppy-disk"></i> {t('guardarBorrador')}</button>
                                                        <button className="btn-primary" onClick={() => guardarNota(true)} style={{flex: 1, padding: '16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}}><i className="fa-solid fa-lock"></i> {t('firmar')}</button>
                                                    </div>
                                                ) : (
                                                    <div style={{borderTop: '2px dashed var(--border-color)', paddingTop: '30px'}}>
                                                        <h4 style={{color: '#ffb300', marginBottom: '20px', fontSize: '1.1rem'}}><i className="fa-solid fa-file-pen"></i> {t('adendas')}</h4>
                                                        {adendasActivas.map(adenda => (
                                                            <div key={adenda.id} style={{background: 'rgba(255, 179, 0, 0.05)', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #ffb300', marginBottom: '15px'}}>
                                                                <p style={{margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.5'}}>{adenda.texto_adenda}</p>
                                                                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Firmada por <strong style={{color: 'var(--text-main)'}}>{adenda.medico_nombre}</strong> el {formatDate(adenda.fecha_registro)}</span>
                                                            </div>
                                                        ))}
                                                        <div style={{marginTop: '25px', background: 'var(--bg-main)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)'}}>
                                                            <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'block', fontWeight: 'bold'}}>{t('redactarAdenda')}</label>
                                                            <textarea value={nuevaAdenda} onChange={e => setNuevaAdenda(e.target.value)} placeholder="Escribe la fe de erratas o corrección aquí..." style={{width: '100%', padding: '15px', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', minHeight: '60px', marginBottom: '10px'}} />
                                                            <button className="btn-action" onClick={firmarAdenda} style={{background: 'rgba(255, 179, 0, 0.1)', color: '#ea580c', border: '1px solid rgba(255, 179, 0, 0.3)', fontWeight: 'bold', width: '100%', padding: '12px', borderRadius: '8px'}}><i className="fa-solid fa-signature"></i> {t('firmarAdenda')}</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px dashed var(--border-color)'}}>
                                                <i className="fa-solid fa-notes-medical fa-4x" style={{marginBottom: '20px', opacity: 0.3}}></i>
                                                <h2 style={{color: 'var(--text-main)'}}>Selecciona o crea una nota</h2>
                                                <p>El historial de evolución clínica aparecerá aquí.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* PESTAÑA 3: CONSENTIMIENTOS */}
                            {tabActiva === 'consentimientos' && (
                                <div style={{maxWidth: '850px', margin: '0 auto'}}>
                                    {vistaConsentimiento === 'lista' ? (
                                        <div style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                                            <button className="btn-primary" onClick={() => setVistaConsentimiento('nuevo')} style={{marginBottom: '30px', padding: '15px 25px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'}}><i className="fa-solid fa-file-signature"></i> {t('nuevoConsentimiento')}</button>
                                            <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                                                {consentimientos.length === 0 ? (
                                                    <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: '60px', background: 'var(--bg-main)', borderRadius: '10px', border: '1px dashed var(--border-color)'}}>No hay consentimientos registrados en este expediente.</div>
                                                ) : (
                                                    consentimientos.map(c => (
                                                        <div key={c.id} style={{background: 'var(--bg-main)', padding: '25px', border: '1px solid var(--border-color)', borderLeft: '5px solid var(--success)', borderRadius: '10px'}}>
                                                            <h4 style={{margin: '0 0 15px 0', color: 'var(--text-main)', fontSize: '1.1rem'}}><i className="fa-solid fa-check-circle" style={{color: 'var(--success)', marginRight: '8px'}}></i> {c.tipo_procedimiento || 'Acupuntura Tradicional'}</h4>
                                                            <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '15px'}}>"{c.texto_legal}"</p>
                                                            <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '15px'}}>
                                                                <span><strong>Testigos:</strong> {c.testigo_1_nombre} y {c.testigo_2_nombre}</span>
                                                                <span><strong>Hash:</strong> {c.firma_hash}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)'}}>
                                            <h3 style={{marginBottom: '25px', color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-scale-balanced" style={{color: 'var(--accent)', marginRight: '10px'}}></i> Consentimiento Oficial</h3>
                                            <div style={{background: 'var(--bg-main)', padding: '25px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '30px'}}>
                                                <p style={{fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.6'}}>{t('textoLegalAcupuntura')}</p>
                                            </div>
                                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px'}}>
                                                <div><label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('testigo1')} *</label><input type="text" value={cForm.testigo_1} onChange={e => setCForm({...cForm, testigo_1: formatUpperCase(e.target.value)})} style={{width: '100%', padding: '15px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', textTransform: 'uppercase'}} /></div>
                                                <div><label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('testigo2')} *</label><input type="text" value={cForm.testigo_2} onChange={e => setCForm({...cForm, testigo_2: formatUpperCase(e.target.value)})} style={{width: '100%', padding: '15px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', textTransform: 'uppercase'}} /></div>
                                            </div>
                                            <label style={{display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', background: 'rgba(22, 163, 74, 0.05)', padding: '20px', borderRadius: '10px', border: '1px dashed var(--success)', marginBottom: '35px'}}>
                                                <input type="checkbox" checked={cForm.acepta} onChange={e => setCForm({...cForm, acepta: e.target.checked})} style={{width: '24px', height: '24px', accentColor: 'var(--success)'}} />
                                                <span style={{color: 'var(--text-main)', fontWeight: 'bold', fontSize: '1.05rem'}}>{t('pacienteAcepta')}</span>
                                            </label>
                                            <div style={{display: 'flex', gap: '15px'}}>
                                                <button className="btn-action" onClick={() => setVistaConsentimiento('lista')} style={{flex: 1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem'}}>Cancelar</button>
                                                <button className="btn-primary" onClick={generarConsentimiento} style={{flex: 2, padding: '16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}}><i className="fa-solid fa-file-signature"></i> {t('firmarConsentimiento')}</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </>
                ) : (
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-main)', color: 'var(--text-muted)'}}>
                        <div style={{background: 'var(--bg-panel)', padding: '40px 60px', borderRadius: '16px', textAlign: 'center', border: '1px dashed var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                            <i className="fa-solid fa-user-doctor fa-4x" style={{marginBottom: '25px', opacity: 0.3, color: 'var(--accent)'}}></i>
                            <h2 style={{color: 'var(--text-main)', marginBottom: '10px'}}>Escritorio Clínico</h2>
                            <p style={{fontSize: '0.95rem'}}>Selecciona un paciente del directorio lateral para comenzar.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL ALTA RÁPIDA (ESTRICTO) */}
            {showNewPatientModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '500px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '10px', color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-user-plus" style={{color: 'var(--accent)', marginRight: '10px'}}></i> Alta Rápida</h3>
                        <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '30px'}}>Campos mínimos requeridos por norma. Recepción puede completar el resto después.</p>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '35px'}}>
                            <div>
                                <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>Nombres *</label>
                                <input type="text" value={npNombres} onChange={e => setNpNombres(formatUpperCase(e.target.value))} style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', textTransform: 'uppercase'}} />
                            </div>
                            <div>
                                <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>Apellidos *</label>
                                <input type="text" value={npApellidos} onChange={e => setNpApellidos(formatUpperCase(e.target.value))} style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', textTransform: 'uppercase'}} />
                            </div>
                            <div>
                                <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>Teléfono *</label>
                                <input type="text" value={npTelefono} onChange={e => setNpTelefono(e.target.value)} style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px'}} />
                            </div>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                                <div><label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>Fecha Nac. *</label><input type="date" value={npFechaNacimiento} onChange={e => setNpFechaNacimiento(e.target.value)} style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer'}} /></div>
                                <div><label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>Sexo *</label><select value={npSexo} onChange={e => setNpSexo(e.target.value)} style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer'}}><option value="">-- Seleccionar --</option><option value="Femenino">Femenino</option><option value="Masculino">Masculino</option><option value="Otro">Otro</option></select></div>
                            </div>
                        </div>
                        
                        <div style={{display: 'flex', gap: '15px'}}>
                            <button className="btn-action" onClick={() => setShowNewPatientModal(false)} style={{flex: 1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold'}}>Cancelar</button>
                            <button className="btn-primary" onClick={guardarPacienteRapido} style={{flex: 1, padding: '16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}><i className="fa-solid fa-save"></i> Crear Expediente</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL HOJA DE REFERENCIA */}
            {showReferenciaModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '550px', border: '1px solid rgba(234, 88, 12, 0.5)', boxShadow: '0 10px 30px rgba(234, 88, 12, 0.15)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '10px', color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-truck-medical" style={{color: '#ea580c', marginRight: '10px'}}></i> Generar Hoja de Referencia</h3>
                        <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '30px'}}>Este documento oficial ampara el traslado o envío del paciente a otro hospital para urgencias o estudios.</p>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '35px'}}>
                            <div><label style={{display: 'block', fontSize: '0.85rem', color: '#ea580c', marginBottom: '8px', fontWeight: 'bold'}}>{t('hospitalReceptor')} *</label><input type="text" value={rForm.receptor} onChange={e => setRForm({...rForm, receptor: e.target.value})} placeholder="Ej. Hospital General..." style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px'}} /></div>
                            <div><label style={{display: 'block', fontSize: '0.85rem', color: '#ea580c', marginBottom: '8px', fontWeight: 'bold'}}>{t('impresionDiagnostica')} *</label><textarea value={rForm.diagnostico} onChange={e => setRForm({...rForm, diagnostico: e.target.value})} placeholder="Ej. Crisis Hipertensiva..." style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', resize: 'vertical', minHeight: '80px'}} /></div>
                            <div><label style={{display: 'block', fontSize: '0.85rem', color: '#ea580c', marginBottom: '8px', fontWeight: 'bold'}}>{t('motivoTraslado')} *</label><textarea value={rForm.motivo} onChange={e => setRForm({...rForm, motivo: e.target.value})} placeholder="Ej. Requiere valoración cardiológica urgente..." style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', resize: 'vertical', minHeight: '80px'}} /></div>
                        </div>
                        <div style={{display: 'flex', gap: '15px'}}>
                            <button className="btn-action" onClick={() => setShowReferenciaModal(false)} style={{flex: 1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold'}}>Cancelar</button>
                            <button className="btn-action" onClick={generarPDFReferencia} style={{flex: 2, padding: '16px', background: '#ea580c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}><i className="fa-solid fa-print"></i> Generar Documento</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .tab-btn { padding: 20px 10px; background: transparent; border: none; cursor: pointer; font-size: 0.95rem; font-weight: bold; transition: all 0.2s ease; }
                .tab-btn:hover { color: var(--text-main) !important; }
                .form-label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                .form-input { width: 100%; padding: 14px; background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 10px; font-size: 1rem; transition: all 0.3s ease; }
                .form-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15); }
                .form-input:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>
        </div>
    );
}