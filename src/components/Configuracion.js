'use client';
import { useState } from 'react';

export default function Configuracion() {
    const [imprimir, setImprimir] = useState(true);
    const [alertas, setAlertas] = useState(true);
    const [iva, setIva] = useState('16%');

    return (
        <div className="view-section active">
            <div className="panel">
                <h2><i className="fa-solid fa-gear"></i> Configuración del Sistema</h2>
                <div style={{display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', marginTop: '20px'}}>
                    
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px'}}>
                        <div>
                            <span style={{fontSize: '1.1rem', display: 'block'}}><i className="fa-solid fa-print" style={{width:'30px', color:'var(--text-muted)'}}></i> Impresión Automática</span>
                            <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '30px'}}>Imprime el recibo automáticamente al cobrar.</span>
                        </div>
                        <label className="switch">
                            <input type="checkbox" checked={imprimir} onChange={(e) => setImprimir(e.target.checked)} />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px'}}>
                        <div>
                            <span style={{fontSize: '1.1rem', display: 'block'}}><i className="fa-solid fa-bell" style={{width:'30px', color:'var(--text-muted)'}}></i> Alertas de Stock Bajo</span>
                            <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '30px'}}>Advertencias visuales en el inventario.</span>
                        </div>
                        <label className="switch">
                            <input type="checkbox" checked={alertas} onChange={(e) => setAlertas(e.target.checked)} />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px'}}>
                        <div>
                            <span style={{fontSize: '1.1rem', display: 'block'}}><i className="fa-solid fa-percent" style={{width:'30px', color:'var(--text-muted)'}}></i> Tasa de IVA por defecto</span>
                        </div>
                        <select value={iva} onChange={(e) => setIva(e.target.value)} style={{padding: '8px 15px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                            <option>16%</option>
                            <option>0%</option>
                            <option>8% (Frontera)</option>
                        </select>
                    </div>

                    <button className="btn-action btn-primary" onClick={() => alert('Configuración guardada localmente')} style={{marginTop: '20px', alignSelf: 'flex-start'}}>
                        <i className="fa-solid fa-floppy-disk"></i> Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
}