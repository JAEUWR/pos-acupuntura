'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Reportes({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage();
    
    // 🚀 ESCUDO DE HIDRATACIÓN
    const [isMounted, setIsMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // 🚀 PARCHE ZONA HORARIA (Ajusta la hora UTC a la local)
    const parseDBDate = (dateStr) => {
        if (!dateStr) return new Date();
        let s = dateStr;
        if (!s.includes('Z') && !s.includes('+') && s.includes('T')) s += 'Z';
        else if (!s.includes('T')) s = s.replace(' ', 'T') + 'Z';
        return new Date(s);
    };
    
    // Controles de Vista y Fechas (Inician en blanco para evitar mismatch)
    const [dateMode, setDateMode] = useState('diario'); 
    const [singleDate, setSingleDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    const [viewMode, setViewMode] = useState('sucursal'); 

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    // Estados de Datos Originales
    const [kpis, setKpis] = useState({ consultas: 0, productos: 0, total: 0 });
    const [listaConsultas, setListaConsultas] = useState([]);
    const [listaProductos, setListaProductos] = useState([]);

    // Estados para Filtros Avanzados (Estilo Excel Popover)
    const [filtersA, setFiltersA] = useState({ folio: '', fecha: '', sucursal: '', cliente: '', articulo: '', cantidad: '', metodo_pago: '', importe: '' });
    const [filtersB, setFiltersB] = useState({ folio: '', fecha: '', sucursal: '', cliente: '', articulo: '', cantidad: '', metodo_pago: '', importe: '' });
    
    const [activeDropdownA, setActiveDropdownA] = useState(null);
    const [activeDropdownB, setActiveDropdownB] = useState(null);

    // Inicializar fechas de forma segura en el cliente
    useEffect(() => {
        setIsMounted(true);
        const today = new Date().toISOString().split('T')[0];
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        setSingleDate(today);
        setStartDate(firstDay);
        setEndDate(today);
    }, []);

    // 🚀 MOTOR ANALIZADOR DE PAGOS MIXTOS (A PRUEBA DE ERRORES)
    const extraerValoresMixtos = (pagoString, importeDetalle, totalVentaOriginal) => {
        let valores = { efectivo: 0, tarjeta: 0, transferencia: 0 };
        try {
            const proporcion = totalVentaOriginal > 0 ? (importeDetalle / totalVentaOriginal) : 1;
            
            const efeMatch = pagoString.match(/Efe:\s*\$?([\d.]+)/i);
            if (efeMatch) valores.efectivo = parseFloat(efeMatch[1]) * proporcion;

            const tarMatch = pagoString.match(/Tar(?:[^:]*):\s*\$?([\d.]+)/i);
            if (tarMatch) valores.tarjeta = parseFloat(tarMatch[1]) * proporcion;

            const traMatch = pagoString.match(/Tra:\s*\$?([\d.]+)/i);
            if (traMatch) valores.transferencia = parseFloat(traMatch[1]) * proporcion;
        } catch (e) {
            console.error("Error parseando pago mixto:", e);
        }
        return valores;
    };

    const calculateDashboardData = async () => {
        if (!singleDate) return; // Esperar a la hidratación
        setLoading(true);
        
        let query = supabase.from('ventas').select(`
            id, total, fecha, metodo_pago, sucursal_id,
            sucursales ( nombre ), clientes ( nombre ),
            venta_detalles (
                cantidad, precio_unitario, tipo_precio,
                productos ( id, nombre, tipo, codigo_barras, es_consulta )
            )
        `).order('fecha', { ascending: false });

        if (dateMode === 'diario') {
            query = query.gte('fecha', `${singleDate}T00:00:00`).lte('fecha', `${singleDate}T23:59:59`);
        } else {
            query = query.gte('fecha', `${startDate}T00:00:00`).lte('fecha', `${endDate}T23:59:59`);
        }

        if (viewMode === 'sucursal') {
            query = query.eq('sucursal_id', sucursalId);
        }

        const { data: ventas, error } = await query;

        if (error) {
            console.error("Error al extraer reportes:", error.message);
            setLoading(false);
            return;
        }

        let totalA = 0; 
        let totalB = 0; 
        let arrConsultas = [];
        let arrProductos = [];

        ventas.forEach(v => {
            const clienteNombre = v.clientes?.nombre || t('publicoGeneral') || 'Público General';
            const sucursalNombre = v.sucursales?.nombre || t('general') || 'General';
            const pago = v.metodo_pago || t('efectivo') || 'Efectivo';
            const totalVentaOriginal = parseFloat(v.total) || 0;

            v.venta_detalles?.forEach(det => {
                const cant = parseInt(det.cantidad);
                const precio = parseFloat(det.precio_unitario);
                const importeDetalle = cant * precio;
                const nombreItem = det.productos?.nombre || t('articuloEliminado') || 'Artículo Eliminado';
                const esConsultaOficial = det.productos?.es_consulta === true; 
                
                const esMixto = pago.toLowerCase().includes('mixto');
                let valoresMixtos = { efectivo: 0, tarjeta: 0, transferencia: 0 };
                
                if (esMixto) {
                    valoresMixtos = extraerValoresMixtos(pago, importeDetalle, totalVentaOriginal);
                }

                const registro = {
                    folio: v.id, fecha: parseDBDate(v.fecha).toLocaleString(),
                    sucursal: sucursalNombre, cliente: clienteNombre,
                    articulo: nombreItem, cantidad: cant, precio: precio,
                    importe: importeDetalle, metodo_pago: pago,
                    esMixto, valoresMixtos
                };

                if (esConsultaOficial) {
                    totalA += importeDetalle; arrConsultas.push(registro);
                } else {
                    totalB += importeDetalle; arrProductos.push(registro);
                }
            });
        });

        setKpis({ consultas: totalA, productos: totalB, total: totalA + totalB });
        setListaConsultas(arrConsultas);
        setListaProductos(arrProductos);
        setLoading(false);
    };

    useEffect(() => { calculateDashboardData(); }, [dateMode, singleDate, startDate, endDate, viewMode, branch]);

    const applyFilters = (list, filters) => {
        return list.filter(item => {
            return Object.keys(filters).every(key => {
                if (!filters[key]) return true;
                const filterValue = String(filters[key]).toLowerCase();
                let itemValue = String(item[key] || '').toLowerCase();
                
                if (key === 'folio') itemValue = `#${item.folio.toString().padStart(5, '0')}`.toLowerCase();
                if (key === 'importe') itemValue = `$${item.importe.toFixed(2)}`.toLowerCase();
                
                return itemValue.includes(filterValue);
            });
        });
    };

    const consultasFiltradas = applyFilters(listaConsultas, filtersA);
    const productosFiltrados = applyFilters(listaProductos, filtersB);

    const clasificarPago = (metodoString) => {
        const str = metodoString.toLowerCase();
        if (str.includes('mixto')) return 'mixto';
        if (str.includes('efectivo') || str.includes('cash') || str.includes('现金')) return 'efectivo';
        if (str.includes('tarjeta') || str.includes('card') || str.includes('刷卡')) return 'tarjeta';
        if (str.includes('transferencia') || str.includes('folio') || str.includes('transfer') || str.includes('转账')) return 'transferencia';
        return 'otros';
    };

    const desglosar = (lista) => {
        const desglose = { total: 0, efectivo: 0, tarjeta: 0, transferencia: 0, otros: 0 };
        lista.forEach(item => {
            desglose.total += item.importe;
            const tipoPago = clasificarPago(item.metodo_pago);
            
            if (tipoPago === 'mixto') {
                // 🚀 BLINDAJE ANTI-UNDEFINED: Usamos ?. y || 0 para evitar que colapse si el objeto falta
                desglose.efectivo += item.valoresMixtos?.efectivo || 0;
                desglose.tarjeta += item.valoresMixtos?.tarjeta || 0;
                desglose.transferencia += item.valoresMixtos?.transferencia || 0;
            } else {
                desglose[tipoPago] += item.importe;
            }
        });
        return desglose;
    };

    const breakdownA = desglosar(consultasFiltradas);
    const breakdownB = desglosar(productosFiltrados);
    
    const breakdownTotal = {
        total: breakdownA.total + breakdownB.total,
        efectivo: breakdownA.efectivo + breakdownB.efectivo,
        tarjeta: breakdownA.tarjeta + breakdownB.tarjeta,
        transferencia: breakdownA.transferencia + breakdownB.transferencia,
        otros: breakdownA.otros + breakdownB.otros,
    };

    const exportToExcel = () => {
        if (consultasFiltradas.length === 0 && productosFiltrados.length === 0) return alert(t('noDatosExportar') || 'No hay datos para exportar.');

        let csvString = "\uFEFF"; 

        csvString += `--- ${(t('empresaA') || 'Empresa A').toUpperCase()} ---\n`;
        csvString += `${t('folio') || 'Folio'},${t('fechaHora') || 'Fecha'},${t('sucursalEmisora') || 'Sucursal'},${t('clientes') || 'Cliente'},${t('articulo') || 'Artículo'},${t('cantidadAbrev') || 'Cant'},${t('importe') || 'Importe'},${t('metPago') || 'Pago'}\n`;
        consultasFiltradas.forEach(c => {
            csvString += `"#${c.folio.toString().padStart(5, '0')}","${c.fecha}","${c.sucursal}","${c.cliente}","${c.articulo}",${c.cantidad},${c.importe.toFixed(2)},"${c.metodo_pago.toUpperCase()}"\n`;
        });
        csvString += `,,,,,,${t('totalConsultas') || 'Total Consultas'},${breakdownA.total.toFixed(2)}\n`;
        csvString += `,,,,,,${t('excelEfectivo') || 'Efectivo'},${breakdownA.efectivo.toFixed(2)}\n`;
        csvString += `,,,,,,${t('excelTarjetas') || 'Tarjetas'},${breakdownA.tarjeta.toFixed(2)}\n`;
        csvString += `,,,,,,${t('excelTransferencias') || 'Transferencias'},${breakdownA.transferencia.toFixed(2)}\n\n\n`;

        csvString += `--- ${(t('empresaB') || 'Empresa B').toUpperCase()} ---\n`;
        csvString += `${t('folio') || 'Folio'},${t('fechaHora') || 'Fecha'},${t('sucursalEmisora') || 'Sucursal'},${t('clientes') || 'Cliente'},${t('articulo') || 'Artículo'},${t('cantidadAbrev') || 'Cant'},${t('importe') || 'Importe'},${t('metPago') || 'Pago'}\n`;
        productosFiltrados.forEach(p => {
            csvString += `"#${p.folio.toString().padStart(5, '0')}","${p.fecha}","${p.sucursal}","${p.cliente}","${p.articulo}",${p.cantidad},${p.importe.toFixed(2)},"${p.metodo_pago.toUpperCase()}"\n`;
        });
        csvString += `,,,,,,${t('totalProductos') || 'Total Productos'},${breakdownB.total.toFixed(2)}\n`;
        csvString += `,,,,,,${t('excelEfectivo') || 'Efectivo'},${breakdownB.efectivo.toFixed(2)}\n`;
        csvString += `,,,,,,${t('excelTarjetas') || 'Tarjetas'},${breakdownB.tarjeta.toFixed(2)}\n`;
        csvString += `,,,,,,${t('excelTransferencias') || 'Transferencias'},${breakdownB.transferencia.toFixed(2)}\n\n\n`;

        csvString += `--- ${t('resumenGlobal') || 'Resumen Global'} ---\n`;
        csvString += `${t('granTotalLabel') || 'Gran Total'},${breakdownTotal.total.toFixed(2)}\n`;
        csvString += `${t('totalEfectivo') || 'Total Efectivo'},${breakdownTotal.efectivo.toFixed(2)}\n`;
        csvString += `${t('totalTarjetas') || 'Total Tarjetas'},${breakdownTotal.tarjeta.toFixed(2)}\n`;
        csvString += `${t('totalTransferencias') || 'Total Transferencias'},${breakdownTotal.transferencia.toFixed(2)}\n`;

        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `Reporte_Financiero_${dateMode === 'diario' ? singleDate : startDate}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const triggerPDFPrint = () => { window.print(); };

    const getUniqueValues = (list, column) => {
        const vals = list.map(item => {
            if (column === 'folio') return `#${item.folio.toString().padStart(5, '0')}`;
            if (column === 'importe') return `$${item.importe.toFixed(2)}`;
            if (column === 'metodo_pago') return item.metodo_pago.toUpperCase();
            return String(item[column] || '');
        });
        return [...new Set(vals)].sort();
    };

    const renderColumnHeader = (title, column, list, filters, setFilters, activeDropdown, setActiveDropdown, isVisible = true) => {
        if (!isVisible) return null;
        
        const isActive = activeDropdown === column;
        const hasFilter = filters[column] && filters[column] !== '';
        const uniqueValues = getUniqueValues(list, column);
        const currentValue = filters[column];

        return (
            <th style={{ position: 'relative', padding: '15px', userSelect: 'none', transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setActiveDropdown(isActive ? null : column)}>
                    <span style={{ color: hasFilter ? 'var(--accent)' : 'var(--text-muted)', fontWeight: hasFilter ? 'bold' : '600' }}>{title}</span>
                    <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7rem', color: hasFilter ? 'var(--accent)' : 'var(--text-muted)', transition: 'transform 0.3s ease', transform: isActive ? 'rotate(180deg)' : 'rotate(0)' }}></i>
                </div>
                
                {isActive && (
                    <>
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} onClick={() => setActiveDropdown(null)}></div>
                        
                        <div className="filter-popover" style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', zIndex: 11, width: '220px', boxShadow: 'var(--shadow-lg)', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                            <input 
                                type="text" placeholder={t('buscarArticulo') || "🔍 Buscar..."} value={currentValue}
                                onChange={(e) => setFilters(prev => ({...prev, [column]: e.target.value}))}
                                style={{ width: '100%', padding: '10px', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '10px', fontSize: '0.85rem', outline: 'none' }}
                                autoFocus
                            />
                            
                            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '5px' }}>
                                {uniqueValues.filter(v => v.toLowerCase().includes(currentValue.toLowerCase())).map((val, idx) => (
                                    <div key={idx} 
                                         style={{ fontSize: '0.85rem', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)', transition: 'all 0.2s' }}
                                         onClick={() => { setFilters(prev => ({...prev, [column]: val})); setActiveDropdown(null); }}
                                         onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-dark)'; }}
                                         onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        {val}
                                    </div>
                                ))}
                            </div>
                            
                            {hasFilter && (
                                <button 
                                    onClick={() => { setFilters(prev => ({...prev, [column]: ''})); setActiveDropdown(null); }} 
                                    style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'rgba(211, 47, 47, 0.1)', border: '1px solid var(--primary-red)', color: 'var(--primary-red)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-red)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(211, 47, 47, 0.1)'}
                                >
                                    {t('borrarFiltro') || 'Borrar Filtro'}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </th>
        );
    };

    if (!isMounted) return null;

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '25px', overflowY: 'auto', paddingRight: '5px'}}>
            
            {/* PANEL DE CONTROL SUPERIOR */}
            <div className="panel" style={{display: 'flex', flexDirection: 'column', gap: '20px', padding: '25px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '20px'}}>
                    <div style={{display: 'flex', gap: '10px'}}>
                        <button className={`btn-action ${dateMode === 'diario' ? 'btn-primary' : ''}`} onClick={() => setDateMode('diario')} style={{padding: '10px 20px', borderRadius: '30px'}}><i className="fa-solid fa-calendar-day"></i> {t('reporteDiario') || 'Reporte Diario'}</button>
                        <button className={`btn-action ${dateMode === 'periodo' ? 'btn-primary' : ''}`} onClick={() => setDateMode('periodo')} style={{padding: '10px 20px', borderRadius: '30px'}}><i className="fa-solid fa-calendar-week"></i> {t('reportePeriodo') || 'Por Período'}</button>
                    </div>

                    <div style={{display: 'flex', gap: '10px'}}>
                        <button className={`btn-action ${viewMode === 'sucursal' ? 'btn-primary' : ''}`} onClick={() => setViewMode('sucursal')} style={{padding: '10px 20px', borderRadius: '30px'}}><i className="fa-solid fa-store"></i> {t('vistaSucursal') || 'Vista Sucursal'} ({branch.toUpperCase()})</button>
                        {perfilActual?.rol === 'admin' && (
                            <button className={`btn-action ${viewMode === 'global' ? 'btn-primary' : ''}`} onClick={() => setViewMode('global')} style={{padding: '10px 20px', borderRadius: '30px'}}><i className="fa-solid fa-globe"></i> {t('vistaGlobal') || 'Vista Global'}</button>
                        )}
                    </div>
                </div>

                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{display: 'flex', gap: '20px'}}>
                        {dateMode === 'diario' ? (
                            <div>
                                <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold'}}>{t('fecha') || 'Fecha'}</label>
                                <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} style={{padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none'}} />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold'}}>{t('fechaInicio') || 'Fecha Inicio'}</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none'}} />
                                </div>
                                <div>
                                    <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold'}}>{t('fechaFin') || 'Fecha Fin'}</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none'}} />
                                </div>
                            </>
                        )}
                    </div>
                    
                    <div style={{display: 'flex', gap: '15px'}}>
                        <button className="btn-action" onClick={exportToExcel} style={{background: 'rgba(46, 125, 50, 0.1)', color: 'var(--success)', border: '1px solid var(--success)', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold'}}><i className="fa-solid fa-file-excel"></i> {t('excelCsv') || 'Exportar CSV'}</button>
                        <button className="btn-action" onClick={triggerPDFPrint} style={{background: 'rgba(211, 47, 47, 0.1)', color: 'var(--primary-red)', border: '1px solid var(--primary-red)', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold'}}><i className="fa-solid fa-file-pdf"></i> {t('imprimirPdf') || 'Imprimir PDF'}</button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{textAlign: 'center', padding: '60px', color: 'var(--accent)'}}>
                    <i className="fa-solid fa-circle-notch fa-spin fa-3x"></i>
                    <p style={{marginTop:'15px', color: 'var(--text-muted)', fontWeight: 'bold'}}>{t('procesandoNube') || 'Calculando reportes...'}</p>
                </div>
            ) : (
                <>
                    {/* 🚀 TARJETAS FINANCIERAS PREMIUM */}
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px'}}>
                        
                        {/* EMPRESA A (SOLO CONSULTAS CLÍNICAS OFICIALES) */}
                        <div className="dash-card-premium" style={{ '--card-color': '#00b0ff' }}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                                <div style={{width: '100%'}}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px'}}>
                                        <div style={{background: 'rgba(0, 176, 255, 0.1)', padding: '12px', borderRadius: '12px'}}><i className="fa-solid fa-user-doctor" style={{fontSize: '1.5rem', color: '#00b0ff'}}></i></div>
                                        <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px'}}>{t('ingresosA') || 'Ingresos Clínica'}</span>
                                    </div>
                                    <span style={{fontSize: '2.4rem', fontWeight: '900', display:'block', color: 'var(--text-main)'}}>${breakdownA.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                            <div className="breakdown-section">
                                <div><span>{t('efectivoLabel') || 'Efectivo'}</span> <strong>${breakdownA.efectivo.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span>{t('tarjetaLabel') || 'Tarjetas'}</span> <strong>${breakdownA.tarjeta.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span>{t('transferenciaLabel') || 'Transferencias'}</span> <strong>${breakdownA.transferencia.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                            </div>
                        </div>

                        {/* EMPRESA B (PRODUCTOS Y SERVICIOS EXTRA) */}
                        <div className="dash-card-premium" style={{ '--card-color': '#ffb300' }}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                                <div style={{width: '100%'}}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px'}}>
                                        <div style={{background: 'rgba(255, 179, 0, 0.1)', padding: '12px', borderRadius: '12px'}}><i className="fa-solid fa-box-open" style={{fontSize: '1.5rem', color: '#ffb300'}}></i></div>
                                        <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px'}}>{t('ingresosB') || 'Ingresos Extra'}</span>
                                    </div>
                                    <span style={{fontSize: '2.4rem', fontWeight: '900', display:'block', color: 'var(--text-main)'}}>${breakdownB.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                            <div className="breakdown-section">
                                <div><span>{t('efectivoLabel') || 'Efectivo'}</span> <strong>${breakdownB.efectivo.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span>{t('tarjetaLabel') || 'Tarjetas'}</span> <strong>${breakdownB.tarjeta.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span>{t('transferenciaLabel') || 'Transferencias'}</span> <strong>${breakdownB.transferencia.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                            </div>
                        </div>

                        {/* GRAN TOTAL */}
                        <div className="dash-card-premium" style={{ '--card-color': 'var(--success)' }}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                                <div style={{width: '100%'}}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px'}}>
                                        <div style={{background: 'rgba(46, 125, 50, 0.1)', padding: '12px', borderRadius: '12px'}}><i className="fa-solid fa-sack-dollar" style={{fontSize: '1.5rem', color: 'var(--success)'}}></i></div>
                                        <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px'}}>{t('granTotal') || 'Gran Total'}</span>
                                    </div>
                                    <span style={{fontSize: '2.4rem', fontWeight: '900', display:'block', color: 'var(--success)'}}>${breakdownTotal.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                            <div className="breakdown-section">
                                <div><span>{t('efectivoTotal') || 'Total Efectivo'}</span> <strong style={{color: 'var(--text-main)'}}>${breakdownTotal.efectivo.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span>{t('tarjetaTotal') || 'Total Tarjetas'}</span> <strong style={{color: 'var(--text-main)'}}>${breakdownTotal.tarjeta.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span>{t('transfTotal') || 'Total Transf.'}</span> <strong style={{color: 'var(--text-main)'}}>${breakdownTotal.transferencia.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                            </div>
                        </div>

                    </div>

                    {/* TABLAS ESTILIZADAS */}
                    <div className="panel" style={{padding: '0', overflow: 'hidden'}}>
                        <div style={{padding: '20px 25px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0, 176, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <div style={{background: '#00b0ff', padding: '8px', borderRadius: '8px', color: 'white'}}><i className="fa-solid fa-notes-medical"></i></div>
                            <h2 style={{color: '#00b0ff', margin: 0, fontSize: '1.2rem'}}>{t('empresaA') || 'Empresa A'}</h2>
                        </div>
                        <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                            <table className="data-table">
                                <thead style={{position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-panel)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)'}}>
                                    <tr>
                                        {renderColumnHeader(t('folio') || 'Folio', 'folio', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('fechaHora') || 'Fecha', 'fecha', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('sucursalEmisora') || 'Sucursal', 'sucursal', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA, viewMode === 'global')}
                                        {renderColumnHeader(t('clientes') || 'Cliente', 'cliente', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('articulo') || 'Artículo', 'articulo', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('cantidadAbrev') || 'Cant', 'cantidad', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('metPago') || 'Pago', 'metodo_pago', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('importe') || 'Importe', 'importe', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {consultasFiltradas.map((item, idx) => (
                                        <tr key={`c-${idx}`}>
                                            <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{item.folio.toString().padStart(5, '0')}</td>
                                            <td style={{fontSize: '0.85rem', color: 'var(--text-main)'}}>{item.fecha}</td>
                                            {viewMode === 'global' && <td style={{color: 'var(--text-main)'}}>{item.sucursal}</td>}
                                            <td><strong style={{color: 'var(--text-main)'}}>{item.cliente}</strong></td>
                                            <td style={{color: '#00b0ff'}}>{item.articulo}</td>
                                            <td style={{color: 'var(--text-main)', fontWeight: 'bold'}}>{item.cantidad}</td>
                                            <td><span style={{fontSize: '0.75rem', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '5px 10px', borderRadius: '20px', fontWeight: '600'}}>{item.metodo_pago.toUpperCase()}</span></td>
                                            <td style={{fontWeight: 'bold', color: 'var(--text-main)'}}>${item.importe.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {consultasFiltradas.length === 0 && <tr><td colSpan={viewMode === 'global' ? 8 : 7} style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-folder-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('sinDatos') || 'No se encontraron datos.'}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="panel" style={{padding: '0', overflow: 'hidden'}}>
                        <div style={{padding: '20px 25px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 179, 0, 0.05)', display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <div style={{background: '#ffb300', padding: '8px', borderRadius: '8px', color: 'white'}}><i className="fa-solid fa-box-open"></i></div>
                            <h2 style={{color: '#ffb300', margin: 0, fontSize: '1.2rem'}}>{t('empresaB') || 'Empresa B'}</h2>
                        </div>
                        <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                            <table className="data-table">
                                <thead style={{position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-panel)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)'}}>
                                    <tr>
                                        {renderColumnHeader(t('folio') || 'Folio', 'folio', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('fechaHora') || 'Fecha', 'fecha', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('sucursalEmisora') || 'Sucursal', 'sucursal', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB, viewMode === 'global')}
                                        {renderColumnHeader(t('clientes') || 'Cliente', 'cliente', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('articulo') || 'Artículo', 'articulo', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('cantidadAbrev') || 'Cant', 'cantidad', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('metPago') || 'Pago', 'metodo_pago', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('importe') || 'Importe', 'importe', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {productosFiltrados.map((item, idx) => (
                                        <tr key={`p-${idx}`}>
                                            <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{item.folio.toString().padStart(5, '0')}</td>
                                            <td style={{fontSize: '0.85rem', color: 'var(--text-main)'}}>{item.fecha}</td>
                                            {viewMode === 'global' && <td style={{color: 'var(--text-main)'}}>{item.sucursal}</td>}
                                            <td><strong style={{color: 'var(--text-main)'}}>{item.cliente}</strong></td>
                                            <td style={{color: '#ffb300'}}>{item.articulo}</td>
                                            <td style={{color: 'var(--text-main)', fontWeight: 'bold'}}>{item.cantidad}</td>
                                            <td><span style={{fontSize: '0.75rem', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '5px 10px', borderRadius: '20px', fontWeight: '600'}}>{item.metodo_pago.toUpperCase()}</span></td>
                                            <td style={{fontWeight: 'bold', color: 'var(--text-main)'}}>${item.importe.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {productosFiltrados.length === 0 && <tr><td colSpan={viewMode === 'global' ? 8 : 7} style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-folder-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('sinDatos') || 'No se encontraron datos.'}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </>
            )}

            {/* ESTILOS INTERNOS PREMIUM */}
            <style jsx>{`
                .dash-card-premium {
                    background: var(--bg-panel);
                    padding: 25px;
                    border-radius: 16px;
                    border: 1px solid var(--border-color);
                    border-left: 6px solid var(--card-color);
                    display: flex;
                    flex-direction: column;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: var(--shadow-sm);
                    position: relative;
                    overflow: hidden;
                }
                .dash-card-premium::before {
                    content: ''; position: absolute; top: 0; right: 0; width: 150px; height: 150px;
                    background: radial-gradient(circle, var(--card-color) 0%, transparent 70%);
                    opacity: 0.05; transition: opacity 0.4s ease; border-radius: 50%;
                    transform: translate(30%, -30%); pointer-events: none;
                }
                .dash-card-premium:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 30px -5px rgba(0,0,0,0.1), 0 0 20px 0 var(--card-color) inset;
                    border-color: var(--card-color);
                }
                .dash-card-premium:hover::before { opacity: 0.15; }

                .breakdown-section {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px dashed var(--border-color);
                    font-size: 0.85rem;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .breakdown-section div {
                    display: flex;
                    justify-content: space-between;
                    color: var(--text-muted);
                }
                
                .filter-popover {
                    animation: popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes popoverFadeIn {
                    from { opacity: 0; transform: translateY(-10px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}