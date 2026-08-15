'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function EscritorioMedico({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage();
    const [pacientes, setPacientes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
    const [tabActiva, setTabActiva] = useState('historia'); // 'historia' | 'evolucion' | 'consentimientos'
    
    // ESTADOS: Alta Rápida de Paciente (Exclusivo Médicos)
    const [showNewPatientModal, setShowNewPatientModal] = useState(false);
    const [npForm, setNpForm] = useState({ nombre: '', telefono: '', fecha_nacimiento: '', sexo: '' });

    // ESTADOS: Hoja de Referencia Médica (Traslado Urgencia)
    const [showReferenciaModal, setShowReferenciaModal] = useState(false);
    const [rForm, setRForm] = useState({ receptor: '', motivo: '', diagnostico: '' });

    // ESTADOS: Historia Clínica
    const [historia, setHistoria] = useState(null);
    const [hForm, setHForm] = useState({
        motivo_consulta: '', padecimiento_actual: '', antecedentes_familiares: '', antecedentes_personales: '',
        habitos_sustancias: '', medicamentos_actuales: '', gineco_obstetricos: '', interrogatorio_sistemas: '',
        exploracion_fisica: '', diagnostico_cie: '', valoracion_mtc: '', pronostico: '', plan_tratamiento: ''
    });

    // ESTADOS: Notas de Evolución
    const [notas, setNotas] = useState([]);
    const [notaActiva, setNotaActiva] = useState(null);
    const [nForm, setNForm] = useState({ evolucion: '', evaluacion_signos: '', procedimiento_tecnica: '', material_agujas: '', resultado_tolerancia: '', plan_indicaciones: '' });
    
    // ESTADOS: Adendas
    const [adendasActivas, setAdendasActivas] = useState([]);
    const [nuevaAdenda, setNuevaAdenda] = useState('');

    // ESTADOS: Consentimientos
    const [consentimientos, setConsentimientos] = useState([]);
    const [vistaConsentimiento, setVistaConsentimiento] = useState('lista');
    const [cForm, setCForm] = useState({ testigo_1: '', testigo_2: '', acepta: false });

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    useEffect(() => {
        const fetchPacientes = async () => {
            const { data } = await supabase.from('clientes').select('*, alertas_clinicas(id, tipo_alerta, descripcion, nivel_gravedad, activa)').order('nombre', { ascending: true });
            if (data) setPacientes(data);
        };
        fetchPacientes();
    }, []);

    useEffect(() => {
        if (!pacienteSeleccionado) return;
        
        const fetchExpediente = async () => {
            const { data: hData } = await supabase.from('historia_clinica').select('*').eq('paciente_id', pacienteSeleccionado.id).single();
            if (hData) { setHistoria(hData); setHForm(hData); } 
            else { setHistoria(null); setHForm({ motivo_consulta: '', padecimiento_actual: '', antecedentes_familiares: '', antecedentes_personales: '', habitos_sustancias: '', medicamentos_actuales: '', gineco_obstetricos: '', interrogatorio_sistemas: '', exploracion_fisica: '', diagnostico_cie: '', valoracion_mtc: '', pronostico: '', plan_tratamiento: '' }); }

            const { data: nData } = await supabase.from('notas_evolucion').select('*').eq('paciente_id', pacienteSeleccionado.id).order('fecha_registro', { ascending: false });
            if (nData) { setNotas(nData); setNotaActiva(null); }

            const { data: cData } = await supabase.from('consentimientos_informados').select('*').eq('paciente_id', pacienteSeleccionado.id).order('fecha_firma', { ascending: false });
            if (cData) { setConsentimientos(cData); setVistaConsentimiento('lista'); }
        };
        fetchExpediente();
    }, [pacienteSeleccionado]);

    const guardarHistoria = async (firmar = false) => {
        if (firmar && (!hForm.motivo_consulta || !hForm.diagnostico_cie || !hForm.plan_tratamiento)) return alert('Para firmar, debes llenar al menos el Motivo, Diagnóstico y Plan.');
        if (firmar && !window.confirm('¿Estás seguro de firmar? El documento quedará bloqueado e inalterable por ley.')) return;

        const payload = {
            paciente_id: pacienteSeleccionado.id, medico_nombre: perfilActual?.nombre || 'Médico', ...hForm,
            estado: firmar ? 'firmada' : 'borrador', fecha_firma: firmar ? new Date().toISOString() : null, firma_hash: firmar ? Math.random().toString(36).substring(2, 15) + Date.now().toString(36) : null
        };

        if (historia?.id) { await supabase.from('historia_clinica').update(payload).eq('id', historia.id); } 
        else { const { data } = await supabase.from('historia_clinica').insert([payload]).select(); setHistoria(data[0]); }
        
        alert(firmar ? t('documentoFirmado') : 'Borrador Guardado');
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

    const crearNuevaNota = () => { setNotaActiva('nueva'); setNForm({ evolucion: '', evaluacion_signos: '', procedimiento_tecnica: '', material_agujas: '', resultado_tolerancia: '', plan_indicaciones: '' }); };

    const guardarNota = async (firmar = false) => {
        if (firmar) {
            if (nForm.evolucion.length < 15 || nForm.procedimiento_tecnica.length < 10) return alert('Por norma, no puedes firmar con campos vacíos o ambiguos. Describe clínicamente la evolución y procedimiento.');
            if (!window.confirm('¿Estás seguro de firmar esta nota? No podrá ser borrada ni alterada.')) return;
        }

        const payload = {
            paciente_id: pacienteSeleccionado.id, sucursal_id: sucursalId, medico_nombre: perfilActual?.nombre || 'Médico', ...nForm,
            estado: firmar ? 'firmada' : 'borrador', fecha_firma: firmar ? new Date().toISOString() : null, firma_hash: firmar ? Math.random().toString(36).substring(2, 15) + Date.now().toString(36) : null
        };

        if (notaActiva !== 'nueva') { await supabase.from('notas_evolucion').update(payload).eq('id', notaActiva); } 
        else { await supabase.from('notas_evolucion').insert([payload]); }
        
        alert(firmar ? t('documentoFirmado') : 'Borrador Guardado');
        const { data } = await supabase.from('notas_evolucion').select('*').eq('paciente_id', pacienteSeleccionado.id).order('fecha_registro', { ascending: false });
        if (data) { setNotas(data); setNotaActiva(null); }
    };

    const guardarPacienteRapido = async () => {
        if (!npForm.nombre || !npForm.telefono || !npForm.fecha_nacimiento || !npForm.sexo) {
            return alert('Nombre, Teléfono, Fecha de Nacimiento y Sexo son obligatorios.');
        }

        const payload = {
            nombre: npForm.nombre.trim(),
            telefono: npForm.telefono.trim(),
            fecha_nacimiento: npForm.fecha_nacimiento,
            sexo: npForm.sexo,
            sucursal_alta_id: sucursalId
        };

        const { data, error } = await supabase.from('clientes').insert([payload]).select();
        if (error) return alert('Error al registrar: ' + error.message);

        const nuevoPaciente = { ...data[0], alertas_clinicas: [] };
        
        setPacientes(prev => [...prev, nuevoPaciente].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setPacienteSeleccionado(nuevoPaciente);
        setShowNewPatientModal(false);
        setNpForm({ nombre: '', telefono: '', fecha_nacimiento: '', sexo: '' });
        alert('Expediente creado exitosamente.');
    };

    const firmarAdenda = async () => {
        if (nuevaAdenda.trim().length < 10) return alert('La adenda debe ser clara y justificada.');
        if (!window.confirm('¿Firmar y anexar esta adenda al expediente?')) return;

        const payload = {
            nota_id: notaActiva, medico_nombre: perfilActual?.nombre || 'Médico', texto_adenda: nuevaAdenda.trim(),
            firma_hash: Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
        };

        const { data, error } = await supabase.from('adendas').insert([payload]).select();
        if (error) return alert(error.message);

        setAdendasActivas([...adendasActivas, data[0]]);
        setNuevaAdenda('');
        alert('Adenda firmada y anexada exitosamente.');
    };

    const generarConsentimiento = async () => {
        if (!cForm.testigo_1 || !cForm.testigo_2) return alert('Se requieren los nombres de dos testigos legales.');
        if (!cForm.acepta) return alert('El paciente debe aceptar los términos marcando la casilla.');
        if (!window.confirm('Al firmar, el consentimiento será registrado legalmente a nombre del paciente y testigos.')) return;

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
        alert('Consentimiento oficial generado y firmado.');
    };

    // 🚀 HOJA DE REFERENCIA (TRASLADO)
    const generarPDFReferencia = () => {
        if (!rForm.receptor || !rForm.motivo || !rForm.diagnostico) return alert('Debes llenar todos los datos de traslado.');
        
        const printWindow = window.open('', '_blank');
        let htmlContent = `
            <html><head><title>Hoja de Referencia - ${pacienteSeleccionado.num_expediente}</title>
            <style>
                body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #000; line-height: 1.5; font-size: 14px; }
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
                    <span class="label">Expediente Clínico / CURP:</span> <div class="dato">${pacienteSeleccionado.num_expediente} / ${pacienteSeleccionado.curp || 'N/A'}</div>
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
                <title>Expediente Clínico - ${pacienteSeleccionado.num_expediente}</title>
                <style>
                    body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #000; line-height: 1.5; font-size: 12px; }
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
                    <div><span class="label">Expediente:</span> ${pacienteSeleccionado.num_expediente}</div>
                    <div><span class="label">CURP:</span> ${pacienteSeleccionado.curp || 'No proporcionado'}</div>
                    <div><span class="label">Sexo / Teléfono:</span> ${pacienteSeleccionado.sexo} / ${pacienteSeleccionado.telefono}</div>
                </div>
        `;

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
            htmlContent += `<div class="firma-hash">FIRMADO POR: ${historia.medico_nombre} | FECHA: ${new Date(historia.fecha_firma).toLocaleString()} | HASH: ${historia.firma_hash}</div>`;
        }

        if (consentimientos.length > 0) {
            htmlContent += `<h2>CONSENTIMIENTOS INFORMADOS</h2>`;
            consentimientos.forEach(c => {
                htmlContent += `<div class="box">
                    <p><strong>Procedimiento:</strong> ${c.tipo_procedimiento}</p>
                    <p><em>"${c.texto_legal}"</em></p>
                    <div class="info-grid">
                        <div><span class="label">Paciente Acepta:</span> SÍ</div>
                        <div><span class="label">Testigos:</span> ${c.testigo_1_nombre} y ${c.testigo_2_nombre}</div>
                    </div>
                    <div class="firma-hash">FECHA: ${new Date(c.fecha_firma).toLocaleString()} | HASH: ${c.firma_hash}</div>
                </div>`;
            });
        }

        if (notas.filter(n => n.estado === 'firmada').length > 0) {
            htmlContent += `<h2>NOTAS DE EVOLUCIÓN FIRMADAS</h2>`;
            notas.filter(n => n.estado === 'firmada').forEach(n => {
                htmlContent += `<div class="box" style="page-break-inside: avoid;">
                    <div style="border-bottom: 1px solid #ccc; margin-bottom: 8px;"><strong>Fecha:</strong> ${new Date(n.fecha_firma).toLocaleString()}</div>
                    <span class="label">Evolución:</span> <p style="margin: 5px 0;">${n.evolucion}</p>
                    <span class="label">Procedimiento y Técnica:</span> <p style="margin: 5px 0;">${n.procedimiento_tecnica}</p>
                    <div class="firma-hash">FIRMADO POR: ${n.medico_nombre} | HASH: ${n.firma_hash}</div>
                </div>`;
            });
        }

        htmlContent += `
                <div style="text-align: center; margin-top: 50px; font-size: 10px; color: #666;">
                    Documento extraído de Base de Datos Encriptada.<br/>Impreso el: ${new Date().toLocaleString()}
                </div>
            </body></html>`;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 800);
    };

    const pacientesFiltrados = pacientes.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (p.num_expediente && p.num_expediente.toLowerCase().includes(searchTerm.toLowerCase())));

    return (
        <div className="view-section active" style={{ display: 'flex', gap: '20px', overflow: 'hidden' }}>
            
            {/* PANEL IZQUIERDO: LISTA DE PACIENTES */}
            <div className="panel" style={{ width: '350px', flex: 'none', display: 'flex', flexDirection: 'column', padding: '20px' }}>
                <h3 style={{marginBottom: '15px'}}><i className="fa-solid fa-users-medical" style={{color: 'var(--accent)'}}></i> Mis Pacientes</h3>
                <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                    <input type="text" placeholder="🔍 Buscar paciente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{flex: 1, padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                    <button className="btn-action" onClick={() => setShowNewPatientModal(true)} style={{padding: '0 15px', background: 'var(--bg-lighter)', color: 'white', border: '1px solid var(--border-color)'}} title="Alta Rápida"><i className="fa-solid fa-user-plus"></i></button>
                </div>
                <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px'}}>
                    {pacientesFiltrados.map(p => (
                        <div key={p.id} onClick={() => setPacienteSeleccionado(p)} style={{padding: '12px', background: pacienteSeleccionado?.id === p.id ? 'var(--bg-lighter)' : 'var(--bg-dark)', border: pacienteSeleccionado?.id === p.id ? '1px solid var(--accent)' : '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer'}}>
                            <strong style={{display: 'block', color: 'white'}}>{p.nombre}</strong>
                            <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace'}}>{p.num_expediente || 'S/E'}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* PANEL DERECHO: ESCRITORIO CLÍNICO */}
            <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
                {pacienteSeleccionado ? (
                    <>
                        {/* BANNER DEL PACIENTE Y EXPORTACIÓN */}
                        <div style={{padding: '20px', borderBottom: '1px solid var(--border-color)', background: '#111'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                                <div>
                                    <h1 style={{margin: 0, color: 'white'}}>{pacienteSeleccionado.nombre}</h1>
                                    <span style={{color: 'var(--text-muted)'}}>{pacienteSeleccionado.sexo} | {pacienteSeleccionado.curp || 'Sin CURP'} | Exp: <strong style={{color: 'var(--accent)', fontFamily: 'monospace'}}>{pacienteSeleccionado.num_expediente}</strong></span>
                                </div>
                                <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                                    {pacienteSeleccionado.alertas_clinicas?.filter(a => a.activa).length > 0 && (
                                        <div style={{background: 'rgba(198, 40, 40, 0.1)', border: '1px dashed var(--primary-red)', padding: '10px 15px', borderRadius: '8px', maxWidth: '300px'}}>
                                            <strong style={{color: 'var(--primary-red)', fontSize: '0.8rem', display: 'block', marginBottom: '5px'}}><i className="fa-solid fa-triangle-exclamation"></i> ALERTAS CLÍNICAS</strong>
                                            {pacienteSeleccionado.alertas_clinicas.filter(a => a.activa).map(a => <div key={a.id} style={{fontSize: '0.75rem', color: 'white'}}>- {a.tipo_alerta}: {a.descripcion}</div>)}
                                        </div>
                                    )}
                                    {/* BOTÓN HOJA REFERENCIA (AMBULANCIA) */}
                                    <button onClick={() => setShowReferenciaModal(true)} className="btn-action" style={{background: '#e65100', color: 'white', border: 'none', padding: '10px 15px'}} title={t('hojaReferencia')}>
                                        <i className="fa-solid fa-truck-medical fa-lg"></i>
                                    </button>
                                    
                                    {/* BOTÓN EXPORTAR COFEPRIS */}
                                    <button onClick={generarPDF} className="btn-action" style={{background: '#3d1e1e', color: 'var(--accent)', border: '1px solid var(--primary-red)', padding: '10px 15px'}} title={t('exportarPdf')}>
                                        <i className="fa-solid fa-file-pdf fa-lg"></i>
                                    </button>
                                </div>
                            </div>

                            {/* PESTAÑAS */}
                            <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                                <button className={`btn-action ${tabActiva === 'historia' ? 'btn-primary' : ''}`} onClick={() => setTabActiva('historia')}><i className="fa-solid fa-file-medical"></i> {t('historiaClinica')}</button>
                                <button className={`btn-action ${tabActiva === 'evolucion' ? 'btn-primary' : ''}`} onClick={() => setTabActiva('evolucion')}><i className="fa-solid fa-stethoscope"></i> {t('notasEvolucion')}</button>
                                <button className={`btn-action ${tabActiva === 'consentimientos' ? 'btn-primary' : ''}`} onClick={() => setTabActiva('consentimientos')}><i className="fa-solid fa-file-signature"></i> {t('consentimientos')}</button>
                            </div>
                        </div>

                        {/* ÁREA DE TRABAJO SCROLLEABLE */}
                        <div style={{flex: 1, overflowY: 'auto', padding: '20px'}}>
                            
                            {/* PESTAÑA 1: HISTORIA CLÍNICA */}
                            {tabActiva === 'historia' && (
                                <div style={{maxWidth: '800px', margin: '0 auto'}}>
                                    {historia?.estado === 'firmada' && (
                                        <div style={{background: 'rgba(46, 125, 50, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center'}}>
                                            <i className="fa-solid fa-lock"></i> {t('documentoFirmado')} por {historia.medico_nombre} el {new Date(historia.fecha_firma).toLocaleString()}
                                            <br/><span style={{fontSize: '0.7rem', fontFamily: 'monospace', color: '#888'}}>Hash: {historia.firma_hash}</span>
                                        </div>
                                    )}

                                    <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                        {Object.keys(hForm).map(key => {
                                            if (['motivo_consulta', 'padecimiento_actual', 'antecedentes_familiares', 'antecedentes_personales', 'habitos_sustancias', 'medicamentos_actuales', 'gineco_obstetricos', 'interrogatorio_sistemas', 'exploracion_fisica', 'diagnostico_cie', 'valoracion_mtc', 'pronostico', 'plan_tratamiento'].includes(key)) {
                                                return (
                                                    <div key={key}>
                                                        <label style={{display: 'block', color: 'var(--accent)', fontSize: '0.85rem', marginBottom: '5px', fontWeight: 'bold'}}>{t(key.replace(/_([a-z])/g, (g) => g[1].toUpperCase()))}</label>
                                                        <textarea value={hForm[key]} onChange={(e) => setHForm({...hForm, [key]: e.target.value})} disabled={historia?.estado === 'firmada'} style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', resize: 'vertical', minHeight: '80px', opacity: historia?.estado === 'firmada' ? 0.7 : 1}} />
                                                    </div>
                                                );
                                            }
                                        })}
                                    </div>

                                    {historia?.estado !== 'firmada' && (
                                        <div style={{display: 'flex', gap: '10px', marginTop: '30px'}}>
                                            <button className="btn-action" onClick={() => guardarHistoria(false)} style={{flex: 1, padding: '15px', background: 'var(--bg-lighter)', color: 'white', border: '1px solid var(--border-color)'}}><i className="fa-solid fa-save"></i> {t('guardarBorrador')}</button>
                                            <button className="pay-btn" onClick={() => guardarHistoria(true)} style={{flex: 1, padding: '15px', background: '#0d47a1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold'}}><i className="fa-solid fa-lock"></i> {t('firmar')}</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PESTAÑA 2: NOTAS DE EVOLUCIÓN Y ADENDAS */}
                            {tabActiva === 'evolucion' && (
                                <div style={{display: 'flex', gap: '20px', height: '100%'}}>
                                    <div style={{width: '250px', borderRight: '1px solid var(--border-color)', paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                        <button className="btn-action btn-primary" onClick={crearNuevaNota} style={{padding: '12px'}}><i className="fa-solid fa-plus"></i> {t('nuevaNota')}</button>
                                        <div style={{overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            {notas.map(nota => (
                                                <div key={nota.id} onClick={() => abrirNota(nota)} style={{padding: '10px', background: notaActiva === nota.id ? 'var(--bg-lighter)' : 'var(--bg-dark)', borderTop: notaActiva === nota.id ? '1px solid var(--accent)' : '1px solid var(--border-color)', borderRight: notaActiva === nota.id ? '1px solid var(--accent)' : '1px solid var(--border-color)', borderBottom: notaActiva === nota.id ? '1px solid var(--accent)' : '1px solid var(--border-color)', borderLeft: nota.estado === 'firmada' ? '4px solid var(--success)' : '4px solid #ffb300', borderRadius: '6px', cursor: 'pointer'}}>
                                                    <span style={{fontSize: '0.8rem', color: 'white', display: 'block'}}>{new Date(nota.fecha_registro).toLocaleDateString()}</span>
                                                    <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>{nota.estado.toUpperCase()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{flex: 1, overflowY: 'auto', paddingRight: '10px'}}>
                                        {notaActiva ? (
                                            <div style={{maxWidth: '700px'}}>
                                                {nForm.estado === 'firmada' && (
                                                    <div style={{background: 'rgba(46, 125, 50, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center'}}>
                                                        <i className="fa-solid fa-lock"></i> {t('documentoFirmado')} por {nForm.medico_nombre} el {new Date(nForm.fecha_firma).toLocaleString()}
                                                        <br/><span style={{fontSize: '0.7rem', fontFamily: 'monospace', color: '#888'}}>Hash: {nForm.firma_hash}</span>
                                                    </div>
                                                )}

                                                <div style={{display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px'}}>
                                                    {['evolucion', 'evaluacion_signos', 'procedimiento_tecnica', 'material_agujas', 'resultado_tolerancia', 'plan_indicaciones'].map(key => (
                                                        <div key={key}>
                                                            <label style={{display: 'block', color: 'var(--accent)', fontSize: '0.85rem', marginBottom: '5px', fontWeight: 'bold'}}>{t(key.replace(/_([a-z])/g, (g) => g[1].toUpperCase()))}</label>
                                                            <textarea value={nForm[key]} onChange={(e) => setNForm({...nForm, [key]: e.target.value})} disabled={nForm.estado === 'firmada'} style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', resize: 'vertical', minHeight: '80px', opacity: nForm.estado === 'firmada' ? 0.7 : 1}} />
                                                        </div>
                                                    ))}
                                                </div>

                                                {nForm.estado !== 'firmada' ? (
                                                    <div style={{display: 'flex', gap: '10px', marginTop: '30px'}}>
                                                        <button className="btn-action" onClick={() => guardarNota(false)} style={{flex: 1, padding: '15px', background: 'var(--bg-lighter)', color: 'white', border: '1px solid var(--border-color)'}}><i className="fa-solid fa-save"></i> {t('guardarBorrador')}</button>
                                                        <button className="pay-btn" onClick={() => guardarNota(true)} style={{flex: 1, padding: '15px', background: '#0d47a1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold'}}><i className="fa-solid fa-lock"></i> {t('firmar')}</button>
                                                    </div>
                                                ) : (
                                                    <div style={{borderTop: '1px dashed var(--border-color)', paddingTop: '20px'}}>
                                                        <h4 style={{color: '#ffb300', marginBottom: '15px'}}><i className="fa-solid fa-file-pen"></i> {t('adendas')}</h4>
                                                        
                                                        {adendasActivas.map(adenda => (
                                                            <div key={adenda.id} style={{background: 'rgba(255, 179, 0, 0.1)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #ffb300', marginBottom: '10px'}}>
                                                                <p style={{margin: '0 0 5px 0', fontSize: '0.9rem', color: 'white'}}>{adenda.texto_adenda}</p>
                                                                <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>Firmada por {adenda.medico_nombre} el {new Date(adenda.fecha_registro).toLocaleString()} | Hash: {adenda.firma_hash}</span>
                                                            </div>
                                                        ))}

                                                        <div style={{marginTop: '15px'}}>
                                                            <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px', display: 'block'}}>{t('redactarAdenda')}</label>
                                                            <textarea value={nuevaAdenda} onChange={e => setNuevaAdenda(e.target.value)} placeholder="Escribe la fe de erratas o corrección aquí..." style={{width: '100%', padding: '10px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', minHeight: '60px', marginBottom: '10px'}} />
                                                            <button className="btn-action" onClick={firmarAdenda} style={{background: '#ffb300', color: 'black', fontWeight: 'bold', width: '100%'}}><i className="fa-solid fa-signature"></i> {t('firmarAdenda')}</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{textAlign: 'center', color: 'var(--text-muted)', marginTop: '100px'}}>
                                                <i className="fa-solid fa-hand-pointer fa-2x" style={{marginBottom: '15px', display: 'block'}}></i>
                                                Selecciona una nota de la izquierda o crea una nueva.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* PESTAÑA 3: CONSENTIMIENTOS INFORMADOS */}
                            {tabActiva === 'consentimientos' && (
                                <div style={{maxWidth: '800px', margin: '0 auto'}}>
                                    {vistaConsentimiento === 'lista' ? (
                                        <>
                                            <button className="btn-action btn-primary" onClick={() => setVistaConsentimiento('nuevo')} style={{marginBottom: '20px', padding: '12px 20px'}}><i className="fa-solid fa-file-signature"></i> {t('nuevoConsentimiento')}</button>
                                            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                                {consentimientos.length === 0 ? (
                                                    <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: '40px', background: 'var(--bg-dark)', borderRadius: '8px'}}>No hay consentimientos registrados.</div>
                                                ) : (
                                                    consentimientos.map(c => (
                                                        <div key={c.id} style={{background: 'var(--bg-panel)', padding: '20px', borderTop: '1px solid var(--success)', borderRight: '1px solid var(--success)', borderBottom: '1px solid var(--success)', borderLeft: '4px solid var(--success)', borderRadius: '8px'}}>
                                                            <h4 style={{margin: '0 0 10px 0', color: 'white'}}><i className="fa-solid fa-check-circle" style={{color: 'var(--success)'}}></i> {c.tipo_procedimiento}</h4>
                                                            <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '15px'}}>"{c.texto_legal}"</p>
                                                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', color: 'white'}}>
                                                                <div><strong>Paciente Acepta:</strong> SÍ</div>
                                                                <div><strong>Médico Tratante:</strong> {c.medico_nombre}</div>
                                                                <div><strong>Testigo 1:</strong> {c.testigo_1_nombre}</div>
                                                                <div><strong>Testigo 2:</strong> {c.testigo_2_nombre}</div>
                                                            </div>
                                                            <div style={{marginTop: '15px', fontSize: '0.7rem', color: '#888', fontFamily: 'monospace'}}>Fecha: {new Date(c.fecha_firma).toLocaleString()} | Hash: {c.firma_hash}</div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                                            <h3 style={{marginBottom: '20px', color: 'white'}}><i className="fa-solid fa-scale-balanced" style={{color: 'var(--accent)'}}></i> Consentimiento Oficial</h3>
                                            
                                            <div style={{background: 'var(--bg-dark)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px'}}>
                                                <h4 style={{margin: '0 0 10px 0', color: '#00b0ff'}}>Acupuntura Humana y Métodos Relacionados</h4>
                                                <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5'}}>{t('textoLegalAcupuntura')}</p>
                                            </div>

                                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px'}}>
                                                <div>
                                                    <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('testigo1')} *</label>
                                                    <input type="text" value={cForm.testigo_1} onChange={e => setCForm({...cForm, testigo_1: e.target.value})} style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                                                </div>
                                                <div>
                                                    <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('testigo2')} *</label>
                                                    <input type="text" value={cForm.testigo_2} onChange={e => setCForm({...cForm, testigo_2: e.target.value})} style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                                                </div>
                                            </div>

                                            <label style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'rgba(46, 125, 50, 0.1)', padding: '15px', borderRadius: '8px', border: '1px dashed var(--success)', marginBottom: '25px'}}>
                                                <input type="checkbox" checked={cForm.acepta} onChange={e => setCForm({...cForm, acepta: e.target.checked})} style={{width: '20px', height: '20px'}} />
                                                <span style={{color: 'white', fontWeight: 'bold'}}>{t('pacienteAcepta')}</span>
                                            </label>

                                            <div style={{display: 'flex', gap: '10px'}}>
                                                <button className="btn-action" onClick={() => setVistaConsentimiento('lista')} style={{flex: 1, padding: '15px', background: 'var(--bg-lighter)', color: 'white', border: '1px solid var(--border-color)'}}>Cancelar</button>
                                                <button className="pay-btn" onClick={generarConsentimiento} style={{flex: 2, padding: '15px', background: '#0d47a1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold'}}><i className="fa-solid fa-file-signature"></i> {t('firmarConsentimiento')}</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </>
                ) : (
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)'}}>
                        <i className="fa-solid fa-user-doctor fa-4x" style={{marginBottom: '20px', opacity: 0.5}}></i>
                        <h2>Selecciona un paciente del directorio</h2>
                        <p>Para visualizar o redactar su historia clínica y notas de evolución.</p>
                    </div>
                )}
            </div>

            {/* MODAL DE ALTA RÁPIDA (EXCLUSIVO MÉDICOS) */}
            {showNewPatientModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', width: '450px', border: '1px solid var(--border-color)'}}>
                        <h3 style={{marginBottom: '20px', color: 'white'}}><i className="fa-solid fa-user-plus" style={{color: 'var(--accent)'}}></i> Alta Rápida de Paciente</h3>
                        <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px'}}>Campos mínimos requeridos por norma. Recepción puede completar el resto después.</p>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px'}}>
                            <div>
                                <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px'}}>Nombre Completo *</label>
                                <input type="text" value={npForm.nombre} onChange={e => setNpForm({...npForm, nombre: e.target.value})} style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                            </div>
                            <div>
                                <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px'}}>Teléfono *</label>
                                <input type="text" value={npForm.telefono} onChange={e => setNpForm({...npForm, telefono: e.target.value})} style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                            </div>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                                <div>
                                    <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px'}}>Fecha Nac. *</label>
                                    <input type="date" value={npForm.fecha_nacimiento} onChange={e => setNpForm({...npForm, fecha_nacimiento: e.target.value})} style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                                </div>
                                <div>
                                    <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px'}}>Sexo *</label>
                                    <select value={npForm.sexo} onChange={e => setNpForm({...npForm, sexo: e.target.value})} style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                                        <option value="">-- Seleccionar --</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div style={{display: 'flex', gap: '10px'}}>
                            <button className="btn-action" onClick={() => setShowNewPatientModal(false)} style={{flex: 1, padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)'}}>Cancelar</button>
                            <button className="btn-action btn-primary" onClick={guardarPacienteRapido} style={{flex: 1, padding: '12px', fontWeight: 'bold'}}><i className="fa-solid fa-save"></i> Guardar y Abrir</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL HOJA DE REFERENCIA (TRASLADO) */}
            {showReferenciaModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', width: '500px', border: '1px solid #e65100'}}>
                        <h3 style={{marginBottom: '20px', color: 'white'}}><i className="fa-solid fa-truck-medical" style={{color: '#e65100'}}></i> Generar Hoja de Referencia</h3>
                        <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px'}}>Este documento oficial ampara el traslado o envío del paciente a otro hospital.</p>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px'}}>
                            <div>
                                <label style={{display: 'block', fontSize: '0.8rem', color: '#e65100', marginBottom: '5px', fontWeight: 'bold'}}>{t('hospitalReceptor')} *</label>
                                <input type="text" value={rForm.receptor} onChange={e => setRForm({...rForm, receptor: e.target.value})} placeholder="Ej. Hospital General..." style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                            </div>
                            <div>
                                <label style={{display: 'block', fontSize: '0.8rem', color: '#e65100', marginBottom: '5px', fontWeight: 'bold'}}>{t('impresionDiagnostica')} *</label>
                                <textarea value={rForm.diagnostico} onChange={e => setRForm({...rForm, diagnostico: e.target.value})} placeholder="Ej. Crisis Hipertensiva..." style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', resize: 'vertical', minHeight: '60px'}} />
                            </div>
                            <div>
                                <label style={{display: 'block', fontSize: '0.8rem', color: '#e65100', marginBottom: '5px', fontWeight: 'bold'}}>{t('motivoTraslado')} *</label>
                                <textarea value={rForm.motivo} onChange={e => setRForm({...rForm, motivo: e.target.value})} placeholder="Ej. Requiere valoración cardiológica urgente..." style={{width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', resize: 'vertical', minHeight: '60px'}} />
                            </div>
                        </div>

                        <div style={{display: 'flex', gap: '10px'}}>
                            <button className="btn-action" onClick={() => setShowReferenciaModal(false)} style={{flex: 1, padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)'}}>Cancelar</button>
                            <button className="btn-action" onClick={generarPDFReferencia} style={{flex: 2, padding: '12px', background: '#e65100', color: 'white', border: 'none', fontWeight: 'bold'}}><i className="fa-solid fa-print"></i> Generar Documento</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}