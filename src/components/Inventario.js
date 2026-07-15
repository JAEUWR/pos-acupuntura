'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Inventario({ branch = 'napoles' }) {
    const [subVista, setSubVista] = useState('catalogo'); // 'catalogo' o 'historial'
    const [inventario, setInventario] = useState([]);
    const [logs, setLogs] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('');
    
    const branchIdMap = { napoles: 1, roma: 2, centro: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const fetchInventario = async () => {
        const { data } = await supabase
            .from('inventario')
            .select('stock, productos(id, codigo_barras, nombre, precio)')
            .eq('sucursal_id', sucursalId);
        if (data) setInventario(data);
    };

    const fetchHistorial = async () => {
        const { data } = await supabase
            .from('historial_inventario')
            .select('cantidad, tipo_movimiento, motivo, fecha, productos(nombre)')
            .eq('sucursal_id', sucursalId)
            .order('fecha', { ascending: false });
        if (data) setLogs(data);
    };

    useEffect(() => {
        if (subVista === 'catalogo') fetchInventario();
        if (subVista === 'historial') fetchHistorial();
    }, [branch, subVista]);

    const handleUpdateStock = async (producto_id, inputId, currentStock) => {
        const inputVal = document.getElementById(inputId).value;
        if (inputVal === '' || isNaN(inputVal) || inputVal < 0) return alert('Cantidad no válida');
        
        const nuevoStock = parseInt(inputVal);
        const diferencia = nuevoStock - currentStock;
        if (diferencia === 0) return;

        // 1. Modificar el inventario físico
        const { error } = await supabase
            .from('inventario')
            .update({ stock: nuevoStock })
            .match({ producto_id: producto_id, sucursal_id: sucursalId });
        
        if (!error) {
            // 2. Registrar el ajuste manual en el historial
            await supabase.from('historial_inventario').insert([{
                producto_id,
                sucursal_id: sucursalId,
                cantidad: diferencia,
                tipo_movimiento: 'ajuste',
                motivo: 'Ajuste manual desde panel administrativo'
            }]);
            fetchInventario();
            alert('Stock actualizado y registrado correctamente.');
        }
    };

    const guardarProducto = async () => {
        if (!newCode || !newName || !newPrice) return alert('Completa los campos obligatorios.');
        
        const { data: prodData, error: prodError } = await supabase
            .from('productos')
            .insert([{ codigo_barras: newCode.trim(), nombre: newName.trim(), precio: parseFloat(newPrice) }])
            .select();

        if (prodError) return alert('Error: ' + prodError.message);
        const newProdId = prodData[0].id;

        // Inicializar stock en 0 en las 3 sedes
        await supabase.from('inventario').insert([
            { producto_id: newProdId, sucursal_id: 1, stock: 0 },
            { producto_id: newProdId, sucursal_id: 2, stock: 0 },
            { producto_id: newProdId, sucursal_id: 3, stock: 0 }
        ]);

        // Guardar registro de entrada inicial de catálogo
        await supabase.from('historial_inventario').insert([{
            producto_id: newProdId,
            sucursal_id: sucursalId,
            cantidad: 0,
            tipo_movimiento: 'entrada',
            motivo: 'Alta inicial del producto en catálogo'
        }]);

        setShowModal(false);
        setNewCode(''); setNewName(''); setNewPrice('');
        fetchInventario();
    };

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '15px'}}>
            <div style={{display: 'flex', gap: '10px', background: 'var(--bg-panel)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                <button className={`btn-action ${subVista === 'catalogo' ? 'btn-primary' : ''}`} onClick={() => setSubVista('catalogo')}>
                    <i className="fa-solid fa-boxes-stacked"></i> Catálogo de Inventario
                </button>
                <button className={`btn-action ${subVista === 'historial' ? 'btn-primary' : ''}`} onClick={() => setSubVista('historial')}>
                    <i className="fa-solid fa-history"></i> Historial de Movimientos (Kardex)
                </button>
            </div>

            {subVista === 'catalogo' ? (
                <div className="panel">
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
                        <h2>Inventario Actual - {branch.toUpperCase()}</h2>
                        <button className="btn-action btn-primary" onClick={() => setShowModal(true)}>+ Nuevo Producto</button>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr><th>Código</th><th>Producto</th><th>Precio</th><th>Existencia</th><th>Ajustar</th></tr>
                        </thead>
                        <tbody>
                            {inventario.map(inv => inv.productos && (
                                <tr key={inv.productos.id}>
                                    <td>{inv.productos.codigo_barras}</td>
                                    <td><strong>{inv.productos.nombre}</strong></td>
                                    <td>${inv.productos.precio}</td>
                                    <td style={{fontWeight:'bold', color: inv.stock < 5 ? 'var(--primary-red)' : 'var(--success)'}}>{inv.stock}</td>
                                    <td>
                                        <div style={{display:'flex', gap:'5px'}}>
                                            <input id={`stock-${inv.productos.id}`} type="number" defaultValue={inv.stock} style={{width:'70px', background:'var(--bg-dark)', color:'white', border:'1px solid #333', padding:'4px'}} />
                                            <button onClick={() => handleUpdateStock(inv.productos.id, `stock-${inv.productos.id}`, inv.stock)} className="btn-action"><i className="fa-solid fa-check"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="panel">
                    <h2>Kardex de Auditoría Global ({branch.toUpperCase()})</h2>
                    <table className="data-table">
                        <thead>
                            <tr><th>Fecha</th><th>Producto</th><th>Movimiento</th><th>Cantidad</th><th>Motivo descriptivo</th></tr>
                        </thead>
                        <tbody>
                            {logs.map((log, idx) => (
                                <tr key={idx}>
                                    <td style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>{new Date(log.fecha).toLocaleString()}</td>
                                    <td><strong>{log.productos?.nombre}</strong></td>
                                    <td>
                                        <span style={{padding:'4px 8px', borderRadius:'4px', fontSize:'0.75rem', background: log.tipo_movimiento === 'salida' ? '#3a0f0f' : '#0f3a1c'}}>
                                            {log.tipo_movimiento.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{fontWeight: 'bold', color: log.cantidad >= 0 ? 'var(--success)' : 'var(--primary-red)'}}>
                                        {log.cantidad >= 0 ? `+${log.cantidad}` : log.cantidad}
                                    </td>
                                    <td style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>{log.motivo}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Alta omitido por brevedad conservando la misma lógica funcional previa */}
            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '400px'}}>
                        <h3>Registrar en Catálogo</h3>
                        <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Código de barras" style={{width:'100%', padding:'10px', margin:'10px 0', background:'var(--bg-dark)', color:'white'}} />
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del artículo" style={{width:'100%', padding:'10px', margin:'10px 0', background:'var(--bg-dark)', color:'white'}} />
                        <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Precio General" style={{width:'100%', padding:'10px', margin:'10px 0', background:'var(--bg-dark)', color:'white'}} />
                        <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                            <button className="btn-action btn-primary" style={{flex:1}} onClick={guardarProducto}>Guardar</button>
                            <button className="btn-action" style={{flex:1}} onClick={() => setShowModal(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}