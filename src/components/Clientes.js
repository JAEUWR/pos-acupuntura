'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Clientes() {
    const [search, setSearch] = useState('');
    const [clientes, setClientes] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [historialCompras, setHistorialCompras] = useState([]);

    const fetchClientes = async () => {
        // Consulta relacional profunda hacia ventas, detalles y productos
        const { data } = await supabase
            .from('clientes')
            .select(`
                id, nombre, telefono, fecha_registro,
                ventas (
                    id, total, fecha,
                    venta_detalles (
                        cantidad, precio_unitario, tipo_precio,
                        productos ( nombre )
                    )
                )
            `)
            .order('nombre', { ascending: true });
            
        if (data) setClientes(data);
    };

    useEffect(() => { fetchClientes(); }, []);

    const openExpediente = (cliente) => {
        const compras = cliente.ventas ? cliente.ventas.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)) : [];
        setHistorialCompras(compras);
        setSelectedClient(cliente);
    };

    const filtered = clientes.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.telefono && c.telefono.includes(search)));

    return (
        <div className="view-section active">
            <div className="panel" style={{overflowY: 'auto'}}>
                <h2><i className="fa-solid fa-users"></i> Directorio y Expedientes Clínicos</h2>
                <div style={{marginBottom: '20px'}}>
                    <input 
                        type="text" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Buscar paciente por nombre o teléfono..." 
                        style={{padding: '12px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'white', width: '100%', maxWidth: '400px'}}
                    />
                </div>
                
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Nombre Completo</th>
                            <th>Teléfono</th>
                            <th>Visitas</th>
                            <th>Total Invertido</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(client => (
                            <tr key={client.id}>
                                <td><strong>{client.nombre}</strong></td>
                                <td style={{color: 'var(--text-muted)'}}>{client.telefono || 'N/A'}</td>
                                <td>{client.ventas?.length || 0}</td>
                                <td style={{color: 'var(--success)'}}>${client.ventas?.reduce((acc, v) => acc + parseFloat(v.total), 0).toFixed(2)}</td>
                                <td>
                                    <button className="btn-action" onClick={() => openExpediente(client)} style={{background: 'var(--bg-lighter)'}}>
                                        <i className="fa-solid fa-folder-open" style={{color: 'var(--accent)'}}></i> Ver Historial Completo
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* EXPEDIENTE CON DESGLOSE DE PRODUCTOS */}
            {selectedClient && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '650px', maxHeight: '80vh', display: 'flex', flexDirection: 'column'}}>
                        <div style={{display: 'flex', justifycontent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '15px'}}>
                            <div>
                                <h3>{selectedClient.nombre}</h3>
                                <span style={{color: 'var(--text-muted)'}}><i className="fa-solid fa-phone"></i> {selectedClient.telefono || 'Sin teléfono'}</span>
                            </div>
                            <button onClick={() => setSelectedClient(null)} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer'}}>&times;</button>
                        </div>
                        
                        <div style={{overflowY: 'auto', flex: 1}}>
                            {historialCompras.map(venta => (
                                <div key={venta.id} style={{background: 'var(--bg-dark)', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid var(--border-color)'}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px dashed #333', paddingBottom: '8px'}}>
                                        <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>{new Date(venta.fecha).toLocaleString()}</span>
                                        <span style={{fontFamily: 'monospace'}}>Folio: #{venta.id.toString().padStart(5, '0')}</span>
                                    </div>
                                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem'}}>
                                        <thead>
                                            <tr style={{color: 'var(--text-muted)', textAlign: 'left'}}>
                                                <th>Artículo</th>
                                                <th>Cant.</th>
                                                <th>P. Unit</th>
                                                <th>Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {venta.venta_detalles?.map((det, idx) => (
                                                <tr key={idx} style={{borderBottom: '1px solid #222'}}>
                                                    <td style={{padding: '6px 0'}}>
                                                        {det.productos?.nombre} <span style={{fontSize:'0.75rem', color:'var(--accent)'}}>({det.tipo_precio})</span>
                                                    </td>
                                                    <td>{det.cantidad}</td>
                                                    <td>${parseFloat(det.precio_unitario).toFixed(2)}</td>
                                                    <td>${(det.cantidad * parseFloat(det.precio_unitario)).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{textAlign: 'right', marginTop: '10px', color: 'var(--success)', fontWeight: 'bold', fontSize: '1.1rem'}}>
                                        Total Ticket: ${parseFloat(venta.total).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                            {historialCompras.length === 0 && <p style={{color:'var(--text-muted)', textAlign:'center'}}>No hay registros de compras.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}