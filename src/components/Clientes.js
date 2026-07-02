'use client';
import { useState } from 'react';

export default function Clientes() {
    const [search, setSearch] = useState('');
    const [clientes, setClientes] = useState([
        { id: '#1042', name: 'Roberto Sánchez', phone: '55-1234-5678', lastVisit: '05-Jun-2026', total: 12 },
        { id: '#1043', name: 'María de la Luz', phone: '55-9876-5432', lastVisit: '07-Jun-2026', total: 3 },
        { id: '#1044', name: 'Carlos Mendoza', phone: '55-5555-4444', lastVisit: '17-Jun-2026', total: 1 }
    ]);

    const addClient = () => {
        const name = prompt("Nombre completo del paciente:");
        if (!name) return;
        const phone = prompt("Teléfono:");
        
        const newId = '#10' + (45 + clientes.length);
        setClientes([{ id: newId, name, phone: phone || 'Sin registro', lastVisit: 'Hoy', total: 0 }, ...clientes]);
    };

    const filtered = clientes.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

    return (
        <div className="view-section active">
            <div className="panel">
                <h2><i className="fa-solid fa-users"></i> Directorio de Pacientes</h2>
                <div style={{marginBottom: '15px', display: 'flex', gap: '10px'}}>
                    <input 
                        type="text" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar paciente por nombre o teléfono..." 
                        style={{padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'white', width: '350px'}}
                    />
                    <button className="btn-action btn-primary" onClick={addClient}>
                        <i className="fa-solid fa-user-plus"></i> Registrar Paciente
                    </button>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre Completo</th>
                            <th>Teléfono</th>
                            <th>Última Visita</th>
                            <th>Total Visitas</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(client => (
                            <tr key={client.id}>
                                <td style={{color: 'var(--text-muted)'}}>{client.id}</td>
                                <td><strong>{client.name}</strong></td>
                                <td>{client.phone}</td>
                                <td>{client.lastVisit}</td>
                                <td>{client.total}</td>
                                <td>
                                    <button className="btn-action" onClick={() => alert(`Abriendo expediente de ${client.name}`)}>
                                        <i className="fa-solid fa-folder-open"></i> Expediente
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}