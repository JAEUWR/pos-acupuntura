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

    // 🚀 HOJA DE REFERENCIA (IMPRESIÓN PURA: SE MANTIENE EN BLANCO Y NEGRO PARA IMPRESORA)
    const generarPDFReferencia = () => {
        if (!rForm.receptor || !rForm.motivo || !rForm.diagnostico) return alert('Debes llenar todos los datos de traslado.');
        
        const printWindow = window.open('', '_blank');
        let htmlContent = `
            <html><head><title>Hoja de Referencia - ${pacienteSeleccionado.num_expediente}</title>
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
        <div className="view-section active" style={{ display: 'flex', gap: '20px', overflow: 'hidden', height: '100%' }}>
            
            {/* 🚀 PANEL IZQUIERDO: LISTA DE PACIENTES */}
            <div className="panel" style={{ width: '350px', flex: 'none', display: 'flex', flexDirection: 'column', padding: '25px 20px', borderRight: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                    <h3 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.2rem'}}><i className="fa-solid fa-users-medical" style={{color: 'var(--accent)', marginRight: '8px'}}></i> Mis Pacientes</h3>
                </div>

                <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                    <div style={{position: 'relative', flex: 1}}>
                        <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)'}}></i>
                        <input type="text" placeholder="Buscar paciente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{width: '100%', padding: '12px 12px 12px 35px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.9rem'}} />
                    </div>
                    <button className="btn-action btn-primary" onClick={() => setShowNewPatientModal(true)} style={{padding: '0 15px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.2)'}} title="Alta Rápida"><i className="fa-solid fa-user-plus"></i></button>
                </div>

                <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px'}}>
                    {pacientesFiltrados.map(p => {
                        const isSelected = pacienteSeleccionado?.id === p.id;
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
                                onMouseEnter={e => { if(!isSelected) e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onMouseLeave={e => { if(!isSelected) e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            >
                                <strong style={{display: 'block', color: isSelected ? 'var(--accent)' : 'var(--text-main)', fontSize: '0.95rem', marginBottom: '4px'}}>{p.nombre}</strong>
                                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--bg-panel)', padding: '2px 6px', borderRadius: '4px'}}>EXP: {p.num_expediente || 'S/E'}</span>
                            </div>
                        )
                    })}
                    {pacientesFiltrados.length === 0 && <div style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem'}}><i className="fa-regular fa-folder-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> No se encontraron resultados.</div>}
                </div>
            </div>

            {/* 🚀 PANEL DERECHO: ESCRITORIO CLÍNICO */}
            <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                {pacienteSeleccionado ? (
                    <>
                        {/* HEADER DEL PACIENTE */}
                        <div style={{padding: '25px 30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0}}>
                            <div>
                                <h1 style={{margin: '0 0 5px 0', color: 'var(--text-main)', fontSize: '1.6rem'}}>{pacienteSeleccionado.nombre}</h1>
                                <span style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>
                                    <i className="fa-solid fa-person-half-dress" style={{marginRight: '5px'}}></i> {pacienteSeleccionado.sexo} <span style={{margin: '0 10px', opacity: 0.3}}>|</span> 
                                    <i className="fa-regular fa-id-card" style={{marginRight: '5px'}}></i> {pacienteSeleccionado.curp || 'Sin CURP'} <span style={{margin: '0 10px', opacity: 0.3}}>|</span> 
                                    <span style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold'}}>{pacienteSeleccionado.num_expediente}</span>
                                </span>
                            </div>
                            <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                                {pacienteSeleccionado.alertas_clinicas?.filter(a => a.activa).length > 0 && (
                                    <div style={{background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.3)', borderLeft: '4px solid var(--primary-red)', padding: '10px 15px', borderRadius: '8px', maxWidth: '300px', maxHeight: '65px', overflowY: 'auto'}}>
                                        <strong style={{color: 'var(--primary-red)', fontSize: '0.75rem', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px'}}><i className="fa-solid fa-triangle-exclamation"></i> Alertas</strong>
                                        {pacienteSeleccionado.alertas_clinicas.filter(a => a.activa).map(a => <div key={a.id} style={{fontSize: '0.75rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={a.descripcion}>- {a.tipo_alerta}</div>)}
                                    </div>
                                )}
                                <button onClick={() => setShowReferenciaModal(true)} className="btn-action" style={{background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.3)', padding: '12px', borderRadius: '8px', transition: 'all 0.2s'}} title={t('hojaReferencia')} onMouseEnter={e => {e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = 'white';}} onMouseLeave={e => {e.currentTarget.style.background = 'rgba(234, 88, 12, 0.1)'; e.currentTarget.style.color = '#ea580c';}}>
                                    <i className="fa-solid fa-truck-medical fa-lg"></i>
                                </button>
                                <button onClick={generarPDF} className="btn-action" style={{background: 'var(--bg-lighter)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px'}} title={t('exportarPdf')}>
                                    <i className="fa-solid fa-file-pdf fa-lg"></i>
                                </button>
                            </div>
                        </div>

                        {/* PESTAÑAS (MODERN UNDERLINE STYLE) */}
                        <div style={{display: 'flex', gap: '30px', padding: '0 30px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', flexShrink: 0}}>
                            <button className="tab-btn" onClick={() => setTabActiva('historia')} style={{borderBottom: tabActiva === 'historia' ? '3px solid var(--accent)' : '3px solid transparent', color: tabActiva === 'historia' ? 'var(--accent)' : 'var(--text-muted)'}}><i className="fa-solid fa-file-medical" style={{marginRight: '8px'}}></i> {t('historiaClinica')}</button>
                            <button className="tab-btn" onClick={() => setTabActiva('evolucion')} style={{borderBottom: tabActiva === 'evolucion' ? '3px solid var(--accent)' : '3px solid transparent', color: tabActiva === 'evolucion' ? 'var(--accent)' : 'var(--text-muted)'}}><i className="fa-solid fa-stethoscope" style={{marginRight: '8px'}}></i> {t('notasEvolucion')}</button>
                            <button className="tab-btn" onClick={() => setTabActiva('consentimientos')} style={{borderBottom: tabActiva === 'consentimientos' ? '3px solid var(--accent)' : '3px solid transparent', color: tabActiva === 'consentimientos' ? 'var(--accent)' : 'var(--text-muted)'}}><i className="fa-solid fa-file-signature" style={{marginRight: '8px'}}></i> {t('consentimientos')}</button>
                        </div>

                        {/* ÁREA DE TRABAJO SCROLLEABLE */}
                        <div style={{flex: 1, overflowY: 'auto', padding: '30px', background: 'var(--bg-main)'}}>
                            
                            {/* PESTAÑA 1: HISTORIA CLÍNICA */}
                            {tabActiva === 'historia' && (
                                <div style={{maxWidth: '850px', margin: '0 auto', background: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                                    {historia?.estado === 'firmada' && (
                                        <div style={{background: 'rgba(22, 163, 74, 0.05)', border: '1px solid rgba(22, 163, 74, 0.3)', color: 'var(--success)', padding: '15px', borderRadius: '8px', marginBottom: '30px', textAlign: 'center'}}>
                                            <i className="fa-solid fa-lock"></i> {t('documentoFirmado')} por <strong style={{color: 'var(--text-main)'}}>{historia.medico_nombre}</strong> el {new Date(historia.fecha_firma).toLocaleString()}
                                            <br/><span style={{fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '5px', display: 'block'}}>Hash: {historia.firma_hash}</span>
                                        </div>
                                    )}

                                    <div style={{display: 'flex', flexDirection: 'column', gap: '25px'}}>
                                        {Object.keys(hForm).map(key => {
                                            if (['motivo_consulta', 'padecimiento_actual', 'antecedentes_familiares', 'antecedentes_personales', 'habitos_sustancias', 'medicamentos_actuales', 'gineco_obstetricos', 'interrogatorio_sistemas', 'exploracion_fisica', 'diagnostico_cie', 'valoracion_mtc', 'pronostico', 'plan_tratamiento'].includes(key)) {
                                                return (
                                                    <div key={key}>
                                                        <label style={{display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 'bold'}}>{t(key.replace(/_([a-z])/g, (g) => g[1].toUpperCase()))}</label>
                                                        <textarea 
                                                            value={hForm[key]} 
                                                            onChange={(e) => setHForm({...hForm, [key]: e.target.value})} 
                                                            disabled={historia?.estado === 'firmada'} 
                                                            style={{
                                                                width: '100%', padding: '15px', background: 'var(--bg-main)', color: 'var(--text-main)', 
                                                                border: '1px solid var(--border-color)', borderRadius: '8px', resize: 'vertical', minHeight: '100px', 
                                                                opacity: historia?.estado === 'firmada' ? 0.7 : 1, fontSize: '0.95rem', lineHeight: '1.5',
                                                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                                            }} 
                                                        />
                                                    </div>
                                                );
                                            }
                                        })}
                                    </div>

                                    {historia?.estado !== 'firmada' && (
                                        <div style={{display: 'flex', gap: '15px', marginTop: '40px', borderTop: '1px solid var(--border-color)', paddingTop: '30px'}}>
                                            <button className="btn-action" onClick={() => guardarHistoria(false)} style={{flex: 1, padding: '16px', background: 'var(--bg-lighter)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem'}}><i className="fa-regular fa-floppy-disk"></i> {t('guardarBorrador')}</button>
                                            <button className="btn-primary" onClick={() => guardarHistoria(true)} style={{flex: 1, padding: '16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}}><i className="fa-solid fa-lock"></i> {t('firmar')}</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PESTAÑA 2: NOTAS DE EVOLUCIÓN Y ADENDAS */}
                            {tabActiva === 'evolucion' && (
                                <div style={{display: 'flex', gap: '30px', height: '100%'}}>
                                    <div style={{width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                        <button className="btn-primary" onClick={crearNuevaNota} style={{padding: '15px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'}}><i className="fa-solid fa-plus"></i> {t('nuevaNota')}</button>
                                        <div style={{overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px'}}>
                                            {notas.map(nota => {
                                                const isActive = notaActiva === nota.id;
                                                const isFirmada = nota.estado === 'firmada';
                                                return (
                                                    <div key={nota.id} onClick={() => abrirNota(nota)} style={{padding: '15px', background: isActive ? 'var(--bg-panel)' : 'var(--bg-main)', border: '1px solid', borderColor: isActive ? 'var(--accent)' : 'var(--border-color)', borderLeft: isFirmada ? '4px solid var(--success)' : '4px solid #ffb300', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isActive ? 'var(--shadow-sm)' : 'none'}}>
                                                        <span style={{fontSize: '0.85rem', color: 'var(--text-main)', display: 'block', fontWeight: 'bold', marginBottom: '5px'}}>{new Date(nota.fecha_registro).toLocaleDateString()}</span>
                                                        <span style={{fontSize: '0.75rem', color: isFirmada ? 'var(--success)' : '#ffb300', background: isFirmada ? 'rgba(22, 163, 74, 0.1)' : 'rgba(255, 179, 0, 0.1)', padding: '2px 8px', borderRadius: '12px'}}>{nota.estado.toUpperCase()}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div style={{flex: 1, overflowY: 'auto'}}>
                                        {notaActiva ? (
                                            <div style={{maxWidth: '800px', background: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                                                {nForm.estado === 'firmada' && (
                                                    <div style={{background: 'rgba(22, 163, 74, 0.05)', border: '1px solid rgba(22, 163, 74, 0.3)', color: 'var(--success)', padding: '15px', borderRadius: '8px', marginBottom: '30px', textAlign: 'center'}}>
                                                        <i className="fa-solid fa-lock"></i> {t('documentoFirmado')} por <strong style={{color: 'var(--text-main)'}}>{nForm.medico_nombre}</strong> el {new Date(nForm.fecha_firma).toLocaleString()}
                                                        <br/><span style={{fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '5px', display: 'block'}}>Hash: {nForm.firma_hash}</span>
                                                    </div>
                                                )}

                                                <div style={{display: 'flex', flexDirection: 'column', gap: '25px', marginBottom: '40px'}}>
                                                    {['evolucion', 'evaluacion_signos', 'procedimiento_tecnica', 'material_agujas', 'resultado_tolerancia', 'plan_indicaciones'].map(key => (
                                                        <div key={key}>
                                                            <label style={{display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 'bold'}}>{t(key.replace(/_([a-z])/g, (g) => g[1].toUpperCase()))}</label>
                                                            <textarea value={nForm[key]} onChange={(e) => setNForm({...nForm, [key]: e.target.value})} disabled={nForm.estado === 'firmada'} style={{width: '100%', padding: '15px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', resize: 'vertical', minHeight: '100px', opacity: nForm.estado === 'firmada' ? 0.7 : 1, fontSize: '0.95rem', lineHeight: '1.5', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'}} />
                                                        </div>
                                                    ))}
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
                                                                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Firmada por <strong style={{color: 'var(--text-main)'}}>{adenda.medico_nombre}</strong> el {new Date(adenda.fecha_registro).toLocaleString()} <span style={{opacity: 0.5, margin: '0 5px'}}>|</span> <span style={{fontFamily: 'monospace'}}>Hash: {adenda.firma_hash}</span></span>
                                                            </div>
                                                        ))}

                                                        <div style={{marginTop: '25px', background: 'var(--bg-main)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)'}}>
                                                            <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'block', textTransform: 'uppercase', fontWeight: 'bold'}}>{t('redactarAdenda')}</label>
                                                            <textarea value={nuevaAdenda} onChange={e => setNuevaAdenda(e.target.value)} placeholder="Escribe la fe de erratas o corrección aquí..." style={{width: '100%', padding: '15px', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', minHeight: '80px', marginBottom: '15px', fontSize: '0.95rem'}} />
                                                            <button className="btn-action" onClick={firmarAdenda} style={{background: 'rgba(255, 179, 0, 0.1)', color: '#ea580c', border: '1px solid rgba(255, 179, 0, 0.3)', fontWeight: 'bold', width: '100%', padding: '12px', borderRadius: '8px', transition: 'all 0.2s'}} onMouseEnter={e => {e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = 'white';}} onMouseLeave={e => {e.currentTarget.style.background = 'rgba(255, 179, 0, 0.1)'; e.currentTarget.style.color = '#ea580c';}}><i className="fa-solid fa-signature"></i> {t('firmarAdenda')}</button>
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

                            {/* PESTAÑA 3: CONSENTIMIENTOS INFORMADOS */}
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
                                                        <div key={c.id} style={{background: 'var(--bg-main)', padding: '25px', border: '1px solid var(--border-color)', borderLeft: '5px solid var(--success)', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)'}}>
                                                            <h4 style={{margin: '0 0 15px 0', color: 'var(--text-main)', fontSize: '1.1rem'}}><i className="fa-solid fa-check-circle" style={{color: 'var(--success)', marginRight: '8px'}}></i> {c.tipo_procedimiento}</h4>
                                                            <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '20px', lineHeight: '1.5', background: 'var(--bg-panel)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>"{c.texto_legal}"</p>
                                                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '20px'}}>
                                                                <div><strong style={{color: 'var(--text-muted)'}}>Paciente Acepta:</strong> <span style={{color: 'var(--success)', fontWeight: 'bold'}}>SÍ</span></div>
                                                                <div><strong style={{color: 'var(--text-muted)'}}>Médico Tratante:</strong> {c.medico_nombre}</div>
                                                                <div><strong style={{color: 'var(--text-muted)'}}>Testigo 1:</strong> {c.testigo_1_nombre}</div>
                                                                <div><strong style={{color: 'var(--text-muted)'}}>Testigo 2:</strong> {c.testigo_2_nombre}</div>
                                                            </div>
                                                            <div style={{borderTop: '1px dashed var(--border-color)', paddingTop: '15px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between'}}>
                                                                <span>FECHA: {new Date(c.fecha_firma).toLocaleString()}</span>
                                                                <span>HASH: {c.firma_hash}</span>
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
                                                <h4 style={{margin: '0 0 15px 0', color: 'var(--accent)', fontSize: '1.1rem'}}>Acupuntura Humana y Métodos Relacionados</h4>
                                                <p style={{fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.6'}}>{t('textoLegalAcupuntura')}</p>
                                            </div>

                                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px'}}>
                                                <div>
                                                    <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', fontWeight: 'bold'}}>{t('testigo1')} *</label>
                                                    <input type="text" value={cForm.testigo_1} onChange={e => setCForm({...cForm, testigo_1: e.target.value})} style={{width: '100%', padding: '15px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px'}} />
                                                </div>
                                                <div>
                                                    <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', fontWeight: 'bold'}}>{t('testigo2')} *</label>
                                                    <input type="text" value={cForm.testigo_2} onChange={e => setCForm({...cForm, testigo_2: e.target.value})} style={{width: '100%', padding: '15px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px'}} />
                                                </div>
                                            </div>

                                            <label style={{display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', background: 'rgba(22, 163, 74, 0.05)', padding: '20px', borderRadius: '10px', border: '1px dashed var(--success)', marginBottom: '35px', transition: 'all 0.2s'}} onMouseEnter={e => e.currentTarget.style.background = 'rgba(22, 163, 74, 0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(22, 163, 74, 0.05)'}>
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

            {/* MODAL DE ALTA RÁPIDA (EXCLUSIVO MÉDICOS) */}
            {showNewPatientModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '500px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '10px', color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-user-plus" style={{color: 'var(--accent)', marginRight: '10px'}}></i> Alta Rápida</h3>
                        <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '30px'}}>Campos mínimos requeridos por norma. Recepción puede completar el resto después.</p>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '35px'}}>
                            <div>
                                <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>Nombre Completo *</label>
                                <input type="text" value={npForm.nombre} onChange={e => setNpForm({...npForm, nombre: e.target.value})} style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px'}} />
                            </div>
                            <div>
                                <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>Teléfono *</label>
                                <input type="text" value={npForm.telefono} onChange={e => setNpForm({...npForm, telefono: e.target.value})} style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px'}} />
                            </div>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                                <div>
                                    <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>Fecha Nac. *</label>
                                    <input type="date" value={npForm.fecha_nacimiento} onChange={e => setNpForm({...npForm, fecha_nacimiento: e.target.value})} style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer'}} />
                                </div>
                                <div>
                                    <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>Sexo *</label>
                                    <select value={npForm.sexo} onChange={e => setNpForm({...npForm, sexo: e.target.value})} style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer'}}>
                                        <option value="">-- Seleccionar --</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div style={{display: 'flex', gap: '15px'}}>
                            <button className="btn-action" onClick={() => setShowNewPatientModal(false)} style={{flex: 1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold'}}>Cancelar</button>
                            <button className="btn-primary" onClick={guardarPacienteRapido} style={{flex: 1, padding: '16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}}><i className="fa-solid fa-save"></i> Crear Expediente</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL HOJA DE REFERENCIA (TRASLADO) */}
            {showReferenciaModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '550px', border: '1px solid rgba(234, 88, 12, 0.5)', boxShadow: '0 10px 30px rgba(234, 88, 12, 0.15)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '10px', color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-truck-medical" style={{color: '#ea580c', marginRight: '10px'}}></i> Generar Hoja de Referencia</h3>
                        <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '30px'}}>Este documento oficial ampara el traslado o envío del paciente a otro hospital para urgencias o estudios.</p>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '35px'}}>
                            <div>
                                <label style={{display: 'block', fontSize: '0.85rem', color: '#ea580c', marginBottom: '8px', fontWeight: 'bold'}}>{t('hospitalReceptor')} *</label>
                                <input type="text" value={rForm.receptor} onChange={e => setRForm({...rForm, receptor: e.target.value})} placeholder="Ej. Hospital General..." style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px'}} />
                            </div>
                            <div>
                                <label style={{display: 'block', fontSize: '0.85rem', color: '#ea580c', marginBottom: '8px', fontWeight: 'bold'}}>{t('impresionDiagnostica')} *</label>
                                <textarea value={rForm.diagnostico} onChange={e => setRForm({...rForm, diagnostico: e.target.value})} placeholder="Ej. Crisis Hipertensiva..." style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', resize: 'vertical', minHeight: '80px'}} />
                            </div>
                            <div>
                                <label style={{display: 'block', fontSize: '0.85rem', color: '#ea580c', marginBottom: '8px', fontWeight: 'bold'}}>{t('motivoTraslado')} *</label>
                                <textarea value={rForm.motivo} onChange={e => setRForm({...rForm, motivo: e.target.value})} placeholder="Ej. Requiere valoración cardiológica urgente..." style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', resize: 'vertical', minHeight: '80px'}} />
                            </div>
                        </div>

                        <div style={{display: 'flex', gap: '15px'}}>
                            <button className="btn-action" onClick={() => setShowReferenciaModal(false)} style={{flex: 1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold'}}>Cancelar</button>
                            <button className="btn-action" onClick={generarPDFReferencia} style={{flex: 2, padding: '16px', background: '#ea580c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)'}}><i className="fa-solid fa-print"></i> Generar Documento</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ESTILOS INTERNOS DE PESTAÑAS */}
            <style jsx>{`
                .tab-btn {
                    padding: 20px 10px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 0.95rem;
                    font-weight: bold;
                    transition: all 0.2s ease;
                }
                .tab-btn:hover { color: var(--text-main) !important; }
            `}</style>
        </div>
    );
}