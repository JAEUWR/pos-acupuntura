'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function EscritorioMedico({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage();
    
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    // 🚀 BLINDAJE ANTI-DOBLE CLIC
    const isProcessingRef = useRef(false);
    const [isProcessingBtn, setIsProcessingBtn] = useState(false);

    const formatDate = (dateString) => {
        if (!isMounted || !dateString) return '';
        return new Date(dateString).toLocaleString();
    };

    const formatDateOnly = (dateString) => {
        if (!isMounted || !dateString) return '';
        return new Date(dateString).toLocaleDateString();
    };

    const calcularEdad = (fechaNacimiento) => {
        if (!fechaNacimiento) return '';
        const hoy = new Date();
        const nacimiento = new Date(fechaNacimiento);
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const m = hoy.getMonth() - nacimiento.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
        return `${edad} ${t('edadAnos') || 'años'}`;
    };

    const [pacientes, setPacientes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
    const [tabActiva, setTabActiva] = useState('historia'); 
    
    const [activeSucursalTab, setActiveSucursalTab] = useState('todas');
    const [showLegacyClients, setShowLegacyClients] = useState(false);
    const [sucursalesDB, setSucursalesDB] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const [showReferenciaModal, setShowReferenciaModal] = useState(false);
    const [rForm, setRForm] = useState({ receptor: '', motivo: '', diagnostico: '' });

    const [historia, setHistoria] = useState(null);
    const [hForm, setHForm] = useState({
        exploracion_fisica: '', diagnostico_cie: '', mtc_pulso_lengua: '', pronostico: '', plan_tratamiento: ''
    });
    const [datosRecepcion, setDatosRecepcion] = useState(null); 

    const [pulsoMatrix, setPulsoMatrix] = useState({});
    const [lenguaMatrix, setLenguaMatrix] = useState({});
    const [signosVitales, setSignosVitales] = useState({ fc: '', fr: '', ta: '', temp: '' });

    const [notas, setNotas] = useState([]);
    const [notaActiva, setNotaActiva] = useState(null);
    const [nForm, setNForm] = useState({ 
        evolucion: '', procedimiento_tecnica: '', plan_indicaciones: '',
        puntos_acupuntura: '', tiempo_retencion_minutos: '', diagnostico_sesion: '', sesiones_requeridas: '' 
    });
    
    const [pulsoMatrixNota, setPulsoMatrixNota] = useState({});
    const [lenguaMatrixNota, setLenguaMatrixNota] = useState({});
    const [signosVitalesNota, setSignosVitalesNota] = useState({ fc: '', fr: '', ta: '', temp: '' });

    const [adendasActivas, setAdendasActivas] = useState([]);
    const [nuevaAdenda, setNuevaAdenda] = useState('');

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[(branch || '').toLowerCase()] || 1;

    const formatUpperCase = (str) => {
        if (!str) return '';
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

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
            const { data: hData } = await supabase.from('historia_clinica').select('*').eq('paciente_id', pacienteSeleccionado.id).maybeSingle();
            
            if (hData) { 
                setHistoria(hData); 
                setHForm({
                    exploracion_fisica: hData.exploracion_fisica || '',
                    diagnostico_cie: hData.diagnostico_cie || '',
                    mtc_pulso_lengua: hData.mtc_pulso_lengua || '',
                    pronostico: hData.pronostico || '',
                    plan_tratamiento: hData.plan_tratamiento || ''
                }); 
                setDatosRecepcion({
                    motivo: hData.motivo_consulta || '',
                    padecimiento: hData.padecimiento_actual || '',
                    personales: hData.antecedentes_personales || '',
                    familiares: hData.antecedentes_familiares || '',
                    habitos: `${hData.habitos_sustancias || ''} ${hData.habitos_sueno || ''}`,
                    medicamentos: hData.medicamentos_actuales || '',
                    gineco: hData.gineco_obstetricos || ''
                });
            } else { 
                setHistoria(null); 
                setHForm({ exploracion_fisica: '', diagnostico_cie: '', mtc_pulso_lengua: '', pronostico: '', plan_tratamiento: '' }); 
                setDatosRecepcion(null);
                setPulsoMatrix({});
                setLenguaMatrix({});
                setSignosVitales({ fc: '', fr: '', ta: '', temp: '' });
            }

            const { data: nData } = await supabase.from('notas_evolucion').select('*').eq('paciente_id', pacienteSeleccionado.id).order('fecha_registro', { ascending: false });
            if (nData) { setNotas(nData); setNotaActiva(null); }
            
            setTabActiva('historia');
        };
        fetchExpediente();
    }, [pacienteSeleccionado]);

    // 🚀 CHIPS INTELIGENTES DE HISTORIA CLÍNICA
    const pronosticosRapidos = [
        { id: 'favorable', icon: 'fa-thumbs-up', label: t('btnPronosticoFavorable') || 'Favorable', text: t('txtPronosticoFavorable') || 'Bueno para la vida y la función. Evolución clínica favorable esperada bajo estricto apego al plan terapéutico.', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
        { id: 'reservado', icon: 'fa-scale-unbalanced', label: t('btnPronosticoReservado') || 'Reservado', text: t('txtPronosticoReservado') || 'Pronóstico reservado a evolución clínica y respuesta individual al tratamiento instaurado.', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
        { id: 'malo', icon: 'fa-heart-crack', label: t('btnPronosticoDesfavorable') || 'Desfavorable', text: t('txtPronosticoDesfavorable') || 'Pronóstico desfavorable debido a cronicidad y comorbilidades. Se prioriza control sintomático.', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
    ];

    const planesRapidos = [
        { id: 'dolor', icon: 'fa-person-walking-with-cane', label: t('btnPlanDolor') || 'Manejo del Dolor', text: t('txtPlanDolor') || 'Esquema de neuromodulación percutánea y termoterapia orientado a analgesia y rehabilitación funcional.', color: '#0288d1', bg: 'rgba(2, 136, 209, 0.1)' },
        { id: 'metabolico', icon: 'fa-fire-flame-curved', label: t('btnPlanMetabolico') || 'Metabólico / Estrés', text: t('txtPlanMetabolico') || 'Acupuntura orientada a modulación simpático-parasimpática, regulación metabólica y manejo del estrés.', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.1)' },
        { id: 'integral', icon: 'fa-spa', label: t('btnPlanIntegral') || 'Manejo Integral', text: t('txtPlanIntegral') || 'Sesiones enfocadas en regulación sistémica general, reequilibrio energético y prevención.', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.1)' }
    ];

    // 🚀 CHIPS INTELIGENTES DE NOTAS DE EVOLUCIÓN
    const chipsEvolucion = [
        { id: 'mejoria', label: t('chipMejoria') || 'Refiere mejoría general' },
        { id: 'sinDolor', label: t('chipSinDolor') || 'Dolor disminuido/ausente' },
        { id: 'movilidad', label: t('chipMovilidad') || 'Mejor rango de movilidad' },
        { id: 'sinCambios', label: t('chipSinCambios') || 'Sin cambios significativos' },
        { id: 'buenaTol', label: t('chipBuenaTol') || 'Toleró bien el tratamiento' }
    ];

    const chipsProcedimiento = [
        { id: 'acuSist', label: t('chipAcuSist') || 'Acupuntura Sistémica' },
        { id: 'electro', label: t('chipElectro') || 'Electroacupuntura' },
        { id: 'ventosas', label: t('chipVentosas') || 'Ventosas' },
        { id: 'moxa', label: t('chipMoxa') || 'Moxibustión' },
        { id: 'auriculo', label: t('chipAuriculo') || 'Auriculoterapia' },
        { id: 'sangria', label: t('chipSangria') || 'Sangría / Microsangría' }
    ];

    const inyectarTextoMedico = (campo, texto) => {
        setHForm(prev => {
            const actual = prev[campo]?.trim();
            const nuevoTexto = actual ? `${actual}\n${texto}` : texto;
            return { ...prev, [campo]: nuevoTexto };
        });
    };

    const inyectarTextoNota = (campo, texto) => {
        setNForm(prev => {
            const actual = prev[campo]?.trim();
            const nuevoTexto = actual ? `${actual}, ${texto}` : texto;
            return { ...prev, [campo]: nuevoTexto };
        });
    };

    const posicionesPulso = [
        { id: 'iCun', label: t('izqCun') || 'Izq. Cun (Corazón)', color: '#ef4444' },
        { id: 'iGuan', label: t('izqGuan') || 'Izq. Guan (Hígado)', color: '#10b981' },
        { id: 'iChi', label: t('izqChi') || 'Izq. Chi (Riñón)', color: '#3b82f6' },
        { id: 'dCun', label: t('derCun') || 'Der. Cun (Pulmón)', color: '#94a3b8' },
        { id: 'dGuan', label: t('derGuan') || 'Der. Guan (Bazo/Estó.)', color: '#f59e0b' },
        { id: 'dChi', label: t('derChi') || 'Der. Chi (Riñón/Ming.)', color: '#3b82f6' }
    ];
    
    const tiposPulsoData = [
        { id: 'flotante', label: t('flotante') || 'Flotante' },
        { id: 'hundido', label: t('hundido') || 'Hundido' },
        { id: 'rapido', label: t('rapido') || 'Rápido' },
        { id: 'lento', label: t('lento') || 'Lento' },
        { id: 'fuerte', label: t('fuerte') || 'Fuerte' },
        { id: 'debil', label: t('debil') || 'Débil' },
        { id: 'cuerda', label: t('cuerda') || 'Cuerda' },
        { id: 'resbaladizo', label: t('resbaladizo') || 'Resbaladizo' },
        { id: 'fino', label: t('fino') || 'Fino' }
    ];

    const zonasLengua = [
        { id: 'gen', label: t('generalCuerpo') || 'General / Cuerpo', color: '#64748b' },
        { id: 'pun', label: t('punta') || 'Punta (Corazón)', color: '#ef4444' },
        { id: 'fre', label: t('frentePulmon') || 'Frente (Pulmón)', color: '#94a3b8' },
        { id: 'cen', label: t('centro') || 'Centro (Bazo/Estó.)', color: '#f59e0b' },
        { id: 'lad', label: t('lados') || 'Lados (Hígado)', color: '#10b981' },
        { id: 'rai', label: t('raiz') || 'Raíz (Riñón)', color: '#3b82f6' }
    ];
    
    const attrsLenguaData = [
        { id: 'palida', label: t('palida') || 'Pálida' },
        { id: 'roja', label: t('roja') || 'Roja' },
        { id: 'purpura', label: t('purpura') || 'Púrpura' },
        { id: 'hinchada', label: t('hinchadaDientes') || 'Hinchada / Dientes' },
        { id: 'gruesa', label: t('saburraGruesa') || 'Saburra Gruesa' },
        { id: 'amarilla', label: t('saburraAmarilla') || 'Saburra Amarilla' },
        { id: 'blanca', label: t('saburraBlanca') || 'Saburra Blanca' },
        { id: 'seca', label: t('secaSinJinye') || 'Seca / Sin JinYe' },
        { id: 'pelada', label: t('pelada') || 'Pelada' }
    ];

    const redactarHallazgosMTCh = (isNota = false) => {
        let textoFinal = '';
        const matrixPulso = isNota ? pulsoMatrixNota : pulsoMatrix;
        const matrixLengua = isNota ? lenguaMatrixNota : lenguaMatrix;
        const signosVit = isNota ? signosVitalesNota : signosVitales;
        
        const signos = [];
        if (signosVit.fc) signos.push(`FC: ${signosVit.fc} lpm`);
        if (signosVit.fr) signos.push(`FR: ${signosVit.fr} rpm`);
        if (signosVit.ta) signos.push(`TA: ${signosVit.ta} mmHg`);
        if (signosVit.temp) signos.push(`Temp: ${signosVit.temp} °C`);
        
        if (signos.length > 0) {
            if (isNota) {
                setNForm(prev => ({ ...prev, evolucion: (prev.evolucion + `\nSignos Vitales: ${signos.join(', ')}.`).trim() }));
            } else {
                setHForm(prev => ({ ...prev, exploracion_fisica: (prev.exploracion_fisica + `\nSignos Vitales: ${signos.join(', ')}.`).trim() }));
            }
        }

        let tienePulso = false;
        let txtPulso = `${t('diagnosticoDePulso') || '【 DIAGNÓSTICO DE PULSO 】'}\n`;
        posicionesPulso.forEach(pos => {
            const activos = tiposPulsoData.filter(tipo => matrixPulso[`${pos.id}-${tipo.id}`]).map(t => t.label);
            if (activos.length > 0) {
                tienePulso = true;
                txtPulso += `• ${pos.label}: ${t('pulso') || 'Pulso'} ${activos.join(', ').toLowerCase()}.\n`;
            }
        });

        let tieneLengua = false;
        let txtLengua = `\n${t('diagnosticoDeLengua') || '【 DIAGNÓSTICO DE LENGUA 】'}\n`;
        zonasLengua.forEach(zona => {
            const activos = attrsLenguaData.filter(attr => matrixLengua[`${zona.id}-${attr.id}`]).map(a => a.label);
            if (activos.length > 0) {
                tieneLengua = true;
                txtLengua += `• ${zona.label}: ${activos.join(', ')}.\n`;
            }
        });

        if (tienePulso) textoFinal += txtPulso;
        if (tieneLengua) textoFinal += txtLengua;

        if (textoFinal) {
            if (isNota) {
                setNForm(prev => ({ ...prev, evolucion: (prev.evolucion + '\n\n' + textoFinal).trim() }));
            } else {
                setHForm(prev => ({ ...prev, mtc_pulso_lengua: (prev.mtc_pulso_lengua + '\n\n' + textoFinal).trim() }));
            }
            alert(t('hallazgosExito') || 'Hallazgos redactados exitosamente en la caja de texto inferior.');
        } else if (signos.length === 0) {
            alert(t('hallazgosFallo') || 'Marca al menos una casilla de pulso o lengua para generar la redacción.');
        }
    };

    const toggleMatrix = (matrixObj, setMatrixObj, key) => {
        setMatrixObj(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const guardarHistoria = async (firmar = false) => {
        if (isProcessingRef.current) return;

        if (firmar) {
            let camposFaltantes = [];
            
            if (!hForm.mtc_pulso_lengua?.trim()) camposFaltantes.push(`• ${t('redaccionDiagnosticoMTC') || 'Redacción Diagnóstico MTC'}`);
            if (!hForm.diagnostico_cie?.trim()) camposFaltantes.push(`• ${t('diagnosticoCie') || 'Diagnóstico Clínico (CIE)'}`);
            if (!hForm.pronostico?.trim()) camposFaltantes.push(`• ${t('pronostico') || 'Pronóstico'}`);
            if (!hForm.plan_tratamiento?.trim()) camposFaltantes.push(`• ${t('planTratamientoPuntos') || 'Plan de Tratamiento'}`);

            if (camposFaltantes.length > 0) {
                const prefixError = t('alertaFaltanCamposFirma') || '⚠️ No puedes firmar el expediente. Te faltan llenar los siguientes campos obligatorios:';
                return alert(`${prefixError}\n\n${camposFaltantes.join('\n')}`);
            }

            if (!window.confirm(t('confirmarFirmaHistoria') || '¿Estás seguro de firmar? El documento quedará bloqueado e inalterable por ley.')) return;
        }

        isProcessingRef.current = true;
        setIsProcessingBtn(true);

        try {
            const payload = {
                paciente_id: pacienteSeleccionado.id, medico_nombre: perfilActual?.nombre || 'Médico', ...hForm,
                estado: firmar ? 'firmada' : 'borrador', fecha_firma: firmar ? new Date().toISOString() : null, 
                firma_hash: firmar ? Math.random().toString(36).substring(2, 15) + Date.now().toString(36) : null
            };

            if (historia?.id) { 
                await supabase.from('historia_clinica').update(payload).eq('id', historia.id); 
            } else { 
                const { data } = await supabase.from('historia_clinica').insert([payload]).select(); 
                if (data) setHistoria(data[0]); 
            }
            
            alert(firmar ? t('documentoFirmadoExito') || 'Documento firmado con éxito' : t('guardarBorradorExito') || 'Borrador Guardado con éxito');
            if (firmar) setHistoria({ ...historia, ...payload });

        } catch (error) {
            console.error(error);
        } finally {
            isProcessingRef.current = false;
            setIsProcessingBtn(false);
        }
    };

    const abrirNota = async (nota) => {
        setNotaActiva(nota.id);
        setNForm(nota);
        setNuevaAdenda('');
        
        setPulsoMatrixNota({});
        setLenguaMatrixNota({});
        setSignosVitalesNota({ fc: '', fr: '', ta: '', temp: '' });
        
        if (nota.estado === 'firmada') {
            const { data } = await supabase.from('adendas').select('*').eq('nota_id', nota.id).order('fecha_registro', { ascending: true });
            if (data) setAdendasActivas(data);
        } else {
            setAdendasActivas([]);
        }
    };

    const crearNuevaNota = () => { 
        setNotaActiva('nueva'); 
        setNForm({ evolucion: '', procedimiento_tecnica: '', plan_indicaciones: '', puntos_acupuntura: '', tiempo_retencion_minutos: '', diagnostico_sesion: '', sesiones_requeridas: '' }); 
        
        setPulsoMatrixNota({});
        setLenguaMatrixNota({});
        setSignosVitalesNota({ fc: '', fr: '', ta: '', temp: '' });
    };

    const guardarNota = async (firmar = false) => {
        if (isProcessingRef.current) return;

        if (firmar) {
            let camposFaltantes = [];
            if (!nForm.evolucion?.trim()) camposFaltantes.push(`• ${t('evolucion') || 'Evolución y Tolerancia'}`);
            if (!nForm.procedimiento_tecnica?.trim()) camposFaltantes.push(`• ${t('procedimientoTecnica') || 'Procedimiento Aplicado'}`);
            if (!nForm.diagnostico_sesion?.trim()) camposFaltantes.push(`• ${t('diagnosticoSesion') || 'Diagnóstico de la Sesión'}`);

            if (camposFaltantes.length > 0) {
                const prefixError = t('alertaFaltanCamposFirmaNota') || '⚠️ No puedes firmar la nota de evolución. Faltan los siguientes campos:';
                return alert(`${prefixError}\n\n${camposFaltantes.join('\n')}`);
            }

            if (!window.confirm(t('confirmarFirmaNota') || '¿Estás seguro de firmar esta nota? No podrá ser borrada ni alterada.')) return;
        }

        isProcessingRef.current = true;
        setIsProcessingBtn(true);

        try {
            const payload = {
                paciente_id: pacienteSeleccionado.id, sucursal_id: sucursalId, medico_nombre: perfilActual?.nombre || 'Médico', ...nForm,
                estado: firmar ? 'firmada' : 'borrador', fecha_firma: firmar ? new Date().toISOString() : null, 
                firma_hash: firmar ? Math.random().toString(36).substring(2, 15) + Date.now().toString(36) : null
            };

            if (notaActiva !== 'nueva') { 
                await supabase.from('notas_evolucion').update(payload).eq('id', notaActiva); 
            } else { 
                await supabase.from('notas_evolucion').insert([payload]); 
            }
            
            alert(firmar ? t('documentoFirmadoExito') || 'Nota firmada con éxito' : t('guardarBorradorExito') || 'Borrador Guardado con éxito');
            const { data } = await supabase.from('notas_evolucion').select('*').eq('paciente_id', pacienteSeleccionado.id).order('fecha_registro', { ascending: false });
            if (data) { setNotas(data); setNotaActiva(null); }

        } catch(error) {
            console.error(error);
        } finally {
            isProcessingRef.current = false;
            setIsProcessingBtn(false);
        }
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

    const firmarAdenda = async () => {
        if (isProcessingRef.current) return;
        if (nuevaAdenda.trim().length < 10) return alert(t('alertaAdendaCorta') || 'La adenda debe ser clara y justificada.');
        if (!window.confirm(t('confirmarFirmaAdenda') || '¿Firmar y anexar esta adenda al expediente?')) return;

        isProcessingRef.current = true;
        setIsProcessingBtn(true);

        try {
            const payload = {
                nota_id: notaActiva, medico_nombre: perfilActual?.nombre || 'Médico', texto_adenda: nuevaAdenda.trim(),
                firma_hash: Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
            };

            const { data, error } = await supabase.from('adendas').insert([payload]).select();
            if (error) {
                alert(error.message);
                return;
            }

            setAdendasActivas([...adendasActivas, data[0]]);
            setNuevaAdenda('');
            alert(t('adendaFirmadaExito') || 'Adenda firmada y anexada exitosamente.');

        } finally {
            isProcessingRef.current = false;
            setIsProcessingBtn(false);
        }
    };

    const generarPDFReferencia = () => {
        if (!rForm.receptor || !rForm.motivo || !rForm.diagnostico) return alert(t('alertaHospitalReceptor') || 'Debes llenar todos los datos de traslado.');
        
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

    const pacientesFiltrados = pacientes.filter(p => {
        const isLegacy = p.codigo_expediente && p.codigo_expediente.includes('LEGACY');
        if (!showLegacyClients && isLegacy) return false;

        const busqueda = searchTerm.toLowerCase().trim();
        if (busqueda !== '') {
            return (p.nombre && p.nombre.toLowerCase().includes(busqueda)) || 
                   (p.telefono && p.telefono.includes(busqueda)) ||
                   (p.codigo_expediente && p.codigo_expediente.toLowerCase().includes(busqueda));
        }

        if (activeSucursalTab !== 'todas') {
            return p.sucursal_registro_id === activeSucursalTab;
        }

        return true;
    });

    return (
        <div className="view-section active" style={{ display: 'flex', gap: sidebarOpen ? '20px' : '0px', overflow: 'hidden', height: '100%', position: 'relative' }}>
            
            {/* 🚀 BOTÓN FLOTANTE PARA ABRIR DIRECTORIO */}
            <div 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                    position: 'absolute', left: sidebarOpen ? '380px' : '0px', top: '50%', transform: 'translateY(-50%)',
                    width: '24px', height: '60px', backgroundColor: 'var(--accent)', color: '#fff',
                    borderRadius: '0 30px 30px 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 50, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '4px 0px 10px rgba(0,0,0,0.15)'
                }}
                title={sidebarOpen ? (t('ocultarDirectorio') || 'Ocultar') : (t('mostrarDirectorio') || 'Mostrar')}
            >
                <i className={`fa-solid ${sidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'}`} style={{fontSize: '0.85rem'}}></i>
            </div>

            {/* 🚀 PANEL IZQUIERDO: DIRECTORIO MÉDICO */}
            <div className="panel" style={{ 
                width: sidebarOpen ? '380px' : '0px', flex: 'none', display: 'flex', flexDirection: 'column', 
                padding: sidebarOpen ? '25px 20px' : '0px', borderRight: sidebarOpen ? '1px solid var(--border-color)' : 'none', 
                borderRadius: sidebarOpen ? '16px' : '0px', boxShadow: sidebarOpen ? 'var(--shadow-sm)' : 'none', 
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', opacity: sidebarOpen ? 1 : 0, overflow: 'hidden'
            }}>
                <div style={{width: '340px', display: 'flex', flexDirection: 'column', height: '100%'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                        <h3 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.2rem'}}><i className="fa-solid fa-users-medical" style={{color: 'var(--accent)', marginRight: '8px'}}></i> {t('misPacientes') || 'Mis Pacientes'}</h3>
                    </div>

                    <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                        <div style={{position: 'relative', flex: 1}}>
                            <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)'}}></i>
                            <input type="text" placeholder={t('buscarExpediente') || 'Buscar expediente...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{width: '100%', padding: '12px 12px 12px 35px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.9rem', outline: 'none'}} />
                        </div>
                        <button 
                            onClick={() => setShowLegacyClients(!showLegacyClients)}
                            style={{padding: '12px', background: showLegacyClients ? 'rgba(2, 136, 209, 0.1)' : 'var(--bg-main)', color: showLegacyClients ? '#0288d1' : 'var(--text-muted)', border: `1px solid ${showLegacyClients ? '#0288d1' : 'var(--border-color)'}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s'}}
                            title={t('alternarPacientesAntiguos') || 'Mostrar pacientes Legacy'}
                        >
                            <i className={`fa-solid ${showLegacyClients ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                    </div>

                    <div style={{display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '10px', scrollbarWidth: 'none'}}>
                        <button onClick={() => setActiveSucursalTab('todas')} style={{padding: '6px 12px', background: activeSucursalTab === 'todas' ? 'var(--text-main)' : 'var(--bg-panel)', color: activeSucursalTab === 'todas' ? 'var(--bg-panel)' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '15px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'}}>{t('todos') || 'Todos'}</button>
                        {sucursalesDB.map(suc => (
                            <button key={suc.id} onClick={() => setActiveSucursalTab(suc.id)} style={{padding: '6px 12px', background: activeSucursalTab === suc.id ? '#0288d1' : 'var(--bg-panel)', color: activeSucursalTab === suc.id ? 'white' : 'var(--text-muted)', border: activeSucursalTab === suc.id ? '1px solid #0288d1' : '1px solid var(--border-color)', borderRadius: '15px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'}}>{suc.nombre}</button>
                        ))}
                    </div>

                    <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px'}}>
                        {pacientesFiltrados.map(p => {
                            const isSelected = pacienteSeleccionado?.id === p.id;
                            const isLegacy = p.codigo_expediente && p.codigo_expediente.includes('LEGACY');
                            const hasAlert = p.alertas_clinicas?.filter(a => a.activa).length > 0;
                            return (
                                <div 
                                    key={p.id} 
                                    onClick={() => setPacienteSeleccionado(p)} 
                                    style={{
                                        padding: '15px', background: isSelected ? 'var(--bg-lighter)' : 'var(--bg-main)', 
                                        border: '1px solid', borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)', 
                                        borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease',
                                        borderLeft: isSelected ? '4px solid var(--accent)' : (hasAlert ? '4px solid var(--primary-red)' : '1px solid var(--border-color)'),
                                        boxShadow: isSelected ? '0 4px 10px rgba(0,0,0,0.05)' : 'none'
                                    }}
                                >
                                    <strong style={{display: 'block', color: isSelected ? 'var(--accent)' : 'var(--text-main)', fontSize: '0.95rem', marginBottom: '6px'}}>{p.nombre}</strong>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                        {p.codigo_expediente ? (
                                            <span style={{background: isLegacy ? 'rgba(234, 88, 12, 0.1)' : 'rgba(2, 136, 209, 0.1)', color: isLegacy ? '#ea580c' : '#0288d1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold'}}>
                                                <i className="fa-solid fa-folder-open" style={{marginRight: '4px'}}></i> {p.codigo_expediente}
                                            </span>
                                        ) : <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{t('sinExpediente') || 'S/E'}</span>}
                                        {hasAlert && <span style={{fontSize: '0.75rem', color: 'var(--primary-red)'}}><i className="fa-solid fa-triangle-exclamation"></i></span>}
                                    </div>
                                </div>
                            )
                        })}
                        {pacientesFiltrados.length === 0 && <div style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem'}}><i className="fa-regular fa-folder-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('noResultados') || 'No hay resultados'}</div>}
                    </div>
                </div>
            </div>

            {/* 🚀 PANEL DERECHO: ESCRITORIO CLÍNICO */}
            <div 
                className="panel animate-fade-in" 
                onClick={() => { if(sidebarOpen && pacienteSeleccionado) setSidebarOpen(false); }}
                onFocusCapture={() => { if(sidebarOpen && pacienteSeleccionado) setSidebarOpen(false); }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', transition: 'all 0.4s ease' }}
            >
                {pacienteSeleccionado ? (
                    <>
                        {/* CABECERA DEL PACIENTE */}
                        <div style={{padding: '25px 30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0}}>
                            <div>
                                <div style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '8px'}}>
                                    <h1 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.8rem'}}>{pacienteSeleccionado.nombre}</h1>
                                    <span style={{color: 'var(--text-muted)', fontSize: '1.25rem', fontWeight: '500', display: 'flex', alignItems: 'center'}}>
                                        <span style={{color: 'var(--border-color)', marginRight: '12px'}}>|</span>
                                        <i className="fa-solid fa-person-half-dress" style={{marginRight: '8px', color: 'var(--accent)'}}></i> 
                                        {t(pacienteSeleccionado.sexo?.toLowerCase()) || pacienteSeleccionado.sexo} ({calcularEdad(pacienteSeleccionado.fecha_nacimiento)})
                                    </span>
                                </div>
                                <div style={{color: 'var(--text-muted)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '10px'}}>
                                    <span><i className="fa-regular fa-id-card" style={{marginRight: '5px'}}></i> {pacienteSeleccionado.curp || t('sinCurpAbrev') || 'Sin CURP'}</span>
                                    {pacienteSeleccionado.codigo_expediente && (
                                        <>
                                            <span style={{color: 'var(--border-color)'}}>|</span> 
                                            <span style={{background: pacienteSeleccionado.codigo_expediente.includes('LEGACY') ? 'rgba(234, 88, 12, 0.1)' : 'rgba(2, 136, 209, 0.1)', color: pacienteSeleccionado.codigo_expediente.includes('LEGACY') ? '#ea580c' : 'var(--accent)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>{pacienteSeleccionado.codigo_expediente}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                                <button onClick={(e) => { e.stopPropagation(); setShowReferenciaModal(true); }} className="btn-action" style={{background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.3)', padding: '12px', borderRadius: '8px'}} title={t('hojaReferencia') || 'Referencia'}>
                                    <i className="fa-solid fa-truck-medical fa-lg"></i>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); generarPDF(); }} className="btn-action" style={{background: 'var(--bg-lighter)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px'}} title={t('exportarPdf') || 'Exportar PDF'}>
                                    <i className="fa-solid fa-file-pdf fa-lg"></i>
                                </button>
                            </div>
                        </div>

                        {/* PESTAÑAS MÉDICAS PRINCIPALES */}
                        <div style={{display: 'flex', gap: '30px', padding: '0 30px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', flexShrink: 0}}>
                            <button className="tab-btn" onClick={() => setTabActiva('historia')} style={{borderBottom: tabActiva === 'historia' ? '3px solid var(--accent)' : '3px solid transparent', color: tabActiva === 'historia' ? 'var(--accent)' : 'var(--text-muted)'}}><i className="fa-solid fa-file-medical" style={{marginRight: '8px'}}></i> {t('evaluacionDiagnostico') || 'Evaluación y Diagnóstico'}</button>
                            <button className="tab-btn" onClick={() => setTabActiva('evolucion')} style={{borderBottom: tabActiva === 'evolucion' ? '3px solid var(--accent)' : '3px solid transparent', color: tabActiva === 'evolucion' ? 'var(--accent)' : 'var(--text-muted)'}}><i className="fa-solid fa-stethoscope" style={{marginRight: '8px'}}></i> {t('notasEvolucion') || 'Notas de Evolución'}</button>
                        </div>

                        <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', padding: '30px'}}>
                            
                            {/* 🚀 PESTAÑA 1: EVALUACIÓN Y DIAGNÓSTICO CLINICO */}
                            {tabActiva === 'historia' && (
                                <div className="animate-fade-in" style={{maxWidth: '1000px', margin: '0 auto', width: '100%'}}>
                                    
                                    {historia?.estado === 'firmada' ? (
                                        <div style={{background: 'var(--bg-panel)', padding: '35px', borderRadius: '16px', border: '1px solid var(--success)', boxShadow: '0 10px 30px rgba(22, 163, 74, 0.1)'}}>
                                            <div style={{background: 'rgba(22, 163, 74, 0.05)', padding: '20px', borderRadius: '12px', marginBottom: '30px', textAlign: 'center', border: '1px dashed var(--success)', color: 'var(--success)'}}>
                                                <i className="fa-solid fa-lock fa-2x" style={{marginBottom: '10px'}}></i>
                                                <h3 style={{margin: '0 0 5px 0'}}>{t('expedienteFirmado') || 'Expediente Cerrado y Firmado'}</h3>
                                                <p style={{margin: 0, fontSize: '0.95rem'}}>{t('por')} {historia.medico_nombre} {t('el')} {formatDate(historia.fecha_firma)}</p>
                                                <span style={{fontSize: '0.8rem', fontFamily: 'monospace', opacity: 0.6}}>HASH: {historia.firma_hash}</span>
                                            </div>
                                            
                                            <h4 style={{color: 'var(--accent)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', fontSize: '1.2rem'}}><i className="fa-solid fa-clipboard-question"></i> {t('resumenPaciente') || 'Resumen del Paciente'}</h4>
                                            <div className="read-box"><span className="label">{t('motivoConsulta') || 'Motivo de Consulta'}</span> {datosRecepcion?.motivo || '-'}</div>
                                            
                                            <h4 style={{color: '#ffb300', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginTop: '30px', fontSize: '1.2rem'}}><i className="fa-solid fa-yin-yang"></i> {t('diagnosticoMtc') || 'Diagnóstico MTCh'}</h4>
                                            <div className="read-box" style={{background: 'rgba(255, 179, 0, 0.05)', borderColor: 'rgba(255, 179, 0, 0.2)'}}><span className="label" style={{color: '#d97706'}}>{t('pulsoYLengua') || 'Pulso y Lengua'}:</span> <pre style={{fontFamily: 'inherit', margin: 0, whiteSpace: 'pre-wrap', fontSize: '1.05rem'}}>{historia.mtc_pulso_lengua || '-'}</pre></div>

                                            <h4 style={{color: 'var(--success)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginTop: '30px', fontSize: '1.2rem'}}><i className="fa-solid fa-stethoscope"></i> {t('conclusionPlan') || 'Conclusión y Plan'}</h4>
                                            <div className="read-box"><span className="label">{t('diagnosticoCie') || 'Diagnóstico CIE'}:</span> {historia.diagnostico_cie || '-'}</div>
                                            <div className="read-box"><span className="label">{t('planTratamiento') || 'Plan de Tratamiento'}:</span> {historia.plan_tratamiento || '-'}</div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* 🚀 TARJETA DE LECTURA DE RECEPCIÓN */}
                                            {datosRecepcion && (
                                                <div style={{background: 'var(--bg-panel)', borderRadius: '12px', padding: '25px', marginBottom: '30px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                                                    <h4 style={{margin: '0 0 15px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', fontSize: '1.1rem'}}><i className="fa-regular fa-folder-open" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('datosRecepcion') || 'Información recabada en Recepción'}</h4>
                                                    <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                                        <div className="read-box-mini"><span className="label">{t('motivoPadecimiento') || 'Motivo y Padecimiento'}</span> {datosRecepcion.motivo || '-'}</div>
                                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                                                            <div className="read-box-mini"><span className="label">{t('aPersonales') || 'A. Personales'}</span> {datosRecepcion.personales || '-'}</div>
                                                            <div className="read-box-mini"><span className="label">{t('aFamiliares') || 'A. Familiares'}</span> {datosRecepcion.familiares || '-'}</div>
                                                            <div className="read-box-mini"><span className="label">{t('medicamentosActuales') || 'Medicamentos'}</span> {datosRecepcion.medicamentos || '-'}</div>
                                                            <div className="read-box-mini"><span className="label">{t('habitosYSueno') || 'Hábitos y Sueño'}</span> {datosRecepcion.habitos || '-'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <h3 className="pane-title"><i className="fa-solid fa-yin-yang" style={{color: '#ffb300', marginRight: '10px'}}></i> {t('exploracionFisicaMtc') || 'Exploración Física y MTCh'}</h3>
                                            
                                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px'}}>
                                                <div><label className="form-label">{t('fcLpm') || 'FC (lpm)'}</label><input disabled={isProcessingBtn} type="text" value={signosVitales.fc} onChange={e => setSignosVitales({...signosVitales, fc: e.target.value})} className="form-input" placeholder={t('phFc') || 'Ej. 80'} /></div>
                                                <div><label className="form-label">{t('frRpm') || 'FR (rpm)'}</label><input disabled={isProcessingBtn} type="text" value={signosVitales.fr} onChange={e => setSignosVitales({...signosVitales, fr: e.target.value})} className="form-input" placeholder={t('phFr') || 'Ej. 16'} /></div>
                                                <div><label className="form-label">{t('taMmhg') || 'TA (mmHg)'}</label><input disabled={isProcessingBtn} type="text" value={signosVitales.ta} onChange={e => setSignosVitales({...signosVitales, ta: e.target.value})} className="form-input" placeholder={t('phTa') || 'Ej. 120/80'} /></div>
                                                <div><label className="form-label">{t('tempC') || 'Temp (°C)'}</label><input disabled={isProcessingBtn} type="text" value={signosVitales.temp} onChange={e => setSignosVitales({...signosVitales, temp: e.target.value})} className="form-input" placeholder={t('phTemp') || 'Ej. 36.5'} /></div>
                                            </div>

                                            <div style={{display: 'flex', gap: '20px', marginBottom: '20px'}}>
                                                <div style={{flex: 1, background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)'}}>
                                                    <h4 style={{color: 'var(--text-main)', margin: '0 0 15px 0', fontSize: '1rem', display: 'flex', alignItems: 'center'}}><i className="fa-solid fa-heart-pulse" style={{color: 'var(--primary-red)', marginRight: '8px'}}></i> {t('matrizPulso') || 'Matriz de Pulso'}</h4>
                                                    <div style={{overflowX: 'auto'}}>
                                                        <table className="mtc-matrix-table" style={{fontSize: '0.85rem'}}>
                                                            <thead><tr><th></th>{posicionesPulso.map(p => <th key={p.id} style={{color: p.color}}>{p.label}</th>)}</tr></thead>
                                                            <tbody>
                                                                {tiposPulsoData.map(tipo => (
                                                                    <tr key={tipo.id} className="mtc-row-hover">
                                                                        <td className="row-label">{tipo.label}</td>
                                                                        {posicionesPulso.map(pos => {
                                                                            const key = `${pos.id}-${tipo.id}`;
                                                                            const isChecked = pulsoMatrix[key] || false;
                                                                            return (
                                                                                <td key={key} className="cell-checkbox" onClick={() => !isProcessingBtn && toggleMatrix(pulsoMatrix, setPulsoMatrix, key)}>
                                                                                    <div className={`custom-check ${isChecked ? 'checked' : ''}`} style={{backgroundColor: isChecked ? pos.color : 'transparent', borderColor: isChecked ? pos.color : 'var(--border-color)'}}>{isChecked && <i className="fa-solid fa-check"></i>}</div>
                                                                                </td>
                                                                            );
                                                                        })}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                <div style={{flex: 1, background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)'}}>
                                                    <h4 style={{color: 'var(--text-main)', margin: '0 0 15px 0', fontSize: '1rem', display: 'flex', alignItems: 'center'}}><i className="fa-solid fa-magnifying-glass-chart" style={{color: '#ffb300', marginRight: '8px'}}></i> {t('matrizLengua') || 'Matriz de Lengua'}</h4>
                                                    <div style={{overflowX: 'auto'}}>
                                                        <table className="mtc-matrix-table" style={{fontSize: '0.85rem'}}>
                                                            <thead><tr><th></th>{zonasLengua.map(z => <th key={z.id} style={{color: z.color}}>{z.label}</th>)}</tr></thead>
                                                            <tbody>
                                                                {attrsLenguaData.map(attr => (
                                                                    <tr key={attr.id} className="mtc-row-hover">
                                                                        <td className="row-label">{attr.label}</td>
                                                                        {zonasLengua.map(zona => {
                                                                            const key = `${zona.id}-${attr.id}`;
                                                                            const isChecked = lenguaMatrix[key] || false;
                                                                            return (
                                                                                <td key={key} className="cell-checkbox" onClick={() => !isProcessingBtn && toggleMatrix(lenguaMatrix, setLenguaMatrix, key)}>
                                                                                    <div className={`custom-check ${isChecked ? 'checked' : ''}`} style={{backgroundColor: isChecked ? zona.color : 'transparent', borderColor: isChecked ? zona.color : 'var(--border-color)'}}>{isChecked && <i className="fa-solid fa-check"></i>}</div>
                                                                                </td>
                                                                            );
                                                                        })}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{background: 'rgba(255, 179, 0, 0.05)', border: '1px dashed #ffb300', borderRadius: '12px', padding: '25px', display: 'flex', flexDirection: 'column', marginBottom: '35px'}}>
                                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                                                    <label style={{fontWeight: 'bold', color: '#d97706', margin: 0, fontSize: '1.1rem'}}><i className="fa-solid fa-pen-nib"></i> {t('redaccionDiagnosticoMTC') || 'Redacción Diagnóstico MTC'}</label>
                                                    <button disabled={isProcessingBtn} onClick={() => redactarHallazgosMTCh(false)} className="btn-primary" style={{padding: '10px 25px', background: '#f59e0b', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)', transition: 'all 0.3s'}}>
                                                        <i className="fa-solid fa-wand-magic-sparkles"></i> {t('autoRedactarHallazgos') || 'Auto-Redactar'}
                                                    </button>
                                                </div>
                                                <textarea disabled={isProcessingBtn} value={hForm.mtc_pulso_lengua} onChange={e => setHForm({...hForm, mtc_pulso_lengua: e.target.value})} className="form-input" rows="6" placeholder={t('placeholderMtc') || 'Interpretación clínica...'} style={{borderColor: 'rgba(255, 179, 0, 0.4)', background: 'var(--bg-panel)', fontSize: '1.05rem', lineHeight: '1.5'}}></textarea>
                                            </div>

                                            <h3 className="pane-title"><i className="fa-solid fa-stethoscope" style={{color: 'var(--success)', marginRight: '10px'}}></i> {t('conclusionPlanTratamiento') || 'Conclusión y Plan'}</h3>
                                            
                                            <div style={{display: 'flex', flexDirection: 'column', gap: '25px'}}>
                                                <div><label className="form-label">{t('exploracionFisicaAdicional') || 'Exploración Física (Adicional)'}</label><textarea disabled={isProcessingBtn} value={hForm.exploracion_fisica} onChange={(e) => setHForm({...hForm, exploracion_fisica: e.target.value})} className="form-input" rows="2"></textarea></div>
                                                <div style={{background: 'rgba(22, 163, 74, 0.05)', border: '1px solid rgba(22, 163, 74, 0.2)', padding: '20px', borderRadius: '12px'}}>
                                                    <label className="form-label" style={{color: 'var(--success)'}}>{t('diagnosticoCie') || 'Diagnóstico Clínico (CIE)'}</label>
                                                    <textarea disabled={isProcessingBtn} value={hForm.diagnostico_cie} onChange={(e) => setHForm({...hForm, diagnostico_cie: e.target.value})} className="form-input" rows="2"></textarea>
                                                </div>
                                                
                                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px'}}>
                                                    {/* 🚀 CHIPS INTELIGENTES DE PRONÓSTICO */}
                                                    <div>
                                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                                                            <label className="form-label" style={{marginBottom: 0}}>{t('pronostico') || 'Pronóstico'}</label>
                                                        </div>
                                                        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px'}}>
                                                            {pronosticosRapidos.map(p => (
                                                                <button key={p.id} disabled={isProcessingBtn} onClick={() => inyectarTextoMedico('pronostico', p.text)} className="med-chip" style={{color: p.color, background: p.bg, borderColor: p.color}}>
                                                                    <i className={`fa-solid ${p.icon}`}></i> {p.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <textarea disabled={isProcessingBtn} value={hForm.pronostico} onChange={(e) => setHForm({...hForm, pronostico: e.target.value})} className="form-input" rows="5"></textarea>
                                                    </div>
                                                    
                                                    {/* 🚀 CHIPS INTELIGENTES DE PLAN DE TRATAMIENTO */}
                                                    <div>
                                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                                                            <label className="form-label" style={{marginBottom: 0}}>{t('planTratamientoPuntos') || 'Plan de Tratamiento'}</label>
                                                        </div>
                                                        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px'}}>
                                                            {planesRapidos.map(p => (
                                                                <button key={p.id} disabled={isProcessingBtn} onClick={() => inyectarTextoMedico('plan_tratamiento', p.text)} className="med-chip" style={{color: p.color, background: p.bg, borderColor: p.color}}>
                                                                    <i className={`fa-solid ${p.icon}`}></i> {p.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <textarea disabled={isProcessingBtn} value={hForm.plan_tratamiento} onChange={(e) => setHForm({...hForm, plan_tratamiento: e.target.value})} className="form-input" rows="5"></textarea>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* CONTROLES HISTORIA CLÍNICA */}
                                            <div style={{display: 'flex', gap: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '25px', justifyContent: 'flex-end'}}>
                                                <button className="btn-action" onClick={() => guardarHistoria(false)} disabled={isProcessingBtn} style={{padding: '14px 25px', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold', cursor: isProcessingBtn ? 'not-allowed' : 'pointer'}}><i className="fa-regular fa-floppy-disk"></i> {t('guardarBorrador') || 'Guardar Borrador'}</button>
                                                <button className="btn-primary" onClick={() => guardarHistoria(true)} disabled={isProcessingBtn} style={{padding: '14px 35px', background: 'var(--success)', border: 'none', borderRadius: '10px', fontWeight: '900', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(22, 163, 74, 0.4)', opacity: isProcessingBtn ? 0.7 : 1}}>
                                                    {isProcessingBtn ? <><i className="fa-solid fa-spinner fa-spin"></i> {t('procesando') || 'Procesando...'}</> : <><i className="fa-solid fa-lock"></i> {t('firmarHistoriaClinica') || 'Firmar Historia'}</>}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* 🚀 PESTAÑA 2: NOTAS DE EVOLUCIÓN (CON PANEL CONTEXTUAL LATERAL) */}
                            {tabActiva === 'evolucion' && (
                                <div style={{display: 'flex', gap: '30px', height: '100%'}}>
                                    <div style={{width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                        <button className="btn-primary" onClick={crearNuevaNota} disabled={isProcessingBtn} style={{padding: '15px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'}}><i className="fa-solid fa-plus"></i> {t('nuevaNota') || 'Nueva Nota'}</button>
                                        <div style={{overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px'}}>
                                            {notas.map(nota => {
                                                const isActive = notaActiva === nota.id;
                                                const isFirmada = nota.estado === 'firmada';
                                                return (
                                                    <div 
                                                        key={nota.id} onClick={() => abrirNota(nota)} 
                                                        style={{
                                                            padding: '15px', background: isActive ? 'var(--bg-panel)' : 'var(--bg-main)', 
                                                            borderTop: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-color)'}`,
                                                            borderRight: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-color)'}`,
                                                            borderBottom: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-color)'}`,
                                                            borderLeft: isFirmada ? '4px solid var(--success)' : '4px solid #ffb300', 
                                                            borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
                                                        }}
                                                    >
                                                        <span style={{fontSize: '0.85rem', color: 'var(--text-main)', display: 'block', fontWeight: 'bold', marginBottom: '5px'}}>{formatDateOnly(nota.fecha_registro)}</span>
                                                        <span style={{fontSize: '0.75rem', color: isFirmada ? 'var(--success)' : '#ffb300', background: isFirmada ? 'rgba(22, 163, 74, 0.1)' : 'rgba(255, 179, 0, 0.1)', padding: '2px 8px', borderRadius: '12px'}}>{nota.estado.toUpperCase()}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div style={{flex: 1, overflowY: 'auto', paddingRight: '10px'}}>
                                        {notaActiva ? (
                                            <div style={{display: 'grid', gridTemplateColumns: '1fr 320px', gap: '25px', alignItems: 'start'}}>
                                                
                                                {/* 🌟 LADO IZQUIERDO: Formulario de la Nota */}
                                                <div style={{background: 'var(--bg-panel)', padding: '35px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                                                    
                                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px'}}>
                                                        <h3 style={{margin: 0, color: 'var(--text-main)'}}><i className="fa-solid fa-file-pen" style={{color: 'var(--accent)', marginRight: '8px'}}></i> {t('notasEvolucion') || 'Nota de Evolución'}</h3>
                                                        {nForm.estado === 'firmada' && (
                                                            <button onClick={generarPDFDiagnostico} className="btn-action" style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold'}} title="Imprimir Receta/Diagnóstico para el paciente">
                                                                <i className="fa-solid fa-print"></i> {t('imprimirDiagnostico') || 'Imprimir Diagnóstico'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {nForm.estado === 'firmada' && (
                                                        <div style={{background: 'rgba(22, 163, 74, 0.05)', border: '1px solid rgba(22, 163, 74, 0.3)', color: 'var(--success)', padding: '15px', borderRadius: '8px', marginBottom: '30px', textAlign: 'center'}}>
                                                            <i className="fa-solid fa-lock"></i> {t('documentoFirmado')} {t('por').toLowerCase()} <strong style={{color: 'var(--text-main)'}}>{nForm.medico_nombre}</strong> {t('el')} {formatDate(nForm.fecha_firma)}
                                                            <br/><span style={{fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '5px', display: 'block'}}>Hash: {nForm.firma_hash}</span>
                                                        </div>
                                                    )}

                                                    <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px'}}>
                                                        
                                                        {nForm.estado !== 'firmada' && (
                                                            <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '10px', background: 'var(--bg-main)', padding: '20px', borderRadius: '12px', border: '1px dashed var(--border-color)'}}>
                                                                <h4 style={{margin: '0', color: 'var(--text-main)', fontSize: '1rem'}}><i className="fa-solid fa-yin-yang" style={{color: '#ffb300', marginRight: '8px'}}></i> {t('exploracionFisicaMtc') || 'Exploración Física y MTCh (Opcional)'}</h4>
                                                                
                                                                <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px'}}>
                                                                    <div><label className="form-label" style={{fontSize: '0.75rem'}}>{t('fcLpm')}</label><input disabled={isProcessingBtn} type="text" value={signosVitalesNota.fc} onChange={e => setSignosVitalesNota({...signosVitalesNota, fc: e.target.value})} className="form-input" style={{padding: '10px', fontSize: '0.9rem'}} placeholder={t('phFc')} /></div>
                                                                    <div><label className="form-label" style={{fontSize: '0.75rem'}}>{t('frRpm')}</label><input disabled={isProcessingBtn} type="text" value={signosVitalesNota.fr} onChange={e => setSignosVitalesNota({...signosVitalesNota, fr: e.target.value})} className="form-input" style={{padding: '10px', fontSize: '0.9rem'}} placeholder={t('phFr')} /></div>
                                                                    <div><label className="form-label" style={{fontSize: '0.75rem'}}>{t('taMmhg')}</label><input disabled={isProcessingBtn} type="text" value={signosVitalesNota.ta} onChange={e => setSignosVitalesNota({...signosVitalesNota, ta: e.target.value})} className="form-input" style={{padding: '10px', fontSize: '0.9rem'}} placeholder={t('phTa')} /></div>
                                                                    <div><label className="form-label" style={{fontSize: '0.75rem'}}>{t('tempC')}</label><input disabled={isProcessingBtn} type="text" value={signosVitalesNota.temp} onChange={e => setSignosVitalesNota({...signosVitalesNota, temp: e.target.value})} className="form-input" style={{padding: '10px', fontSize: '0.9rem'}} placeholder={t('phTemp')} /></div>
                                                                </div>

                                                                <div style={{display: 'flex', gap: '20px'}}>
                                                                    <div style={{flex: 1, background: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '15px'}}>
                                                                        <h5 style={{margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-main)'}}><i className="fa-solid fa-heart-pulse" style={{color: 'var(--primary-red)'}}></i> {t('matrizPulso')}</h5>
                                                                        <div style={{overflowX: 'auto'}}>
                                                                            <table className="mtc-matrix-table" style={{fontSize: '0.8rem'}}>
                                                                                <thead><tr><th></th>{posicionesPulso.map(p => <th key={p.id} style={{color: p.color, fontSize: '0.75rem', padding: '5px'}}>{p.label}</th>)}</tr></thead>
                                                                                <tbody>
                                                                                    {tiposPulsoData.map(tipo => (
                                                                                        <tr key={tipo.id} className="mtc-row-hover">
                                                                                            <td className="row-label" style={{fontSize: '0.8rem', padding: '6px'}}>{tipo.label}</td>
                                                                                            {posicionesPulso.map(pos => {
                                                                                                const key = `${pos.id}-${tipo.id}`;
                                                                                                const isChecked = pulsoMatrixNota[key] || false;
                                                                                                return (
                                                                                                    <td key={key} className="cell-checkbox" style={{padding: '4px'}} onClick={() => !isProcessingBtn && toggleMatrix(pulsoMatrixNota, setPulsoMatrixNota, key)}>
                                                                                                        <div className={`custom-check ${isChecked ? 'checked' : ''}`} style={{width: '18px', height: '18px', backgroundColor: isChecked ? pos.color : 'transparent', borderColor: isChecked ? pos.color : 'var(--border-color)'}}>{isChecked && <i className="fa-solid fa-check" style={{fontSize: '10px'}}></i>}</div>
                                                                                                    </td>
                                                                                                );
                                                                                            })}
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>

                                                                    <div style={{flex: 1, background: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '15px'}}>
                                                                        <h5 style={{margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-main)'}}><i className="fa-solid fa-magnifying-glass-chart" style={{color: '#ffb300'}}></i> {t('matrizLengua')}</h5>
                                                                        <div style={{overflowX: 'auto'}}>
                                                                            <table className="mtc-matrix-table" style={{fontSize: '0.8rem'}}>
                                                                                <thead><tr><th></th>{zonasLengua.map(z => <th key={z.id} style={{color: z.color, fontSize: '0.75rem', padding: '5px'}}>{z.label}</th>)}</tr></thead>
                                                                                <tbody>
                                                                                    {attrsLenguaData.map(attr => (
                                                                                        <tr key={attr.id} className="mtc-row-hover">
                                                                                            <td className="row-label" style={{fontSize: '0.8rem', padding: '6px'}}>{attr.label}</td>
                                                                                            {zonasLengua.map(zona => {
                                                                                                const key = `${zona.id}-${attr.id}`;
                                                                                                const isChecked = lenguaMatrixNota[key] || false;
                                                                                                return (
                                                                                                    <td key={key} className="cell-checkbox" style={{padding: '4px'}} onClick={() => !isProcessingBtn && toggleMatrix(lenguaMatrixNota, setLenguaMatrixNota, key)}>
                                                                                                        <div className={`custom-check ${isChecked ? 'checked' : ''}`} style={{width: '18px', height: '18px', backgroundColor: isChecked ? zona.color : 'transparent', borderColor: isChecked ? zona.color : 'var(--border-color)'}}>{isChecked && <i className="fa-solid fa-check" style={{fontSize: '10px'}}></i>}</div>
                                                                                                    </td>
                                                                                                );
                                                                                            })}
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div style={{textAlign: 'right', marginTop: '10px'}}>
                                                                    <button disabled={isProcessingBtn} onClick={() => redactarHallazgosMTCh(true)} className="btn-primary" style={{padding: '8px 20px', background: '#f59e0b', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', fontSize: '0.85rem', boxShadow: '0 4px 10px rgba(245, 158, 11, 0.2)'}}>
                                                                        <i className="fa-solid fa-wand-magic-sparkles"></i> {t('autoRedactarHallazgos') || 'Auto-Redactar Evolución'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* 🚀 FORMULARIO NOTAS DE EVOLUCIÓN CON CHIPS INTELIGENTES */}
                                                        <div>
                                                            <label className="form-label">{t('evolucion') || 'Evolución y Tolerancia'} *</label>
                                                            {nForm.estado !== 'firmada' && (
                                                                <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px'}}>
                                                                    {chipsEvolucion.map(c => (
                                                                        <button key={c.id} disabled={isProcessingBtn} onClick={() => inyectarTextoNota('evolucion', c.label)} className="med-chip" style={{color: '#0288d1', background: 'rgba(2, 136, 209, 0.1)', borderColor: '#0288d1'}}><i className="fa-solid fa-plus"></i> {c.label}</button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            <textarea disabled={isProcessingBtn || nForm.estado === 'firmada'} value={nForm.evolucion} onChange={(e) => setNForm({...nForm, evolucion: e.target.value})} className="form-input" rows="4" placeholder={t('phEvolucion') || "Describe los cambios y la evolución clínica..."}></textarea>
                                                        </div>

                                                        <div>
                                                            <label className="form-label">{t('procedimientoTecnica') || 'Procedimiento Aplicado'} *</label>
                                                            {nForm.estado !== 'firmada' && (
                                                                <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px'}}>
                                                                    {chipsProcedimiento.map(c => (
                                                                        <button key={c.id} disabled={isProcessingBtn} onClick={() => inyectarTextoNota('procedimiento_tecnica', c.label)} className="med-chip" style={{color: '#9333ea', background: 'rgba(147, 51, 234, 0.1)', borderColor: '#9333ea'}}><i className="fa-solid fa-plus"></i> {c.label}</button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            <textarea disabled={isProcessingBtn || nForm.estado === 'firmada'} value={nForm.procedimiento_tecnica} onChange={(e) => setNForm({...nForm, procedimiento_tecnica: e.target.value})} className="form-input" rows="2" placeholder={t('phProcedimiento') || "Técnica, agujas o material..."}></textarea>
                                                        </div>

                                                        <div><label className="form-label">{t('planIndicaciones') || 'Indicaciones a Paciente'}</label><textarea disabled={isProcessingBtn || nForm.estado === 'firmada'} value={nForm.plan_indicaciones} onChange={(e) => setNForm({...nForm, plan_indicaciones: e.target.value})} className="form-input" rows="2"></textarea></div>
                                                    </div>

                                                    <div style={{background: 'var(--bg-lighter)', padding: '25px', borderRadius: '12px', border: '1px dashed var(--accent)', marginBottom: '30px'}}>
                                                        <h4 style={{color: 'var(--accent)', marginBottom: '15px'}}><i className="fa-solid fa-notes-medical"></i> {t('resumenSesionImpresion') || 'Resumen de Sesión'}</h4>
                                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
                                                            <div style={{gridColumn: '1 / -1'}}><label className="form-label">{t('puntosAcupuntura')}</label><input disabled={isProcessingBtn || nForm.estado === 'firmada'} type="text" value={nForm.puntos_acupuntura} onChange={(e) => setNForm({...nForm, puntos_acupuntura: e.target.value})} className="form-input" placeholder={t('phPuntos')} style={{textTransform: 'uppercase'}} /></div>
                                                            <div><label className="form-label">{t('tiempoRetencion')}</label><input disabled={isProcessingBtn || nForm.estado === 'firmada'} type="number" value={nForm.tiempo_retencion_minutos} onChange={(e) => setNForm({...nForm, tiempo_retencion_minutos: e.target.value})} className="form-input" placeholder={t('phRetencion')} /></div>
                                                            <div><label className="form-label">{t('sesionesRequeridas')}</label><input disabled={isProcessingBtn || nForm.estado === 'firmada'} type="number" value={nForm.sesiones_requeridas} onChange={(e) => setNForm({...nForm, sesiones_requeridas: e.target.value})} className="form-input" placeholder={t('phSesiones')} /></div>
                                                            <div style={{gridColumn: '1 / -1'}}><label className="form-label">{t('diagnosticoSesion') || 'Diagnóstico de la Sesión'} *</label><textarea disabled={isProcessingBtn || nForm.estado === 'firmada'} value={nForm.diagnostico_sesion} onChange={(e) => setNForm({...nForm, diagnostico_sesion: e.target.value})} className="form-input" rows="2" placeholder={t('phDiagnosticoSesion')}></textarea></div>
                                                        </div>
                                                    </div>

                                                    {nForm.estado !== 'firmada' ? (
                                                        <div style={{display: 'flex', gap: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '30px', justifyContent: 'flex-end'}}>
                                                            <button className="btn-action" disabled={isProcessingBtn} onClick={() => guardarNota(false)} style={{padding: '14px 25px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem', borderRadius: '10px', cursor: isProcessingBtn ? 'not-allowed' : 'pointer'}}><i className="fa-regular fa-floppy-disk"></i> {t('guardarBorrador')}</button>
                                                            <button className="btn-primary" disabled={isProcessingBtn} onClick={() => guardarNota(true)} style={{padding: '14px 35px', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem', cursor: isProcessingBtn ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)', opacity: isProcessingBtn ? 0.7 : 1}}>
                                                                {isProcessingBtn ? <><i className="fa-solid fa-spinner fa-spin"></i> Procesando...</> : <><i className="fa-solid fa-lock"></i> {t('firmar') || 'Firmar Nota'}</>}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div style={{borderTop: '2px dashed var(--border-color)', paddingTop: '30px'}}>
                                                            <h4 style={{color: '#ffb300', marginBottom: '20px', fontSize: '1.1rem'}}><i className="fa-solid fa-file-pen"></i> {t('adendas')}</h4>
                                                            {adendasActivas.map(adenda => (
                                                                <div key={adenda.id} style={{background: 'rgba(255, 179, 0, 0.05)', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #ffb300', marginBottom: '15px'}}>
                                                                    <p style={{margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.5'}}>{adenda.texto_adenda}</p>
                                                                    <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{t('por')} <strong style={{color: 'var(--text-main)'}}>{adenda.medico_nombre}</strong> {t('el')} {formatDate(adenda.fecha_registro)}</span>
                                                                </div>
                                                            ))}
                                                            <div style={{marginTop: '25px', background: 'var(--bg-main)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)'}}>
                                                                <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'block', fontWeight: 'bold'}}>{t('redactarAdenda')}</label>
                                                                <textarea disabled={isProcessingBtn} value={nuevaAdenda} onChange={e => setNuevaAdenda(e.target.value)} placeholder={t('phRedactarAdenda') || "Escribe la fe de erratas o corrección aquí..."} style={{width: '100%', padding: '15px', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', minHeight: '60px', marginBottom: '10px'}} />
                                                                <button disabled={isProcessingBtn} className="btn-action" onClick={firmarAdenda} style={{background: 'rgba(255, 179, 0, 0.1)', color: '#ea580c', border: '1px solid rgba(255, 179, 0, 0.3)', fontWeight: 'bold', width: '100%', padding: '12px', borderRadius: '8px', cursor: isProcessingBtn ? 'not-allowed' : 'pointer'}}><i className="fa-solid fa-signature"></i> {t('firmarAdenda')}</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 🌟 LADO DERECHO: Historial Contextual Rápido */}
                                                <div style={{background: 'var(--bg-main)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', position: 'sticky', top: '0', maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column'}}>
                                                    <h4 style={{margin: '0 0 15px 0', color: 'var(--text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px'}}>
                                                        <i className="fa-solid fa-clock-rotate-left" style={{color: 'var(--accent)', marginRight: '8px'}}></i> {t('historialPrevioCorto') || 'Historial Previo'}
                                                    </h4>
                                                    
                                                    <div style={{overflowY: 'auto', flex: 1, paddingRight: '5px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
                                                        
                                                        {/* Tarjeta de la Historia Base */}
                                                        {historia && (
                                                            <div style={{background: 'var(--bg-panel)', padding: '15px', borderRadius: '10px', borderLeft: '4px solid var(--accent)', border: '1px solid var(--border-color)'}}>
                                                                <h5 style={{margin: '0 0 8px 0', color: 'var(--accent)', fontSize: '0.85rem'}}>{t('resumenHistoriaClinica') || 'Diagnóstico Inicial'}</h5>
                                                                {historia.diagnostico_cie && (
                                                                    <div style={{fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '5px'}}><strong>Dx:</strong> {historia.diagnostico_cie}</div>
                                                                )}
                                                                {historia.plan_tratamiento && (
                                                                    <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}><strong>Plan:</strong> {historia.plan_tratamiento}</div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Tarjetas de Notas Anteriores */}
                                                        {notas.filter(n => n.id !== notaActiva).map((nota, idx) => (
                                                            <div key={nota.id} style={{background: 'var(--bg-panel)', padding: '15px', borderRadius: '10px', borderLeft: '4px solid #10b981', border: '1px solid var(--border-color)'}}>
                                                                <h5 style={{margin: '0 0 8px 0', color: '#10b981', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between'}}>
                                                                    {idx === 0 ? (t('ultimaNotaEvolucion') || 'Última Sesión') : (t('notaAnterior') || 'Sesión Previa')}
                                                                    <span style={{color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.75rem'}}>{formatDateOnly(nota.fecha_registro)}</span>
                                                                </h5>
                                                                {nota.evolucion && (
                                                                    <div style={{fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '5px', lineHeight: '1.4'}}><strong>Ev:</strong> {nota.evolucion}</div>
                                                                )}
                                                                {nota.procedimiento_tecnica && (
                                                                    <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4'}}><strong>Px:</strong> {nota.procedimiento_tecnica}</div>
                                                                )}
                                                            </div>
                                                        ))}
                                                        
                                                        {!historia && notas.length === 0 && (
                                                            <div style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px', fontStyle: 'italic'}}>
                                                                El paciente no tiene historial previo registrado.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                            </div>
                                        ) : (
                                            <div style={{textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', background: 'transparent', borderRadius: '12px', border: '1px dashed var(--border-color)'}}>
                                                <i className="fa-solid fa-notes-medical fa-4x" style={{marginBottom: '20px', opacity: 0.3}}></i>
                                                <h2 style={{color: 'var(--text-main)'}}>{t('seleccionaCreaNota')}</h2>
                                                <p>{t('historialEvolucionAparecera')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                ) : (
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-main)', color: 'var(--text-muted)'}}>
                        <div style={{background: 'var(--bg-panel)', padding: '40px 60px', borderRadius: '16px', textAlign: 'center', border: '1px dashed var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                            <i className="fa-solid fa-user-doctor fa-4x" style={{marginBottom: '25px', opacity: 0.3, color: 'var(--accent)'}}></i>
                            <h2 style={{color: 'var(--text-main)', marginBottom: '10px'}}>{t('escritorioClinico')}</h2>
                            <p style={{fontSize: '1.05rem'}}>{t('seleccionaPacienteDirectorio')}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL HOJA DE REFERENCIA */}
            {showReferenciaModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box animate-scale-in" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '550px', border: '1px solid rgba(234, 88, 12, 0.5)', boxShadow: '0 10px 30px rgba(234, 88, 12, 0.15)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '10px', color: 'var(--text-main)', fontSize: '1.5rem'}}><i className="fa-solid fa-truck-medical" style={{color: '#ea580c', marginRight: '10px'}}></i> {t('generarHojaReferencia')}</h3>
                        <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '30px'}}>{t('documentoOficialTraslado')}</p>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '35px'}}>
                            <div><label style={{display: 'block', fontSize: '0.9rem', color: '#ea580c', marginBottom: '8px', fontWeight: 'bold'}}>{t('hospitalReceptor')}</label><input disabled={isProcessingBtn} type="text" value={rForm.receptor} onChange={e => setRForm({...rForm, receptor: e.target.value})} placeholder="Ej. Hospital General..." style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none'}} autoFocus /></div>
                            <div><label style={{display: 'block', fontSize: '0.9rem', color: '#ea580c', marginBottom: '8px', fontWeight: 'bold'}}>{t('impresionDiagnostica')}</label><textarea disabled={isProcessingBtn} value={rForm.diagnostico} onChange={e => setRForm({...rForm, diagnostico: e.target.value})} placeholder="Ej. Crisis Hipertensiva..." style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', resize: 'vertical', minHeight: '80px', outline: 'none'}} /></div>
                            <div><label style={{display: 'block', fontSize: '0.9rem', color: '#ea580c', marginBottom: '8px', fontWeight: 'bold'}}>{t('motivoTraslado')}</label><textarea disabled={isProcessingBtn} value={rForm.motivo} onChange={e => setRForm({...rForm, motivo: e.target.value})} placeholder="Ej. Requiere valoración cardiológica urgente..." style={{width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', resize: 'vertical', minHeight: '80px', outline: 'none'}} /></div>
                        </div>
                        <div style={{display: 'flex', gap: '15px'}}>
                            <button disabled={isProcessingBtn} className="btn-action" onClick={() => setShowReferenciaModal(false)} style={{flex: 1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold', borderRadius: '8px', cursor: isProcessingBtn ? 'not-allowed' : 'pointer'}}>{t('cancelar')}</button>
                            <button disabled={isProcessingBtn} className="btn-action" onClick={generarPDFReferencia} style={{flex: 2, padding: '16px', background: '#ea580c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isProcessingBtn ? 'not-allowed' : 'pointer'}}><i className="fa-solid fa-print"></i> {t('generarDocumento')}</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .tab-btn { padding: 20px 10px; background: transparent; border: none; cursor: pointer; font-size: 1rem; font-weight: bold; transition: all 0.2s ease; }
                .tab-btn:hover { color: var(--text-main) !important; }
                .form-label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                .form-input { width: 100%; padding: 14px; background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 10px; font-size: 1.05rem; transition: all 0.3s ease; }
                .form-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15); }
                .form-input:disabled { opacity: 0.6; cursor: not-allowed; }
                
                .read-box { border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 15px; background: var(--bg-main); font-size: 1.05rem; color: var(--text-main); line-height: 1.5; }
                .read-box .label { font-weight: bold; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px; text-transform: uppercase; }
                .read-box-mini { padding: 12px; border-radius: 8px; background: var(--bg-main); font-size: 0.95rem; color: var(--text-main); line-height: 1.5; border: 1px solid var(--border-color); }
                .read-box-mini .label { font-weight: bold; font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px; text-transform: uppercase; }

                /* 🚀 CHIPS INTELIGENTES MÉDICOS */
                .med-chip { padding: 8px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 6px; border: 1px solid transparent; }
                .med-chip:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                .med-chip:active { transform: translateY(0); }

                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                .animate-slide-up-row { opacity: 0; animation: slideUpRow 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes slideUpRow { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                .pane-title { color: var(--text-main); font-size: 1.3rem; margin: 0 0 25px 0; padding-bottom: 15px; border-bottom: 1px solid var(--border-color); }

                /* 🚀 CSS MATRICES MTCh */
                .mtc-matrix-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                .mtc-matrix-table th { font-size: 0.95rem; padding: 10px 5px; border-bottom: 2px solid var(--border-color); white-space: nowrap; text-align: center; overflow: hidden; text-overflow: ellipsis; }
                .mtc-row-hover { transition: background-color 0.2s ease; }
                .mtc-row-hover:hover { background-color: rgba(125, 125, 125, 0.05); }
                .row-label { padding: 12px 10px; font-weight: bold; color: var(--text-muted); border-bottom: 1px solid var(--border-color); font-size: 0.95rem; text-align: left; width: 25%; }
                .cell-checkbox { text-align: center; border-bottom: 1px solid var(--border-color); padding: 8px 5px; cursor: pointer; }
                .custom-check { width: 24px; height: 24px; border: 2px solid var(--border-color); border-radius: 6px; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; transition: all 0.2s ease; }
                .custom-check.checked { border-color: transparent; }
                .cell-checkbox:hover .custom-check:not(.checked) { border-color: var(--text-muted); }
            `}</style>
        </div>
    );
}