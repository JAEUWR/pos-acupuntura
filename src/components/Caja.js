'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Caja({ branch = 'napoles' }) {
    const { t } = useLanguage();
    
    // FIX HIDRATACIÓN
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    // 🚀 FIX ZONA HORARIA: Convierte fechas UTC de Supabase a Hora Local exacta
    const parseDBDate = (dateStr) => {
        if (!dateStr) return new Date();
        let s = dateStr;
        if (!s.includes('Z') && !s.includes('+') && s.includes('T')) s += 'Z';
        else if (!s.includes('T')) s = s.replace(' ', 'T') + 'Z';
        return new Date(s);
    };

    const [saldo, setSaldo] = useState(0);
    const [movimientosTurno, setMovimientosTurno] = useState([]);
    const [historialGlobal, setHistorialGlobal] = useState([]);
    
    const [showModal, setShowModal] = useState(false);
    const [tipoMovimiento, setTipoMovimiento] = useState('ingreso');
    const [montoManual, setMontoManual] = useState('');
    const [motivoManual, setMotivoManual] = useState('');

    const [fechaTurno, setFechaTurno] = useState(new Date().toISOString().split('T')[0]);

    const [searchTermGlobal, setSearchTermGlobal] = useState('');
    const [filters, setFilters] = useState({ fecha: '', tipo: '', motivo: '', monto: '' });
    const [activeDropdown, setActiveDropdown] = useState(null);

    const [shiftToView, setShiftToView] = useState(null);

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const fetchCaja = async () => {
        const { data: caja } = await supabase.from('cajas_estado').select('saldo_actual').eq('sucursal_id', sucursalId).single();
        if (caja) setSaldo(parseFloat(caja.saldo_actual));

        const d = new Date(fechaTurno + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        const fechaFiltroAnterior = d.toISOString().split('T')[0];

        const { data: movs } = await supabase.from('movimientos_caja')
            .select('*')
            .eq('sucursal_id', sucursalId)
            .gte('fecha', `${fechaFiltroAnterior}T00:00:00`)
            .lte('fecha', `${fechaTurno}T23:59:59`)
            .order('fecha', { ascending: false });
        
        if (movs) {
            const lastCutIndex = movs.findIndex(m => m.tipo === 'corte_caja');
            let currentShiftMovs = [];
            if (lastCutIndex === -1) {
                currentShiftMovs = movs;
            } else {
                currentShiftMovs = movs.slice(0, lastCutIndex);
            }
            // Filtramos solo los del día visualmente seleccionado para no mezclar turnos pasados anidados
            setMovimientosTurno(currentShiftMovs.filter(m => m.fecha.startsWith(fechaTurno)));
        }

        const { data: histGlobal } = await supabase.from('movimientos_caja')
            .select('*')
            .eq('sucursal_id', sucursalId)
            .order('fecha', { ascending: false })
            .limit(500); 
        if (histGlobal) setHistorialGlobal(histGlobal);
    };

    useEffect(() => { if (isMounted) fetchCaja(); }, [branch, fechaTurno, isMounted]);

    let vEfectivo = 0, entManual = 0, salManual = 0;
    movimientosTurno.forEach(m => {
        const montoAbsoluto = Math.abs(parseFloat(m.monto));
        if (m.tipo === 'venta_efectivo') vEfectivo += montoAbsoluto;
        else if (m.tipo === 'ingreso_manual') entManual += montoAbsoluto;
        else if (m.tipo === 'retiro_manual') salManual += montoAbsoluto;
    });

    const esHoy = fechaTurno === new Date().toISOString().split('T')[0];
    
    let fondoInicial = 0;
    let totalCierreDelDia = 0;

    if (esHoy) {
        fondoInicial = Math.max(0, saldo - vEfectivo - entManual + salManual);
        totalCierreDelDia = saldo;
    } else {
        totalCierreDelDia = vEfectivo + entManual - salManual;
    }

    const imprimirTicketCorte = (fondo, ventas, entradas, salidas, total, fechaStr, listaMovimientos) => {
        const printWindow = window.open('', '_blank');
        
        let movsHtml = '';
        if (listaMovimientos && listaMovimientos.length > 0) {
            movsHtml += `<div class="line"></div><div class="center bold" style="margin: 10px 0;">--- ${t('detalleMovimientos') || 'DETALLE DE MOVIMIENTOS'} ---</div>`;
            [...listaMovimientos].reverse().forEach(m => {
                const time = parseDBDate(m.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const isSalida = m.tipo === 'retiro_manual';
                const sign = isSalida ? '-' : '+';
                movsHtml += `
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                    <span style="width:20%;">${time}</span>
                    <span style="width:55%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.motivo}</span>
                    <span style="width:25%; text-align:right;">${sign}$${Math.abs(parseFloat(m.monto)).toFixed(2)}</span>
                </div>`;
            });
            movsHtml += `<div class="line"></div>`;
        }

        const html = `
            <html><head><title>${t('ticketCorteTitulo') || 'Ticket de Corte'}</title>
            <style>
                body { font-family: 'Courier New', Courier, monospace; width: 320px; margin: 0 auto; padding: 20px 10px; color: #000; font-size: 14px; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .line { border-bottom: 1px dashed #000; margin: 12px 0; }
                .row { display: flex; justify-content: space-between; margin: 6px 0; }
                .title { font-size: 20px; margin-bottom: 5px; }
                .subtitle { font-size: 12px; margin-bottom: 15px; }
            </style>
            </head><body>
                <div class="center bold title">ACUPUNTURA H.K.</div>
                <div class="center subtitle">${t('sucursal') || 'Sucursal'} ${branch.toUpperCase()}</div>
                <div class="center bold" style="font-size: 16px;">${t('corteCajaTurno') || 'CORTE DE CAJA (TURNO)'}</div>
                
                <div class="line"></div>
                <div class="row"><span>${t('fecha') || 'Fecha'}:</span><span>${parseDBDate(fechaStr).toLocaleDateString()}</span></div>
                <div class="row"><span>${t('hora') || 'Hora'}:</span><span>${parseDBDate(fechaStr).toLocaleTimeString()}</span></div>
                
                ${movsHtml}
                
                <div class="row"><span>${t('fondoInicial') || 'Fondo Inicial'}:</span><span>$${parseFloat(fondo).toFixed(2)}</span></div>
                <div class="row"><span>${t('ventasEfectivo') || 'Ventas Efectivo'}:</span><span>+$${parseFloat(ventas).toFixed(2)}</span></div>
                <div class="row"><span>${t('entradas') || 'Entradas'}:</span><span>+$${parseFloat(entradas).toFixed(2)}</span></div>
                <div class="row"><span>${t('salidas') || 'Salidas/Retiros'}:</span><span>-$${parseFloat(salidas).toFixed(2)}</span></div>
                
                <div class="line"></div>
                <div class="row bold" style="font-size: 18px;"><span>${t('totalEnCaja') || 'TOTAL EN CAJA'}:</span><span>$${parseFloat(total).toFixed(2)}</span></div>
                <div class="line"></div>
                
                <div class="center" style="margin-top: 50px;">________________________</div>
                <div class="center">${t('firmaConformidad') || 'Firma de Conformidad'}</div>
                
                <div class="center" style="margin-top: 30px; font-size: 10px; color: #555;">
                    ${t('documentoAuditoria') || 'Documento de Auditoría'}<br/>${t('generadoAuto') || 'Generado automáticamente'}
                </div>
            </body></html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 800);
    };

    const registrarMovimiento = async () => {
        if (!montoManual || isNaN(montoManual) || parseFloat(montoManual) <= 0) return alert(t('alertaMontoInvalido') || 'Monto inválido.');
        if (!motivoManual) return alert(t('alertaMotivoVacio') || 'Debes especificar un motivo.');

        const montoFormateado = tipoMovimiento === 'ingreso' ? parseFloat(montoManual) : -parseFloat(montoManual);

        if (tipoMovimiento === 'retiro' && parseFloat(montoManual) > saldo) {
            return alert(t('alertaEfectivoInsuficiente') || 'No hay suficiente efectivo en caja para realizar este retiro.');
        }

        const { error } = await supabase.rpc('registrar_movimiento_caja', {
            p_sucursal_id: sucursalId,
            p_tipo: tipoMovimiento === 'ingreso' ? 'ingreso_manual' : 'retiro_manual',
            p_monto: montoFormateado,
            p_motivo: motivoManual.trim()
        });

        if (error) alert(t('error') + error.message);
        else {
            setShowModal(false); setMontoManual(''); setMotivoManual('');
            fetchCaja();
        }
    };

    const hacerCorteCaja = async () => {
        if (saldo <= 0) return alert(t('alertaCajaCero') || 'La caja está en cero.');
        if (!window.confirm(t('confirmarCorteLargo') || '¿Estás seguro de hacer el Corte de Caja?\n\nEl turno actual se cerrará, el dinero actual pasará a ser el Fondo de Caja del siguiente turno, los contadores volverán a cero y se imprimirá tu Ticket detallado.')) return;

        const snapshotTicket = `Corte|Fondo:${fondoInicial.toFixed(2)}|Ventas:${vEfectivo.toFixed(2)}|Entradas:${entManual.toFixed(2)}|Salidas:${salManual.toFixed(2)}|Total:${saldo.toFixed(2)}`;

        const { error } = await supabase.rpc('registrar_movimiento_caja', {
            p_sucursal_id: sucursalId,
            p_tipo: 'corte_caja',
            p_monto: 0, 
            p_motivo: snapshotTicket
        });

        if (error) alert(t('error') + error.message);
        else {
            alert(t('corteGenerandoTicket') || 'Corte de caja registrado exitosamente. Generando ticket...');
            imprimirTicketCorte(fondoInicial, vEfectivo, entManual, salManual, saldo, new Date().toISOString(), movimientosTurno);
            fetchCaja(); 
        }
    };

    const visualizarTurnoPasado = (movCorte, index) => {
        const prevCorte = historialGlobal.slice(index + 1).find(m => m.tipo === 'corte_caja');
        const startDate = prevCorte ? new Date(prevCorte.fecha).getTime() : 0;
        const endDate = new Date(movCorte.fecha).getTime();

        const movsDelTurno = historialGlobal.filter(m => {
            const mTime = new Date(m.fecha).getTime();
            return mTime > startDate && mTime < endDate && m.tipo !== 'corte_caja';
        });

        try {
            const parts = movCorte.motivo.split('|');
            const data = {
                fondo: parts[1] ? parts[1].split(':')[1] : '0.00',
                ventas: parts[2] ? parts[2].split(':')[1] : '0.00',
                entradas: parts[3] ? parts[3].split(':')[1] : '0.00',
                salidas: parts[4] ? parts[4].split(':')[1] : '0.00',
                total: parts[5] ? parts[5].split(':')[1] : '0.00',
                fecha: movCorte.fecha,
                movimientos: movsDelTurno
            };
            return data;
        } catch (e) { return null; }
    };

    const abrirDetallesHistoricos = (mov, index) => {
        const data = visualizarTurnoPasado(mov, index);
        if (data) setShiftToView(data);
        else alert(t('alertaCorteAntiguo') || "Este corte es muy antiguo y no posee el formato compatible para visualizar el desglose.");
    };

    const reimprimirTicketHistorico = (mov, index) => {
        const data = visualizarTurnoPasado(mov, index);
        if (data) imprimirTicketCorte(data.fondo, data.ventas, data.entradas, data.salidas, data.total, data.fecha, data.movimientos);
        else alert(t('alertaErrorTicket') || "No se pudo generar el ticket.");
    };

    const getEtiqueta = (tipo) => {
        if (tipo === 'venta_efectivo') return <span style={{background: 'rgba(22, 163, 74, 0.15)', color: 'var(--success)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold'}}><i className="fa-solid fa-basket-shopping"></i> {t('ventaEfectivo') || 'Venta'}</span>;
        if (tipo === 'ingreso_manual') return <span style={{background: 'rgba(2, 132, 199, 0.15)', color: 'var(--accent)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold'}}><i className="fa-solid fa-arrow-down"></i> {t('ingresoManual') || 'Ingreso'}</span>;
        if (tipo === 'retiro_manual') return <span style={{background: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold'}}><i className="fa-solid fa-arrow-up"></i> {t('retiroManual') || 'Retiro'}</span>;
        if (tipo === 'corte_caja') return <span style={{background: 'var(--text-main)', color: 'var(--bg-panel)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '900'}}><i className="fa-solid fa-scissors"></i> {t('corteDeCaja') || 'Corte Caja'}</span>;
        return <span style={{background: 'var(--bg-lighter)', color: 'var(--text-muted)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold'}}>{tipo}</span>;
    };

    const getUniqueValues = (list, column) => {
        const vals = list.map(item => {
            if (column === 'fecha') return parseDBDate(item.fecha).toLocaleDateString();
            if (column === 'monto') return `$${Math.abs(item.monto).toFixed(2)}`;
            if (column === 'tipo') {
                if (item.tipo === 'venta_efectivo') return t('ventaEfectivo') || 'Venta Efectivo';
                if (item.tipo === 'ingreso_manual') return t('ingresoManual') || 'Ingreso Manual';
                if (item.tipo === 'retiro_manual') return t('retiroManual') || 'Retiro Manual';
                if (item.tipo === 'corte_caja') return t('corteDeCaja') || 'Corte Caja';
                return item.tipo;
            }
            return String(item[column] || '');
        });
        return [...new Set(vals)].sort();
    };

    const renderColumnHeader = (title, column) => {
        const isActive = activeDropdown === column;
        const hasFilter = filters[column] && filters[column] !== '';
        const uniqueValues = getUniqueValues(historialGlobal, column);
        const currentValue = filters[column];

        return (
            <th style={{ position: 'relative', padding: '15px 30px', userSelect: 'none', transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setActiveDropdown(isActive ? null : column)}>
                    <span style={{ color: hasFilter ? 'var(--accent)' : 'var(--text-muted)', fontWeight: hasFilter ? 'bold' : '600' }}>{title}</span>
                    <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7rem', color: hasFilter ? 'var(--accent)' : 'var(--text-muted)', transition: 'transform 0.3s ease', transform: isActive ? 'rotate(180deg)' : 'rotate(0)' }}></i>
                </div>
                
                {isActive && (
                    <>
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} onClick={() => setActiveDropdown(null)}></div>
                        <div className="filter-popover" style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', zIndex: 11, width: '220px', boxShadow: 'var(--shadow-lg)', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                            <input 
                                type="text" placeholder={t('buscarHistorial') || "🔍 Buscar..."} value={currentValue}
                                onChange={(e) => setFilters(prev => ({...prev, [column]: e.target.value}))}
                                style={{ width: '100%', padding: '10px', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '10px', fontSize: '0.85rem', outline: 'none' }}
                                autoFocus
                            />
                            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '5px' }}>
                                {uniqueValues.filter(v => v.toLowerCase().includes(currentValue.toLowerCase())).map((val, idx) => (
                                    <div key={idx} 
                                         style={{ fontSize: '0.85rem', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)', transition: 'all 0.2s', fontWeight: currentValue === val ? 'bold' : 'normal' }}
                                         onClick={() => { setFilters(prev => ({...prev, [column]: val})); setActiveDropdown(null); }}
                                         onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-dark)'; }}
                                         onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        {val}
                                    </div>
                                ))}
                            </div>
                            {hasFilter && (
                                <button onClick={() => { setFilters(prev => ({...prev, [column]: ''})); setActiveDropdown(null); }} style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'rgba(211, 47, 47, 0.1)', border: '1px solid var(--primary-red)', color: 'var(--primary-red)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.2s' }}>{t('borrarFiltro') || 'Borrar Filtro'}</button>
                            )}
                        </div>
                    </>
                )}
            </th>
        );
    };

    const historialGlobalFiltrado = historialGlobal.filter(mov => {
        const term = searchTermGlobal.toLowerCase();
        const dateStr = parseDBDate(mov.fecha).toLocaleString().toLowerCase();
        const typeStr = mov.tipo.toLowerCase();
        const reasonStr = (mov.motivo || '').toLowerCase();
        const amountStr = mov.monto.toString();

        const matchesSearch = dateStr.includes(term) || typeStr.includes(term) || reasonStr.includes(term) || amountStr.includes(term);
        if (!matchesSearch) return false;

        return Object.keys(filters).every(key => {
            if (!filters[key]) return true;
            const filterVal = filters[key].toLowerCase();
            let itemVal = '';
            
            if (key === 'fecha') itemVal = parseDBDate(mov.fecha).toLocaleDateString().toLowerCase();
            else if (key === 'monto') itemVal = `$${Math.abs(mov.monto).toFixed(2)}`.toLowerCase();
            else if (key === 'tipo') {
                if (mov.tipo === 'venta_efectivo') itemVal = (t('ventaEfectivo') || 'venta efectivo').toLowerCase();
                else if (mov.tipo === 'ingreso_manual') itemVal = (t('ingresoManual') || 'ingreso manual').toLowerCase();
                else if (mov.tipo === 'retiro_manual') itemVal = (t('retiroManual') || 'retiro manual').toLowerCase();
                else if (mov.tipo === 'corte_caja') itemVal = (t('corteDeCaja') || 'corte caja').toLowerCase();
                else itemVal = mov.tipo.toLowerCase();
            }
            else itemVal = String(mov[key] || '').toLowerCase();

            return itemVal.includes(filterVal);
        });
    });

    if (!isMounted) return null;

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '25px', overflowY: 'auto', paddingRight: '5px'}}>
            
            <div style={{display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '25px'}}>
                
                {/* 🚀 PANEL IZQUIERDO: BILLETERA ANIMADA Y ULTRA MODERNA PREMIUM DARK/EMERALD */}
                <div className="modern-wallet animate-fade-in" style={{display: 'flex', flexDirection: 'column', padding: '0', borderRadius: '24px', overflow: 'hidden', position: 'relative', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                    
                    {/* Header Dark Glassmorphism Premium */}
                    <div style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)', 
                        padding: '50px 30px', 
                        textAlign: 'center', 
                        borderBottom: '1px solid rgba(255,255,255,0.1)', 
                        position: 'relative', 
                        zIndex: 2,
                        color: 'white'
                    }}>
                        <div className="wallet-bg-glow"></div>
                        <div style={{background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', position: 'relative', zIndex: 3}}>
                            <i className="fa-solid fa-cash-register" style={{fontSize: '1.8rem', color: '#10b981'}}></i>
                        </div>
                        <h3 style={{color: 'rgba(255,255,255,0.7)', margin: 0, textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.9rem', fontWeight: 'bold', position: 'relative', zIndex: 3}}>{esHoy ? t('efectivoActualCaja') || 'Efectivo Actual en Caja' : t('flujoFecha') || 'Flujo de la Fecha'}</h3>
                        <h1 className="pulse-glow" style={{fontSize: '4.5rem', margin: '15px 0', color: '#ffffff', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '-2px', textShadow: '0 4px 20px rgba(0,0,0,0.3)', position: 'relative', zIndex: 3}}>${totalCierreDelDia.toFixed(2)}</h1>
                        <span style={{color: '#10b981', fontSize: '0.85rem', fontWeight: '900', background: 'rgba(16, 185, 129, 0.15)', padding: '6px 16px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)', letterSpacing: '1px', backdropFilter: 'blur(5px)', position: 'relative', zIndex: 3}}><i className="fa-solid fa-store" style={{marginRight: '8px'}}></i> {branch.toUpperCase()}</span>
                    </div>

                    <div style={{padding: '30px', position: 'relative', zIndex: 2, background: 'var(--bg-panel)'}}>
                        <div style={{color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px'}}>{t('desgloseTurnoActual') || 'Desglose del Turno Actual'}</div>
                        
                        <div className="receipt-row">
                            <span className="r-label">{t('fondoCaja') || 'Fondo de caja'}</span>
                            <span className="r-value neutral">${fondoInicial.toFixed(2)}</span>
                        </div>
                        <div className="receipt-row">
                            <span className="r-label">{t('ventasEfectivoAbrev') || 'Ventas Efectivo'}</span>
                            <span className="r-value positive">+ ${vEfectivo.toFixed(2)}</span>
                        </div>
                        <div className="receipt-row">
                            <span className="r-label">{t('entradas') || 'Entradas'}</span>
                            <span className="r-value positive">+ ${entManual.toFixed(2)}</span>
                        </div>
                        <div className="receipt-row" style={{marginBottom: '20px'}}>
                            <span className="r-label">{t('salidas') || 'Salidas / Retiros'}</span>
                            <span className="r-value negative">- ${salManual.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Botonera Flotante */}
                    <div style={{padding: '0 30px 30px 30px', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative', zIndex: 2}}>
                        <div style={{display: 'flex', width: '100%', gap: '15px'}}>
                            <button className="btn-modern-action" onClick={() => {setTipoMovimiento('ingreso'); setShowModal(true);}} style={{ '--btn-color': 'var(--accent)' }}>
                                <i className="fa-solid fa-arrow-down-to-line"></i> {t('entradaBtn') || 'Entrada'}
                            </button>
                            <button className="btn-modern-action" onClick={() => {setTipoMovimiento('retiro'); setShowModal(true);}} style={{ '--btn-color': '#ea580c' }}>
                                <i className="fa-solid fa-arrow-up-from-bracket"></i> {t('salidaBtn') || 'Salida'}
                            </button>
                        </div>
                        <button className="btn-primary" onClick={hacerCorteCaja} style={{width: '100%', padding: '18px', background: 'var(--text-main)', color: 'var(--bg-panel)', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '900', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', transition: 'transform 0.2s', textTransform: 'uppercase', letterSpacing: '1px'}}>
                            <i className="fa-solid fa-scissors" style={{marginRight: '10px'}}></i> {t('cerrarTurnoCortarCaja') || 'Cerrar Turno y Cortar Caja'}
                        </button>
                    </div>
                </div>

                {/* 🚀 PANEL DERECHO: FEED DE TRANSACCIONES ELEGANTES */}
                <div className="panel animate-fade-in-delayed" style={{background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '0', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-sm)'}}>
                    <div style={{padding: '30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: '900'}}><i className="fa-solid fa-bolt" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('actividadTurno') || 'Actividad del Turno'}</h2>
                        <span style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', padding: '6px 15px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold'}}>{movimientosTurno.length} {t('movimientos') || 'Movimientos'}</span>
                    </div>
                    
                    <div style={{flex: 1, overflowY: 'auto', padding: '25px', maxHeight: '550px'}}>
                        {movimientosTurno.length === 0 ? (
                            <div style={{textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)'}}>
                                <div style={{width: '80px', height: '80px', background: 'var(--bg-main)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', border: '1px dashed var(--border-color)'}}>
                                    <i className="fa-solid fa-receipt fa-2x" style={{opacity: 0.5}}></i>
                                </div>
                                <h3 style={{color: 'var(--text-main)', marginBottom: '5px'}}>{t('sinActividad') || 'Aún no hay actividad'}</h3>
                                <span style={{fontSize: '0.9rem'}}>{t('sinActividadDesc') || 'Las ventas y movimientos aparecerán aquí.'}</span>
                            </div>
                        ) : (
                            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                {movimientosTurno.map((mov, idx) => {
                                    let icon = "fa-solid fa-money-bill"; let iconBg = "var(--bg-main)"; let iconColor = "var(--text-muted)"; let amountColor = "var(--text-main)"; let sign = "";
                                    if (mov.tipo === 'venta_efectivo') { icon = "fa-solid fa-basket-shopping"; iconBg = "rgba(22, 163, 74, 0.1)"; iconColor = "var(--success)"; amountColor = "var(--success)"; sign = "+"; } 
                                    else if (mov.tipo === 'ingreso_manual') { icon = "fa-solid fa-arrow-down"; iconBg = "rgba(2, 132, 199, 0.1)"; iconColor = "var(--accent)"; amountColor = "var(--success)"; sign = "+"; } 
                                    else if (mov.tipo === 'retiro_manual') { icon = "fa-solid fa-arrow-up"; iconBg = "rgba(234, 88, 12, 0.1)"; iconColor = "#ea580c"; amountColor = "var(--primary-red)"; sign = "-"; }

                                    return (
                                        <div key={`turno-${mov.id}`} className="tx-card animate-slide-up" style={{animationDelay: `${idx * 0.05}s`}}>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                                                <div className="tx-icon" style={{background: iconBg, color: iconColor}}><i className={icon}></i></div>
                                                <div style={{display: 'flex', flexDirection: 'column'}}>
                                                    <strong style={{color: 'var(--text-main)', fontSize: '1.05rem', marginBottom: '4px'}}>{mov.motivo}</strong>
                                                    <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600'}}>{parseDBDate(mov.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {mov.tipo.replace('_', ' ').toUpperCase()}</span>
                                                </div>
                                            </div>
                                            <div style={{fontWeight: '900', fontSize: '1.2rem', color: amountColor, fontFamily: 'monospace', letterSpacing: '-0.5px'}}>{sign} ${Math.abs(parseFloat(mov.monto)).toFixed(2)}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* HISTORIAL GLOBAL DE CAJA (AUDITORÍA) */}
            <div className="panel" style={{background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '0', boxShadow: 'var(--shadow-sm)'}}>
                <div style={{padding: '25px 30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '24px', borderTopRightRadius: '24px'}}>
                    <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: '900'}}><i className="fa-solid fa-clock-rotate-left" style={{color: 'var(--text-muted)', marginRight: '10px'}}></i> {t('historialAuditoriaGlobal') || 'Historial y Auditoría Global'}</h2>
                    
                    {/* Selector de Fecha Extra */}
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-panel)', padding: '8px 15px', borderRadius: '10px', border: '1px solid var(--border-color)', marginRight: '15px'}}>
                        <i className="fa-regular fa-calendar" style={{color: 'var(--text-muted)'}}></i>
                        <input 
                            type="date" 
                            value={fechaTurno} 
                            onChange={e => setFechaTurno(e.target.value)} 
                            style={{background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold'}} 
                        />
                    </div>

                    <div style={{position: 'relative', width: '350px'}}>
                        <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}}></i>
                        <input type="text" placeholder={t('buscarHistorial') || "Buscar en el historial completo..."} value={searchTermGlobal} onChange={e => setSearchTermGlobal(e.target.value)} style={{width: '100%', padding: '12px 12px 12px 45px', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.95rem', outline: 'none', transition: 'all 0.3s'}} />
                    </div>
                </div>
                <div style={{overflowY: 'auto', maxHeight: '400px'}}>
                    <table className="data-table">
                        <thead style={{position: 'sticky', top: 0, background: 'var(--bg-main)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', zIndex: 1}}>
                            <tr>
                                {renderColumnHeader(t('fechaHoraCompleta') || 'Fecha y Hora', 'fecha')}
                                {renderColumnHeader(t('tipoMovimiento') || 'Movimiento', 'tipo')}
                                {renderColumnHeader(t('motivoDetalles') || 'Motivo / Detalles', 'motivo')}
                                {renderColumnHeader(t('importe') || 'Importe', 'monto')}
                                <th style={{textAlign: 'center'}}><i className="fa-solid fa-eye"></i> / <i className="fa-solid fa-print"></i></th>
                            </tr>
                        </thead>
                        <tbody>
                            {historialGlobalFiltrado.map((mov, index) => (
                                <tr key={`glob-${mov.id}`} style={{background: mov.tipo === 'corte_caja' ? 'rgba(2, 132, 199, 0.03)' : 'transparent'}}>
                                    <td style={{fontSize: '0.9rem', color: 'var(--text-muted)', padding: '20px 30px', fontWeight: '600'}}>{parseDBDate(mov.fecha).toLocaleString()}</td>
                                    <td>{getEtiqueta(mov.tipo)}</td>
                                    <td style={{color: 'var(--text-main)', fontSize: '0.95rem'}}>
                                        {mov.tipo === 'corte_caja' ? <strong style={{color: 'var(--text-main)'}}><i className="fa-solid fa-check-double" style={{color: 'var(--accent)', marginRight: '5px'}}></i> {t('cierreTurnoAuditoria') || 'Cierre de Turno y Auditoría'}</strong> : mov.motivo}
                                    </td>
                                    <td style={{textAlign: 'right', fontWeight: '900', fontSize: '1.2rem', color: mov.tipo === 'corte_caja' ? 'var(--text-main)' : (mov.monto > 0 ? 'var(--success)' : 'var(--primary-red)'), padding: '20px 30px', fontFamily: 'monospace'}}>
                                        {mov.tipo === 'corte_caja' ? '--' : (mov.monto > 0 ? '+' : '') + parseFloat(mov.monto).toFixed(2)}
                                    </td>
                                    <td style={{textAlign: 'center'}}>
                                        {mov.tipo === 'corte_caja' && (
                                            <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                                                <button onClick={() => abrirDetallesHistoricos(mov, index)} className="btn-action" style={{background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold'}} title="Ver Detalles del Turno">
                                                    <i className="fa-solid fa-eye"></i> {t('detalleBtn') || 'Detalle'}
                                                </button>
                                                <button onClick={() => reimprimirTicketHistorico(mov, index)} className="btn-action" style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold'}} title="Reimprimir Ticket">
                                                    <i className="fa-solid fa-print"></i>
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {historialGlobalFiltrado.length === 0 && <tr><td colSpan="5" style={{textAlign: 'center', padding: '60px', color: 'var(--text-muted)'}}><i className="fa-solid fa-file-invoice fa-3x" style={{marginBottom: '15px', display: 'block', opacity: 0.3}}></i> {t('noRegistros') || 'No se encontraron registros.'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 🚀 MODAL DE VISUALIZACIÓN DE TURNOS PASADOS (NUEVO) */}
            {shiftToView && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box animate-scale-in" style={{background: 'var(--bg-panel)', padding: '0', borderRadius: '24px', width: '600px', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden'}}>
                        <div style={{background: 'var(--bg-main)', padding: '25px 30px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h3 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: '900'}}><i className="fa-solid fa-box-archive" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('detallesTurnoPasado') || 'Detalles del Turno Pasado'}</h3>
                            <button onClick={() => setShiftToView(null)} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer'}}>&times;</button>
                        </div>
                        
                        <div style={{padding: '30px'}}>
                            <div style={{background: 'var(--bg-main)', padding: '20px', borderRadius: '12px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border-color)'}}>
                                <div><span style={{color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '5px'}}>{t('fechaHoraCierre') || 'Fecha y Hora de Cierre'}</span><strong style={{fontSize: '1.1rem', color: 'var(--text-main)'}}>{parseDBDate(shiftToView.fecha).toLocaleString()}</strong></div>
                                <div style={{textAlign: 'right'}}><span style={{color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '5px'}}>{t('totalAuditado') || 'Total Auditado'}</span><strong style={{fontSize: '1.3rem', color: 'var(--success)', fontFamily: 'monospace'}}>${parseFloat(shiftToView.total).toFixed(2)}</strong></div>
                            </div>

                            <div style={{background: 'rgba(2, 132, 199, 0.03)', padding: '20px', borderRadius: '12px', border: '1px dashed var(--accent)', marginBottom: '25px'}}>
                                <div className="receipt-row"><span className="r-label">{t('fondoCaja') || 'Fondo de caja'}</span><span className="r-value neutral">${parseFloat(shiftToView.fondo).toFixed(2)}</span></div>
                                <div className="receipt-row"><span className="r-label">{t('ventasEfectivoAbrev') || 'Ventas en Efectivo'}</span><span className="r-value positive">+ ${parseFloat(shiftToView.ventas).toFixed(2)}</span></div>
                                <div className="receipt-row"><span className="r-label">{t('entradasManuales') || 'Entradas Manuales'}</span><span className="r-value positive">+ ${parseFloat(shiftToView.entradas).toFixed(2)}</span></div>
                                <div className="receipt-row"><span className="r-label">{t('salidasRetiros') || 'Salidas / Retiros'}</span><span className="r-value negative">- ${parseFloat(shiftToView.salidas).toFixed(2)}</span></div>
                            </div>

                            <h4 style={{color: 'var(--text-main)', marginBottom: '15px', fontSize: '1.1rem'}}><i className="fa-solid fa-list-ol" style={{color: 'var(--text-muted)', marginRight: '8px'}}></i> {t('transaccionesTurno') || 'Transacciones del Turno'} ({shiftToView.movimientos.length})</h4>
                            <div style={{maxHeight: '200px', overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                {shiftToView.movimientos.map((m, i) => (
                                    <div key={i} style={{display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center'}}>
                                        <div>
                                            <strong style={{display: 'block', color: 'var(--text-main)', fontSize: '0.95rem'}}>{m.motivo}</strong>
                                            <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{parseDBDate(m.fecha).toLocaleTimeString()} • {m.tipo.replace('_', ' ').toUpperCase()}</span>
                                        </div>
                                        <div style={{fontWeight: 'bold', fontFamily: 'monospace', color: m.monto > 0 ? 'var(--success)' : 'var(--primary-red)'}}>
                                            {m.monto > 0 ? '+' : ''}${Math.abs(parseFloat(m.monto)).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                                {shiftToView.movimientos.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: '20px'}}>{t('noTransaccionesTurno') || 'No hubo transacciones registradas en este turno.'}</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL INGRESOS Y RETIROS MANUALES */}
            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box animate-scale-in" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '24px', width: '450px', border: `1px solid ${tipoMovimiento === 'ingreso' ? 'var(--accent)' : '#ea580c'}`, boxShadow: `0 20px 50px ${tipoMovimiento === 'ingreso' ? 'rgba(2, 132, 199, 0.2)' : 'rgba(234, 88, 12, 0.2)'}`, textAlign: 'left'}}>
                        <h3 style={{marginBottom: '15px', color: tipoMovimiento === 'ingreso' ? 'var(--accent)' : '#ea580c', fontSize: '1.6rem', textAlign: 'center', fontWeight: '900'}}>
                            {tipoMovimiento === 'ingreso' ? <><i className="fa-solid fa-arrow-down-to-line"></i> {t('ingresoCajaTitulo') || 'Ingreso a Caja'}</> : <><i className="fa-solid fa-arrow-up-from-bracket"></i> {t('retiroCajaTitulo') || 'Retiro de Caja'}</>}
                        </h3>
                        
                        {tipoMovimiento === 'ingreso' && (
                            <p style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '25px'}}>
                                💡 {t('tipFondoCaja') || 'Tip: Si es para arrancar el turno, incluye la palabra "Fondo" en el motivo.'}
                            </p>
                        )}
                        
                        <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>{t('monto') || 'Monto'} ($)</label>
                        <input 
                            type="number" 
                            value={montoManual} 
                            onChange={(e) => setMontoManual(e.target.value)} 
                            placeholder="0.00" 
                            autoFocus
                            style={{width:'100%', padding:'20px', marginBottom:'25px', background:'var(--bg-main)', color:'var(--text-main)', border: `2px solid ${tipoMovimiento === 'ingreso' ? 'var(--accent)' : '#ea580c'}`, borderRadius: '12px', fontSize: '2rem', fontWeight: '900', textAlign: 'center', outline: 'none', transition: 'all 0.3s'}} 
                        />
                        
                        <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>{t('motivo') || 'Motivo / Concepto'}</label>
                        <input 
                            type="text" 
                            value={motivoManual} 
                            onChange={(e) => setMotivoManual(e.target.value)} 
                            placeholder={tipoMovimiento === 'ingreso' ? 'Ej. Fondo de caja, abono...' : 'Ej. Pago de proveedores, agua...'} 
                            style={{width:'100%', padding:'16px', marginBottom:'35px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '1.05rem', outline: 'none'}} 
                        />
                        
                        <div style={{display:'flex', gap:'15px'}}>
                            <button className="btn-action" style={{flex:1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.05rem'}} onClick={() => setShowModal(false)}>{t('cancelar') || 'Cancelar'}</button>
                            <button className="btn-primary" style={{flex:2, padding: '16px', background: tipoMovimiento === 'ingreso' ? 'var(--accent)' : '#ea580c', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '1.05rem', cursor: 'pointer', boxShadow: `0 10px 20px ${tipoMovimiento === 'ingreso' ? 'rgba(2, 132, 199, 0.4)' : 'rgba(234, 88, 12, 0.4)'}`}} onClick={registrarMovimiento}><i className="fa-solid fa-bolt"></i> {t('registrarBtn') || 'Registrar'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🚀 ANIMACIONES Y ESTILOS SUPER PREMIUM */}
            <style jsx>{`
                .modern-wallet {
                    background: linear-gradient(145deg, var(--bg-panel) 0%, var(--bg-main) 100%);
                    position: relative;
                    z-index: 1;
                }
                .wallet-bg-glow {
                    position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
                    background: radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 50%);
                    z-index: 0; animation: rotateGlow 20s linear infinite; pointer-events: none;
                }

                .btn-modern-action {
                    flex: 1; padding: 16px; border-radius: 12px; font-weight: 900; font-size: 1.05rem;
                    background: var(--bg-main); color: var(--btn-color);
                    border: 1px solid var(--border-color); cursor: pointer; transition: all 0.3s ease;
                }
                .btn-modern-action:hover {
                    background: var(--btn-color); color: white; border-color: var(--btn-color);
                    transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.1);
                }

                .receipt-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 1rem; }
                .r-label { color: var(--text-muted); font-weight: 600; }
                .r-value { font-family: monospace; font-weight: bold; font-size: 1.15rem; }
                .r-value.neutral { color: var(--text-main); }
                .r-value.positive { color: var(--success); }
                .r-value.negative { color: var(--primary-red); }

                .tx-card {
                    display: flex; justify-content: space-between; align-items: center; 
                    padding: 18px 25px; background: var(--bg-main); 
                    border: 1px solid var(--border-color); border-radius: 16px; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .tx-card:hover {
                    transform: translateX(8px); border-color: var(--accent);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.08); background: var(--bg-panel);
                }
                .tx-icon {
                    width: 50px; height: 50px; border-radius: 14px; display: flex; 
                    align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0;
                }

                .filter-popover { animation: popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }

                .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                .animate-fade-in-delayed { animation: fadeIn 0.5s ease-out 0.2s forwards; opacity: 0; }
                .animate-slide-up { animation: slideUp 0.4s ease-out forwards; opacity: 0; }
                .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .pulse-glow { animation: pulseGlow 3s ease-in-out infinite alternate; }

                @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes rotateGlow { 100% { transform: rotate(360deg); } }
                @keyframes pulseGlow {
                    0% { text-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                    100% { text-shadow: 0 4px 30px rgba(16, 185, 129, 0.4); }
                }
            `}</style>
        </div>
    );
}