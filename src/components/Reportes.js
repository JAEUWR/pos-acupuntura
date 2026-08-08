'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Reportes({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    
    // Controles de Vista y Fechas
    const [dateMode, setDateMode] = useState('diario'); 
    const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    
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

    const calculateDashboardData = async () => {
        setLoading(true);
        
        let query = supabase.from('ventas').select(`
            id, total, fecha, metodo_pago, sucursal_id,
            sucursales ( nombre ), clientes ( nombre ),
            venta_detalles (
                cantidad, precio_unitario, tipo_precio,
                productos ( id, nombre, tipo, codigo_barras )
            )
        `).order('fecha', { ascending: false });

        // Filtro de Fechas DB
        if (dateMode === 'diario') {
            query = query.gte('fecha', `${singleDate}T00:00:00`).lte('fecha', `${singleDate}T23:59:59`);
        } else {
            query = query.gte('fecha', `${startDate}T00:00:00`).lte('fecha', `${endDate}T23:59:59`);
        }

        // Filtro de Sucursal DB
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
            const clienteNombre = v.clientes?.nombre || t('publicoGeneral');
            const sucursalNombre = v.sucursales?.nombre || 'General';
            const pago = v.metodo_pago || t('efectivo');

            v.venta_detalles?.forEach(det => {
                const cant = parseInt(det.cantidad);
                const precio = parseFloat(det.precio_unitario);
                const importeDetalle = cant * precio;
                const nombreItem = det.productos?.nombre || t('articuloEliminado');
                const barcode = det.productos?.codigo_barras;

                const registro = {
                    folio: v.id,
                    fecha: new Date(v.fecha).toLocaleString(),
                    sucursal: sucursalNombre,
                    cliente: clienteNombre,
                    articulo: nombreItem,
                    cantidad: cant,
                    precio: precio,
                    importe: importeDetalle,
                    metodo_pago: pago
                };

                // Clasificación estricta (Empresa A vs Empresa B)
                if (barcode === '7502314482150' || det.productos?.tipo === 'servicio' || nombreItem.toLowerCase().includes('consulta')) {
                    totalA += importeDetalle;
                    arrConsultas.push(registro);
                } else {
                    totalB += importeDetalle;
                    arrProductos.push(registro);
                }
            });
        });

        setKpis({ consultas: totalA, productos: totalB, total: totalA + totalB });
        setListaConsultas(arrConsultas);
        setListaProductos(arrProductos);
        setLoading(false);
    };

    useEffect(() => { calculateDashboardData(); }, [dateMode, singleDate, startDate, endDate, viewMode, branch]);

    // MOTOR DE FILTRADO EXCEL
    const applyFilters = (list, filters) => {
        return list.filter(item => {
            return Object.keys(filters).every(key => {
                if (!filters[key]) return true;
                const filterValue = String(filters[key]).toLowerCase();
                let itemValue = String(item[key] || '').toLowerCase();
                
                // Formato especial para que el string coincida al buscar
                if (key === 'folio') itemValue = `#${item.folio.toString().padStart(5, '0')}`.toLowerCase();
                if (key === 'importe') itemValue = `$${item.importe.toFixed(2)}`.toLowerCase();
                
                return itemValue.includes(filterValue);
            });
        });
    };

    const consultasFiltradas = applyFilters(listaConsultas, filtersA);
    const productosFiltrados = applyFilters(listaProductos, filtersB);

    // TOTALES DINÁMICOS
    const totalFiltradoA = consultasFiltradas.reduce((acc, el) => acc + el.importe, 0);
    const totalFiltradoB = productosFiltrados.reduce((acc, el) => acc + el.importe, 0);
    const granTotalFiltrado = totalFiltradoA + totalFiltradoB;

    // EXPORTACIÓN A EXCEL
    const exportToExcel = () => {
        if (consultasFiltradas.length === 0 && productosFiltrados.length === 0) return alert(t('noDatosExportar'));

        let csvString = "\uFEFF"; 

        csvString += `--- ${t('empresaA').toUpperCase()} ---\n`;
        csvString += `${t('folio')},${t('fechaHora')},${t('sucursalEmisora')},${t('clientes')},${t('articulo')},${t('cantidadAbrev')},${t('importe')},${t('metPago')}\n`;
        consultasFiltradas.forEach(c => {
            csvString += `"#${c.folio.toString().padStart(5, '0')}","${c.fecha}","${c.sucursal}","${c.cliente}","${c.articulo}",${c.cantidad},${c.importe.toFixed(2)},"${c.metodo_pago.toUpperCase()}"\n`;
        });
        csvString += `,,,,,,Total Consultas:,${totalFiltradoA.toFixed(2)}\n\n\n`;

        csvString += `--- ${t('empresaB').toUpperCase()} ---\n`;
        csvString += `${t('folio')},${t('fechaHora')},${t('sucursalEmisora')},${t('clientes')},${t('articulo')},${t('cantidadAbrev')},${t('importe')},${t('metPago')}\n`;
        productosFiltrados.forEach(p => {
            csvString += `"#${p.folio.toString().padStart(5, '0')}","${p.fecha}","${p.sucursal}","${p.cliente}","${p.articulo}",${p.cantidad},${p.importe.toFixed(2)},"${p.metodo_pago.toUpperCase()}"\n`;
        });
        csvString += `,,,,,,Total Productos:,${totalFiltradoB.toFixed(2)}\n`;

        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `Reporte_Financiero_${dateMode === 'diario' ? singleDate : startDate}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const triggerPDFPrint = () => { window.print(); };

    // COMPONENTE HEADER CON FILTRO EXCEL
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
            <th style={{ position: 'relative', padding: '10px', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setActiveDropdown(isActive ? null : column)}>
                    <span>{title}</span>
                    <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7rem', color: hasFilter ? 'var(--primary-red)' : 'var(--text-muted)', transition: 'transform 0.2s', transform: isActive ? 'rotate(180deg)' : 'rotate(0)' }}></i>
                </div>
                
                {isActive && (
                    <>
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} onClick={() => setActiveDropdown(null)}></div>
                        
                        <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', zIndex: 11, width: '220px', boxShadow: '0 8px 16px rgba(0,0,0,0.5)', marginTop: '5px' }} onClick={e => e.stopPropagation()}>
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar..." 
                                value={currentValue}
                                onChange={(e) => setFilters(prev => ({...prev, [column]: e.target.value}))}
                                style={{ width: '100%', padding: '8px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', marginBottom: '10px', fontSize: '0.85rem' }}
                                autoFocus
                            />
                            
                            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '5px' }}>
                                {uniqueValues.filter(v => v.toLowerCase().includes(currentValue.toLowerCase())).map((val, idx) => (
                                    <div key={idx} 
                                         style={{ fontSize: '0.8rem', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 'normal', textTransform: 'none' }}
                                         onClick={() => { setFilters(prev => ({...prev, [column]: val})); setActiveDropdown(null); }}
                                         onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'var(--bg-lighter)'; }}
                                         onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        {val}
                                    </div>
                                ))}
                            </div>
                            
                            {hasFilter && (
                                <button 
                                    onClick={() => { setFilters(prev => ({...prev, [column]: ''})); setActiveDropdown(null); }} 
                                    style={{ width: '100%', marginTop: '10px', padding: '8px', background: 'rgba(198, 40, 40, 0.1)', border: '1px solid var(--primary-red)', color: 'var(--primary-red)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                >
                                    Borrar Filtro
                                </button>
                            )}
                        </div>
                    </>
                )}
            </th>
        );
    };

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '5px'}}>
            
            {/* PANEL DE CONTROL SUPERIOR */}
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px', background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '15px'}}>
                    <div style={{display: 'flex', gap: '10px'}}>
                        <button className={`btn-action ${dateMode === 'diario' ? 'btn-primary' : ''}`} onClick={() => setDateMode('diario')}><i className="fa-solid fa-calendar-day"></i> {t('reporteDiario')}</button>
                        <button className={`btn-action ${dateMode === 'periodo' ? 'btn-primary' : ''}`} onClick={() => setDateMode('periodo')}><i className="fa-solid fa-calendar-week"></i> {t('reportePeriodo')}</button>
                    </div>

                    <div style={{display: 'flex', gap: '10px'}}>
                        <button className={`btn-action ${viewMode === 'sucursal' ? 'btn-primary' : ''}`} onClick={() => setViewMode('sucursal')}><i className="fa-solid fa-store"></i> {t('vistaSucursal')} ({branch.toUpperCase()})</button>
                        {perfilActual?.rol === 'admin' && (
                            <button className={`btn-action ${viewMode === 'global' ? 'btn-primary' : ''}`} onClick={() => setViewMode('global')}><i className="fa-solid fa-globe"></i> {t('vistaGlobal')}</button>
                        )}
                    </div>
                </div>

                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{display: 'flex', gap: '15px'}}>
                        {dateMode === 'diario' ? (
                            <div>
                                <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px'}}>{t('fecha')}</label>
                                <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} style={{padding: '10px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px'}}>{t('fechaInicio')}</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{padding: '10px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                                </div>
                                <div>
                                    <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px'}}>{t('fechaFin')}</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{padding: '10px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                                </div>
                            </>
                        )}
                    </div>
                    
                    <div style={{display: 'flex', gap: '10px'}}>
                        <button className="btn-action" onClick={exportToExcel} style={{background: '#1e3d26', border: '1px solid #2e7d32'}}><i className="fa-solid fa-file-excel" style={{color: 'var(--success)', marginRight: '8px'}}></i> {t('excelCsv')}</button>
                        <button className="btn-action" onClick={triggerPDFPrint} style={{background: '#3d1e1e', border: '1px solid var(--primary-red)'}}><i className="fa-solid fa-file-pdf" style={{color: 'var(--accent)', marginRight: '8px'}}></i> {t('imprimirPdf')}</button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-spinner fa-spin fa-2x"></i><p style={{marginTop:'10px'}}>{t('procesandoNube')}</p></div>
            ) : (
                <>
                    {/* TARJETAS FINANCIERAS (DINÁMICAS CON EL FILTRO) */}
                    <div className="dashboard-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px'}}>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid #00b0ff', borderLeft: '5px solid #00b0ff'}}>
                            <i className="fa-solid fa-user-doctor" style={{fontSize: '1.8rem', color: '#00b0ff'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>{t('ingresosA')}</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>${totalFiltradoA.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid #ffb300', borderLeft: '5px solid #ffb300'}}>
                            <i className="fa-solid fa-box-open" style={{fontSize: '1.8rem', color: '#ffb300'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>{t('ingresosB')}</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>${totalFiltradoB.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--success)', borderLeft: '5px solid var(--success)'}}>
                            <i className="fa-solid fa-sack-dollar" style={{fontSize: '1.8rem', color: 'var(--success)'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>{t('granTotal')}</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>${granTotalFiltrado.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    {/* TABLA 1: CONSULTAS Y SERVICIOS */}
                    <div className="panel" style={{background: 'var(--bg-panel)', padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden'}}>
                        <div style={{padding: '20px', borderBottom: '1px solid var(--border-color)', background: '#00b0ff11'}}>
                            <h2 style={{color: '#00b0ff', margin: 0}}><i className="fa-solid fa-notes-medical"></i> {t('empresaA')}</h2>
                        </div>
                        <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                            <table className="data-table">
                                <thead style={{position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-panel)'}}>
                                    <tr>
                                        {renderColumnHeader(t('folio'), 'folio', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('fechaHora'), 'fecha', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('sucursal'), 'sucursal', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA, viewMode === 'global')}
                                        {renderColumnHeader(t('clientes'), 'cliente', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('articulo'), 'articulo', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('cantidadAbrev'), 'cantidad', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('metPago'), 'metodo_pago', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                        {renderColumnHeader(t('importe'), 'importe', listaConsultas, filtersA, setFiltersA, activeDropdownA, setActiveDropdownA)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {consultasFiltradas.map((item, idx) => (
                                        <tr key={`c-${idx}`}>
                                            <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{item.folio.toString().padStart(5, '0')}</td>
                                            <td style={{fontSize: '0.85rem'}}>{item.fecha}</td>
                                            {viewMode === 'global' && <td>{item.sucursal}</td>}
                                            <td><strong>{item.cliente}</strong></td>
                                            <td style={{color: '#00b0ff'}}>{item.articulo}</td>
                                            <td>{item.cantidad}</td>
                                            <td><span style={{fontSize: '0.75rem', background: '#333', padding: '3px 6px', borderRadius: '4px'}}>{item.metodo_pago.toUpperCase()}</span></td>
                                            <td style={{fontWeight: 'bold'}}>${item.importe.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {consultasFiltradas.length === 0 && <tr><td colSpan={viewMode === 'global' ? 8 : 7} style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>{t('sinDatos')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* TABLA 2: PRODUCTOS ADICIONALES */}
                    <div className="panel" style={{background: 'var(--bg-panel)', padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden'}}>
                        <div style={{padding: '20px', borderBottom: '1px solid var(--border-color)', background: '#ffb30011'}}>
                            <h2 style={{color: '#ffb300', margin: 0}}><i className="fa-solid fa-box-open"></i> {t('empresaB')}</h2>
                        </div>
                        <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                            <table className="data-table">
                                <thead style={{position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-panel)'}}>
                                    <tr>
                                        {renderColumnHeader(t('folio'), 'folio', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('fechaHora'), 'fecha', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('sucursal'), 'sucursal', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB, viewMode === 'global')}
                                        {renderColumnHeader(t('clientes'), 'cliente', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('articulo'), 'articulo', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('cantidadAbrev'), 'cantidad', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('metPago'), 'metodo_pago', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                        {renderColumnHeader(t('importe'), 'importe', listaProductos, filtersB, setFiltersB, activeDropdownB, setActiveDropdownB)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {productosFiltrados.map((item, idx) => (
                                        <tr key={`p-${idx}`}>
                                            <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{item.folio.toString().padStart(5, '0')}</td>
                                            <td style={{fontSize: '0.85rem'}}>{item.fecha}</td>
                                            {viewMode === 'global' && <td>{item.sucursal}</td>}
                                            <td><strong>{item.cliente}</strong></td>
                                            <td style={{color: '#ffb300'}}>{item.articulo}</td>
                                            <td>{item.cantidad}</td>
                                            <td><span style={{fontSize: '0.75rem', background: '#333', padding: '3px 6px', borderRadius: '4px'}}>{item.metodo_pago.toUpperCase()}</span></td>
                                            <td style={{fontWeight: 'bold'}}>${item.importe.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {productosFiltrados.length === 0 && <tr><td colSpan={viewMode === 'global' ? 8 : 7} style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>{t('sinDatos')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </>
            )}
        </div>
    );
}