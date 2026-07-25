'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Reportes() {
    const { t } = useLanguage();

    const [loading, setLoading] = useState(true);
    
    const [startDate, setStartDate] = useState('2026-07-01');
    const [endDate, setEndDate] = useState('2026-07-31');

    const [kpis, setKpis] = useState({ ingresos: 0, consultas: 0, productos: 0, ticketPromedio: 0 });

    // Estructura avanzada para el desglose por sucursal
    const [branchData, setBranchData] = useState({
        napoles: { total: 0, consultas: 0, productos: 0 },
        obrera: { total: 0, consultas: 0, productos: 0 },
        pedregal: { total: 0, consultas: 0, productos: 0 }
    });
    
    const [recentVentas, setRecentVentas] = useState([]);
    const [topProducts, setTopProducts] = useState([]);

    const calculateDashboardData = async () => {
        setLoading(true);
        
        // Incluimos codigo_barras en la consulta para rastrear la consulta exacta
        const { data: ventas, error } = await supabase
            .from('ventas')
            .select(`
                id, total, fecha, sucursal_id,
                sucursales ( nombre ),
                venta_detalles (
                    cantidad, precio_unitario, tipo_precio,
                    productos ( id, nombre, tipo, codigo_barras )
                )
            `)
            .gte('fecha', `${startDate}T00:00:00`)
            .lte('fecha', `${endDate}T23:59:59`)
            .order('fecha', { ascending: false });

        if (error) {
            console.error("Error al extraer reportes:", error.message);
            setLoading(false);
            return;
        }

        let totalIngresos = 0;
        let totalConsultas = 0;
        let totalProductos = 0;
        let sedes = { 
            napoles: { total: 0, consultas: 0, productos: 0 }, 
            obrera: { total: 0, consultas: 0, productos: 0 }, 
            pedregal: { total: 0, consultas: 0, productos: 0 } 
        };
        let productMap = {};

        ventas.forEach(v => {
            const monto = parseFloat(v.total);
            totalIngresos += monto;

            let sucursalKey = v.sucursal_id === 1 ? 'napoles' : (v.sucursal_id === 2 ? 'obrera' : 'pedregal');
            sedes[sucursalKey].total += monto;

            v.venta_detalles?.forEach(det => {
                const cant = parseInt(det.cantidad);
                const precio = parseFloat(det.precio_unitario);
                const importeDetalle = cant * precio;
                
                const nombreItem = det.productos?.nombre || t('articuloEliminado');
                const barcode = det.productos?.codigo_barras;

                // Clasificación estricta: Consulta (por código de barras o tipo) vs Producto Físico
                if (barcode === '7502314482150' || det.productos?.tipo === 'consulta' || nombreItem.toLowerCase().includes('consulta')) {
                    totalConsultas += cant;
                    sedes[sucursalKey].consultas += importeDetalle;
                } else {
                    totalProductos += cant;
                    sedes[sucursalKey].productos += importeDetalle;
                }

                if (!productMap[nombreItem]) {
                    productMap[nombreItem] = { nombre: nombreItem, unidades: 0, ingresos: 0 };
                }
                productMap[nombreItem].unidades += cant;
                productMap[nombreItem].ingresos += importeDetalle;
            });
        });

        const topSorted = Object.values(productMap)
            .sort((a, b) => b.unidades - a.unidades)
            .slice(0, 5);

        setKpis({
            ingresos: totalIngresos,
            consultas: totalConsultas,
            productos: totalProductos,
            ticketPromedio: ventas.length > 0 ? totalIngresos / ventas.length : 0
        });
        setBranchData(sedes);
        setRecentVentas(ventas);
        setTopProducts(topSorted);
        setLoading(false);
    };

    useEffect(() => {
        calculateDashboardData();
    }, [startDate, endDate]);

    const exportToExcel = () => {
        if (recentVentas.length === 0) return alert(t('noDatosExportar'));

        const headers = [t('folio'), t('fechaHora'), t('sucursalEmisora'), t('montoCobrado') + "\n"];
        const rows = recentVentas.map(v => [
            `#${v.id.toString().padStart(5, '0')}`,
            new Date(v.fecha).toLocaleString(),
            v.sucursales?.nombre || t('general'),
            `$${parseFloat(v.total).toFixed(2)}`
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${t('cierreCaja')}_${startDate}_al_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const triggerPDFPrint = () => { window.print(); };

    // Gráfica basada en los totales
    const maxSale = Math.max(branchData.napoles.total, branchData.obrera.total, branchData.pedregal.total, 1);
    const getPercent = (value) => ((value / maxSale) * 100).toFixed(0);
    const getProporcion = (parte, total) => total > 0 ? ((parte / total) * 100).toFixed(1) : 0;

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '5px'}}>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)', padding: '15px 25px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                    <div>
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px'}}>{t('fechaInicio')}</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{padding: '8px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                    </div>
                    <div>
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px'}}>{t('fechaFin')}</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{padding: '8px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                    </div>
                </div>
                
                <div style={{display: 'flex', gap: '10px'}}>
                    <button className="btn-action" onClick={exportToExcel} style={{background: '#1e3d26', border: '1px solid #2e7d32'}}><i className="fa-solid fa-file-excel" style={{color: 'var(--success)', marginRight: '8px'}}></i> {t('excelCsv')}</button>
                    <button className="btn-action" onClick={triggerPDFPrint} style={{background: '#3d1e1e', border: '1px solid var(--primary-red)'}}><i className="fa-solid fa-file-pdf" style={{color: 'var(--accent)', marginRight: '8px'}}></i> {t('imprimirPdf')}</button>
                </div>
            </div>

            {loading ? (
                <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-spinner fa-spin fa-2x"></i><p style={{marginTop:'10px'}}>{t('procesandoNube')}</p></div>
            ) : (
                <>
                    <div className="dashboard-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px'}}>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <i className="fa-solid fa-money-bill-wave" style={{fontSize: '1.8rem', color: 'var(--success)'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>{t('ingresosTotales')}</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>${kpis.ingresos.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <i className="fa-solid fa-user-md" style={{fontSize: '1.8rem', color: 'var(--accent)'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>{t('consultasTotales')}</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>{kpis.consultas}</span>
                        </div>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <i className="fa-solid fa-box" style={{fontSize: '1.8rem', color: '#ffb300'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>{t('insumosDesplazados')}</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>{kpis.productos}</span>
                        </div>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <i className="fa-solid fa-receipt" style={{fontSize: '1.8rem', color: '#00b0ff'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>{t('ticketPromedio')}</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>${kpis.ticketPromedio.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    {/* NUEVA SECCIÓN: DESGLOSE ANALÍTICO POR SUCURSAL */}
                    <div className="panel" style={{background: 'var(--bg-panel)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                        <h2><i className="fa-solid fa-chart-pie" style={{color: 'var(--accent)'}}></i> {t('desgloseFinanciero')}</h2>
                        <table className="data-table" style={{marginTop: '15px'}}>
                            <thead>
                                <tr>
                                    <th>{t('sucursal')}</th>
                                    <th>{t('ingresosConsultas')}</th>
                                    <th>{t('ingresosProductos')}</th>
                                    <th>{t('total')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>{t('napoles')}</strong></td>
                                    <td style={{color: 'var(--accent)'}}>${branchData.napoles.consultas.toFixed(2)} <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>({getProporcion(branchData.napoles.consultas, branchData.napoles.total)}%)</span></td>
                                    <td style={{color: '#ffb300'}}>${branchData.napoles.productos.toFixed(2)} <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>({getProporcion(branchData.napoles.productos, branchData.napoles.total)}%)</span></td>
                                    <td style={{fontWeight: 'bold', color: 'var(--success)'}}>${branchData.napoles.total.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td><strong>{t('obrera')}</strong></td>
                                    <td style={{color: 'var(--accent)'}}>${branchData.obrera.consultas.toFixed(2)} <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>({getProporcion(branchData.obrera.consultas, branchData.obrera.total)}%)</span></td>
                                    <td style={{color: '#ffb300'}}>${branchData.obrera.productos.toFixed(2)} <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>({getProporcion(branchData.obrera.productos, branchData.obrera.total)}%)</span></td>
                                    <td style={{fontWeight: 'bold', color: 'var(--success)'}}>${branchData.obrera.total.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td><strong>{t('pedregal')}</strong></td>
                                    <td style={{color: 'var(--accent)'}}>${branchData.pedregal.consultas.toFixed(2)} <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>({getProporcion(branchData.pedregal.consultas, branchData.pedregal.total)}%)</span></td>
                                    <td style={{color: '#ffb300'}}>${branchData.pedregal.productos.toFixed(2)} <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>({getProporcion(branchData.pedregal.productos, branchData.pedregal.total)}%)</span></td>
                                    <td style={{fontWeight: 'bold', color: 'var(--success)'}}>${branchData.pedregal.total.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px'}}>
                        <div className="panel" style={{background: 'var(--bg-panel)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <h2><i className="fa-solid fa-chart-simple"></i> {t('finanzasSucursal')}</h2>
                            <div style={{height: '220px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '30px 0 10px 0', borderBottom: '1px solid var(--border-color)'}}>
                                <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'80px'}}>
                                    <span style={{color:'var(--success)', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'5px'}}>${branchData.napoles.total.toFixed(0)}</span>
                                    <div style={{width: '100%', height: `${getPercent(branchData.napoles.total)}px`, background: 'var(--primary-red)', borderRadius: '6px 6px 0 0', minHeight:'2px', transition:'height 0.5s'}}></div>
                                    <span style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'8px'}}>{t('napoles')}</span>
                                </div>
                                <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'80px'}}>
                                    <span style={{color:'var(--success)', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'5px'}}>${branchData.obrera.total.toFixed(0)}</span>
                                    <div style={{width: '100%', height: `${getPercent(branchData.obrera.total)}px`, background: 'var(--primary-red)', borderRadius: '6px 6px 0 0', minHeight:'2px', transition:'height 0.5s'}}></div>
                                    <span style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'8px'}}>{t('obrera')}</span>
                                </div>
                                <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'80px'}}>
                                    <span style={{color:'var(--success)', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'5px'}}>${branchData.pedregal.total.toFixed(0)}</span>
                                    <div style={{width: '100%', height: `${getPercent(branchData.pedregal.total)}px`, background: 'var(--primary-red)', borderRadius: '6px 6px 0 0', minHeight:'2px', transition:'height 0.5s'}}></div>
                                    <span style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'8px'}}>{t('pedregal')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="panel" style={{background: 'var(--bg-panel)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <h2><i className="fa-solid fa-fire" style={{color:'var(--accent)'}}></i> {t('top5Vendidos')}</h2>
                            <table className="data-table" style={{fontSize: '0.9rem', marginTop: '10px'}}>
                                <thead>
                                    <tr><th>{t('detalle')}</th><th>{t('cantidadAbrev')}</th><th>{t('total')}</th></tr>
                                </thead>
                                <tbody>
                                    {topProducts.map((p, idx) => (
                                        <tr key={idx}>
                                            <td><strong>{p.nombre}</strong></td>
                                            <td>{p.unidades} {t('uds')}</td>
                                            <td style={{color:'var(--success)'}}>${p.ingresos.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {topProducts.length === 0 && <tr><td colSpan="3" style={{textAlign:'center', color:'var(--text-muted)'}}>{t('sinDatos')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="panel" style={{background: 'var(--bg-panel)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                        <h2><i className="fa-solid fa-clock-history"></i> {t('auditoriaTransacciones')}</h2>
                        <div style={{maxHeight: '300px', overflowY: 'auto', marginTop: '10px', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('folio')}</th>
                                        <th>{t('fechaHora')}</th>
                                        <th>{t('sucursalEmisora')}</th>
                                        <th>{t('montoCobrado')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentVentas.map(venta => (
                                        <tr key={venta.id}>
                                            <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{venta.id.toString().padStart(5, '0')}</td>
                                            <td>{new Date(venta.fecha).toLocaleString()}</td>
                                            <td><strong>{venta.sucursales?.nombre || t('general')}</strong></td>
                                            <td style={{color: 'var(--success)', fontWeight: 'bold'}}>${parseFloat(venta.total).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {recentVentas.length === 0 && (
                                        <tr><td colSpan="4" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>{t('noMovimientos')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}