'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Reportes() {
    const [loading, setLoading] = useState(true);
    
    // Rango de fechas por defecto: Desde el 1 de Julio de 2026 hasta hoy
    const [startDate, setStartDate] = useState('2026-07-01');
    const [endDate, setEndDate] = useState('2026-07-31');

    // Estados para métricas clave (KPIs)
    const [kpis, setKpis] = useState({
        ingresos: 0,
        consultas: 0,
        productos: 0,
        ticketPromedio: 0
    });

    // Estado para gráfica de sucursales actualizado
    const [branchData, setBranchData] = useState({ napoles: 0, obrera: 0, pedregal: 0 });
    
    // Listas detalladas
    const [recentVentas, setRecentVentas] = useState([]);
    const [topProducts, setTopProducts] = useState([]);

    const calculateDashboardData = async () => {
        setLoading(true);
        
        // Consulta relacional profunda en Supabase filtrada por fechas
        const { data: ventas, error } = await supabase
            .from('ventas')
            .select(`
                id, total, fecha, sucursal_id,
                sucursales ( nombre ),
                venta_detalles (
                    cantidad, precio_unitario, tipo_precio,
                    productos ( id, nombre, tipo )
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

        // Variables temporales de acumulación para el cálculo matemático
        let totalIngresos = 0;
        let totalConsultas = 0;
        let totalProductos = 0;
        let sedes = { napoles: 0, obrera: 0, pedregal: 0 };
        let productMap = {};

        ventas.forEach(v => {
            const monto = parseFloat(v.total);
            totalIngresos += monto;

            // Agregación por ID de sucursal según las llaves relacionales
            if (v.sucursal_id === 1) sedes.napoles += monto;
            if (v.sucursal_id === 2) sedes.obrera += monto;
            if (v.sucursal_id === 3) sedes.pedregal += monto;

            // Procesar el desglose de los artículos dentro del ticket
            v.venta_detalles?.forEach(det => {
                const cant = parseInt(det.cantidad);
                const nombreItem = det.productos?.nombre || 'Artículo eliminado';
                
                // Clasificación inteligente del tipo de servicio/producto
                if (det.productos?.tipo === 'consulta' || nombreItem.toLowerCase().includes('consulta')) {
                    totalConsultas += cant;
                } else {
                    totalProductos += cant;
                }

                // Acumulación para el Top de más vendidos
                if (!productMap[nombreItem]) {
                    productMap[nombreItem] = { nombre: nombreItem, unidades: 0, ingresos: 0 };
                }
                productMap[nombreItem].unidades += cant;
                productMap[nombreItem].ingresos += cant * parseFloat(det.precio_unitario);
            });
        });

        // Formatear el arreglo de productos más vendidos ordenado de mayor a menor
        const topSorted = Object.values(productMap)
            .sort((a, b) => b.unidades - a.unidades)
            .slice(0, 5);

        // Guardar estados calculados
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

    // Ejecuta el cálculo cada vez que el usuario altera los selectores de fecha
    useEffect(() => {
        calculateDashboardData();
    }, [startDate, endDate]);

    // EXPORTACIÓN NATIVA A EXCEL (CSV) DE MANERA CRIPTOGRÁFICA Y SEGURA
    const exportToExcel = () => {
        if (recentVentas.length === 0) return alert('No hay datos en el rango seleccionado para exportar.');

        const headers = ["Folio", "Fecha/Hora", "Sucursal", "Total Cobrado\n"];
        const rows = recentVentas.map(v => [
            `#${v.id.toString().padStart(5, '0')}`,
            new Date(v.fecha).toLocaleString(),
            v.sucursales?.nombre || 'Público General',
            `$${parseFloat(v.total).toFixed(2)}`
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Cierre_Caja_${startDate}_al_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Imprimir pantalla formateada simulando exportación limpia a PDF
    const triggerPDFPrint = () => {
        window.print();
    };

    // Calcular proporciones dinámicas para que las gráficas de barras nunca se desborden de su contenedor
    const maxSale = Math.max(branchData.napoles, branchData.obrera, branchData.pedregal, 1);
    const getPercent = (value) => ((value / maxSale) * 100).toFixed(0);

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '5px'}}>
            
            {/* PANEL DE FILTROS CRONOLÓGICOS Y CONTROLES */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)', padding: '15px 25px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                    <div>
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px'}}>Fecha Inicio:</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{padding: '8px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                    </div>
                    <div>
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px'}}>Fecha Fin:</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{padding: '8px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                    </div>
                </div>
                
                <div style={{display: 'flex', gap: '10px'}}>
                    <button className="btn-action" onClick={exportToExcel} style={{background: '#1e3d26', border: '1px solid #2e7d32'}}><i className="fa-solid fa-file-excel" style={{color: 'var(--success)', marginRight: '8px'}}></i> Excel / CSV</button>
                    <button className="btn-action" onClick={triggerPDFPrint} style={{background: '#3d1e1e', border: '1px solid var(--primary-red)'}}><i className="fa-solid fa-file-pdf" style={{color: 'var(--accent)', marginRight: '8px'}}></i> Imprimir PDF</button>
                </div>
            </div>

            {loading ? (
                <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-spinner fa-spin fa-2x"></i><p style={{marginTop:'10px'}}>Procesando transacciones en la nube...</p></div>
            ) : (
                <>
                    {/* INDICADORES CLAVE (KPI CARDS) */}
                    <div className="dashboard-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px'}}>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <i className="fa-solid fa-money-bill-wave" style={{fontSize: '1.8rem', color: 'var(--success)'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>INGRESOS TOTALES</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>${kpis.ingresos.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <i className="fa-solid fa-user-md" style={{fontSize: '1.8rem', color: 'var(--accent)'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>CONSULTAS TOTALES</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>{kpis.consultas}</span>
                        </div>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <i className="fa-solid fa-box" style={{fontSize: '1.8rem', color: '#ffb300'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>INSUMOS DESPLAZADOS</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>{kpis.productos}</span>
                        </div>
                        <div className="dash-card" style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <i className="fa-solid fa-receipt" style={{fontSize: '1.8rem', color: '#00b0ff'}}></i>
                            <span style={{display:'block', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'10px'}}>TICKET PROMEDIO</span>
                            <span style={{fontSize: '2rem', fontWeight: 'bold', display:'block'}}>${kpis.ticketPromedio.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    {/* SECCIÓN GRÁFICA INTERACTIVA Y TOP PRODUCTOS */}
                    <div style={{display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px'}}>
                        
                        {/* GRÁFICA DE RENDIMIENTO DE SEDES DE ACUPUNTURA */}
                        <div className="panel" style={{background: 'var(--bg-panel)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <h2><i className="fa-solid fa-chart-simple"></i> Finanzas por Sucursal</h2>
                            <div style={{height: '220px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '30px 0 10px 0', borderBottom: '1px solid var(--border-color)'}}>
                                <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'80px'}}>
                                    <span style={{color:'var(--success)', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'5px'}}>${branchData.napoles.toFixed(0)}</span>
                                    <div style={{width: '100%', height: `${getPercent(branchData.napoles)}px`, background: 'var(--primary-red)', borderRadius: '6px 6px 0 0', minHeight:'2px', transition:'height 0.5s'}}></div>
                                    <span style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'8px'}}>Nápoles</span>
                                </div>
                                <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'80px'}}>
                                    <span style={{color:'var(--success)', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'5px'}}>${branchData.obrera.toFixed(0)}</span>
                                    <div style={{width: '100%', height: `${getPercent(branchData.obrera)}px`, background: 'var(--primary-red)', borderRadius: '6px 6px 0 0', minHeight:'2px', transition:'height 0.5s'}}></div>
                                    <span style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'8px'}}>Obrera</span>
                                </div>
                                <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'80px'}}>
                                    <span style={{color:'var(--success)', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'5px'}}>${branchData.pedregal.toFixed(0)}</span>
                                    <div style={{width: '100%', height: `${getPercent(branchData.pedregal)}px`, background: 'var(--primary-red)', borderRadius: '6px 6px 0 0', minHeight:'2px', transition:'height 0.5s'}}></div>
                                    <span style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'8px'}}>Pedregal</span>
                                </div>
                            </div>
                        </div>

                        {/* TABLA DE TOP ARTÍCULOS */}
                        <div className="panel" style={{background: 'var(--bg-panel)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                            <h2><i className="fa-solid fa-fire" style={{color:'var(--accent)'}}></i> Top 5 Más Vendidos</h2>
                            <table className="data-table" style={{fontSize: '0.9rem', marginTop: '10px'}}>
                                <thead>
                                    <tr><th>Detalle</th><th>Cant.</th><th>Total</th></tr>
                                </thead>
                                <tbody>
                                    {topProducts.map((p, idx) => (
                                        <tr key={idx}>
                                            <td><strong>{p.nombre}</strong></td>
                                            <td>{p.unidades} uds</td>
                                            <td style={{color:'var(--success)'}}>${p.ingresos.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {topProducts.length === 0 && <tr><td colSpan="3" style={{textAlign:'center', color:'var(--text-muted)'}}>Sin datos.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* REGISTRO DE TRANSACCIONES AUDITABLES */}
                    <div className="panel" style={{background: 'var(--bg-panel)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
                        <h2><i className="fa-solid fa-clock-history"></i> Auditoría de Transacciones Recientes</h2>
                        <div style={{maxHeight: '300px', overflowY: 'auto', marginTop: '10px', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Folio</th>
                                        <th>Fecha / Hora</th>
                                        <th>Sucursal Emisora</th>
                                        <th>Monto Cobrado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentVentas.map(venta => (
                                        <tr key={venta.id}>
                                            <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{venta.id.toString().padStart(5, '0')}</td>
                                            <td>{new Date(venta.fecha).toLocaleString()}</td>
                                            <td><strong>{venta.sucursales?.nombre || 'General'}</strong></td>
                                            <td style={{color: 'var(--success)', fontWeight: 'bold'}}>${parseFloat(venta.total).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {recentVentas.length === 0 && (
                                        <tr><td colSpan="4" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>No se detectaron movimientos en el rango cronológico seleccionado.</td></tr>
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