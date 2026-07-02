'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Clientes() {
    const [search, setSearch] = useState('');
    const [clientes, setClientes] = useState([]);
    
    // Modal Expediente
    const [selectedClient, setSelectedClient] = useState(null);
    const [historialCompras, setHistorialCompras] = useState([]);

    const fetchClientes = async () => {
        // Pedimos los clientes y todas sus ventas asociadas para calcular estadísticas
        const { data, error } = await supabase
            .from('clientes')
            .select(`
                id, nombre, telefono, fecha_registro,
                ventas (id, total, fecha)
            `)
            .order('nombre', { ascending: true });
            
        if (data) setClientes(data);
    };

    useEffect(() => {
        fetchClientes();
    }, []);

    const openExpediente = (cliente) => {
        // Ordenamos las ventas de más reciente a más antigua
        const compras = cliente.ventas ? cliente.ventas.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)) : [];
        setHistorialCompras(compras);
        setSelectedClient(cliente);
    };

    const addClient = async () => {
        const nombre = prompt("Nombre completo del paciente:");
        if (!nombre) return;
        const telefono = prompt("Teléfono:");
        
        const { error } = await supabase.from('clientes').insert([{ nombre, telefono }]);
        if (error) return alert('Error al guardar: ' + error.message);
        
        alert('Paciente registrado.');
        fetchClientes();
    };

    const filtered = clientes.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.telefono && c.telefono.includes(search)));

    return (
        <div className="view-section active">
            <div className="panel" style={{overflowY: 'auto'}}>
                <h2><i className="fa-solid fa-users"></i> Directorio y Expedientes</h2>
                <div style={{marginBottom: '20px', display: 'flex', gap: '10px'}}>
                    <input 
                        type="text" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Buscar paciente por nombre o teléfono..." 
                        style={{padding: '12px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'white', flex: 1, maxWidth: '400px'}}
                    />
                    <button className="btn-action btn-primary" onClick={addClient}>
                        <i className="fa-solid fa-user-plus"></i> Registrar Paciente
                    </button>
                </div>
                
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Nombre Completo</th>
                            <th>Teléfono</th>
                            <th>Total Visitas</th>
                            <th>Total Invertido</th>
                            <th>Última Visita</th>
                            <th>Expediente</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(client => {
                            const totalVisitas = client.ventas ? client.ventas.length : 0;
                            const totalGastado = client.ventas ? client.ventas.reduce((acc, v) => acc + parseFloat(v.total), 0) : 0;
                            
                            // Calcular la fecha más reciente si tiene ventas
                            let ultimaVisita = 'Sin registro';
                            if (totalVisitas > 0) {
                                const fechas = client.ventas.map(v => new Date(v.fecha));
                                const maxFecha = new Date(Math.max.apply(null, fechas));
                                ultimaVisita = maxFecha.toLocaleDateString();
                            }

                            return (
                                <tr key={client.id}>
                                    <td><strong>{client.nombre}</strong></td>
                                    <td style={{color: 'var(--text-muted)'}}>{client.telefono || 'N/A'}</td>
                                    <td>{totalVisitas}</td>
                                    <td style={{color: 'var(--success)'}}>${totalGastado.toFixed(2)}</td>
                                    <td style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>{ultimaVisita}</td>
                                    <td>
                                        <button className="btn-action" onClick={() => openExpediente(client)} style={{background: 'var(--bg-lighter)'}}>
                                            <i className="fa-solid fa-folder-open" style={{color: 'var(--accent)'}}></i> Historial
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* MODAL DEL EXPEDIENTE E HISTORIAL */}
            {selectedClient && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '15px'}}>
                            <div>
                                <h3 style={{color: 'var(--text-main)', marginBottom: '5px'}}><i className="fa-solid fa-user" style={{marginRight: '10px'}}></i>{selectedClient.nombre}</h3>
                                <span style={{color: 'var(--text-muted)'}}><i className="fa-solid fa-phone" style={{marginRight: '8px'}}></i>{selectedClient.telefono || 'Sin teléfono registrado'}</span>
                            </div>
                            <button onClick={() => setSelectedClient(null)} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer'}}>&times;</button>
                        </div>
                        
                        <h4 style={{marginBottom: '15px', color: 'var(--accent)'}}>Historial de Compras</h4>
                        <div style={{overflowY: 'auto', flex: 1, border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Fecha de Venta</th>
                                        <th>Folio</th>
                                        <th>Total de Ticket</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historialCompras.length === 0 ? (
                                        <tr><td colSpan="3" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>No hay compras registradas.</td></tr>
                                    ) : (
                                        historialCompras.map(venta => (
                                            <tr key={venta.id}>
                                                <td>{new Date(venta.fecha).toLocaleString()}</td>
                                                <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{venta.id.toString().padStart(5, '0')}</td>
                                                <td style={{color: 'var(--success)', fontWeight: 'bold'}}>${parseFloat(venta.total).toFixed(2)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}