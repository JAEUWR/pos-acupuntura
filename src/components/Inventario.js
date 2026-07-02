'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Inventario({ branch }) {
    const [inventario, setInventario] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    // Mapeo
    const branchIdMap = { napoles: 1, roma: 2, centro: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const fetchInventario = async () => {
        // Hacemos un JOIN entre productos e inventario
        const { data, error } = await supabase
            .from('inventario')
            .select('stock, productos(id, codigo_barras, nombre, precio, precio_mayoreo)')
            .eq('sucursal_id', sucursalId);
        
        if (data) setInventario(data);
    };

    useEffect(() => {
        fetchInventario();
    }, [branch]);

    const handleUpdateStock = async (producto_id, nuevoStock) => {
        const { error } = await supabase
            .from('inventario')
            .update({ stock: nuevoStock })
            .match({ producto_id: producto_id, sucursal_id: sucursalId });
        
        if (!error) fetchInventario();
    };

    return (
        <div className="view-section active">
            <div className="panel">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h2><i className="fa-solid fa-boxes-stacked"></i> Inventario - {branch.toUpperCase()}</h2>
                    <button className="btn-action btn-primary" onClick={() => setShowModal(true)}>+ Nuevo Producto</button>
                </div>
                
                <table className="data-table">
                    <thead>
                        <tr><th>Código</th><th>Producto</th><th>Precio Gral.</th><th>Stock Actual</th><th>Ajustar Stock</th></tr>
                    </thead>
                    <tbody>
                        {inventario.map((inv, idx) => (
                            <tr key={idx}>
                                <td>{inv.productos.codigo_barras}</td>
                                <td>{inv.productos.nombre}</td>
                                <td>${inv.productos.precio}</td>
                                <td style={{color: inv.stock < 10 ? 'var(--primary-red)' : 'white'}}>{inv.stock}</td>
                                <td>
                                    <button onClick={() => handleUpdateStock(inv.productos.id, inv.stock - 1)} style={{marginRight:'5px', padding:'5px 10px'}}>-</button>
                                    <button onClick={() => handleUpdateStock(inv.productos.id, inv.stock + 1)} style={{padding:'5px 10px'}}>+</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL CREAR PRODUCTO */}
            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '400px'}}>
                        <h3>Registrar Nuevo Producto</h3>
                        <input type="text" id="new_code" placeholder="Código de barras" style={{width:'100%', padding:'10px', margin:'10px 0', background:'var(--bg-dark)', color:'white'}} />
                        <input type="text" id="new_name" placeholder="Nombre del producto" style={{width:'100%', padding:'10px', margin:'10px 0', background:'var(--bg-dark)', color:'white'}} />
                        <input type="number" id="new_price" placeholder="Precio General ($)" style={{width:'100%', padding:'10px', margin:'10px 0', background:'var(--bg-dark)', color:'white'}} />
                        <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                            <button className="btn-action btn-primary" style={{flex:1}} onClick={() => alert('Falta conectar Insert a Supabase aquí')}>Guardar</button>
                            <button className="btn-action" style={{flex:1}} onClick={() => setShowModal(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}