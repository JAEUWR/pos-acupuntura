'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Inventario({ branch = 'napoles' }) {
    const [inventario, setInventario] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newPriceMayoreo, setNewPriceMayoreo] = useState('');
    const [newPriceDist, setNewPriceDist] = useState('');
    
    const branchIdMap = { napoles: 1, roma: 2, centro: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const fetchInventario = async () => {
        const { data, error } = await supabase
            .from('inventario')
            .select('stock, productos(id, codigo_barras, nombre, precio, precio_mayoreo, precio_distribuidor)')
            .eq('sucursal_id', sucursalId);
        
        if (data) setInventario(data);
    };

    useEffect(() => {
        fetchInventario();
    }, [branch]);

    const handleUpdateStock = async (producto_id, inputId) => {
        const nuevoStock = document.getElementById(inputId).value;
        if (nuevoStock === '' || isNaN(nuevoStock) || nuevoStock < 0) return alert('Ingresa una cantidad válida');

        const { error } = await supabase
            .from('inventario')
            .update({ stock: parseInt(nuevoStock) })
            .match({ producto_id: producto_id, sucursal_id: sucursalId });
        
        if (error) {
            alert('Error al actualizar: ' + error.message);
        } else {
            fetchInventario();
        }
    };

    // NUEVA FUNCIÓN PARA ELIMINAR EL PRODUCTO
    const eliminarProducto = async (producto_id, nombre) => {
        const confirmacion = window.confirm(`¿Estás seguro de eliminar el producto "${nombre}"? Esto lo borrará de TODAS las sucursales permanentemente.`);
        if (!confirmacion) return;

        // 1. Primero lo borramos de los inventarios de todas las sedes (por la llave foránea)
        const { error: invError } = await supabase
            .from('inventario')
            .delete()
            .eq('producto_id', producto_id);

        if (invError) return alert('Error al quitar del inventario: ' + invError.message);

        // 2. Ahora sí lo borramos del catálogo principal
        const { error: prodError } = await supabase
            .from('productos')
            .delete()
            .eq('id', producto_id);

        if (prodError) return alert('Error al borrar el producto: ' + prodError.message);

        alert('Producto eliminado exitosamente del sistema.');
        fetchInventario();
    };

    const guardarProducto = async () => {
        if (!newCode || !newName || !newPrice) return alert('El código, nombre y precio general son obligatorios.');

        const pGeneral = parseFloat(newPrice);
        const pMayoreo = newPriceMayoreo ? parseFloat(newPriceMayoreo) : pGeneral;
        const pDist = newPriceDist ? parseFloat(newPriceDist) : pGeneral;

        const { data: prodData, error: prodError } = await supabase
            .from('productos')
            .insert([{ 
                codigo_barras: newCode.trim(), 
                nombre: newName.trim(), 
                precio: pGeneral,
                precio_mayoreo: pMayoreo,
                precio_distribuidor: pDist
            }])
            .select();

        if (prodError) return alert('Error al crear producto: ' + prodError.message);
        const newProductId = prodData[0].id;

        const { error: invError } = await supabase
            .from('inventario')
            .insert([
                { producto_id: newProductId, sucursal_id: 1, stock: 0 },
                { producto_id: newProductId, sucursal_id: 2, stock: 0 },
                { producto_id: newProductId, sucursal_id: 3, stock: 0 }
            ]);

        if (invError) return alert('Error al crear inventario: ' + invError.message);

        setShowModal(false);
        setNewCode(''); setNewName(''); setNewPrice(''); setNewPriceMayoreo(''); setNewPriceDist('');
        fetchInventario();
    };

    return (
        <div className="view-section active">
            <div className="panel" style={{overflowY: 'auto'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                    <h2><i className="fa-solid fa-boxes-stacked"></i> Inventario - {branch.toUpperCase()}</h2>
                    <button className="btn-action btn-primary" onClick={() => setShowModal(true)}>+ Nuevo Producto</button>
                </div>
                
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Precios (Gral/May/Dist)</th>
                            <th>Stock Actual</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventario.map((inv) => {
                            if(!inv.productos) return null;
                            const inputId = `stock-input-${inv.productos.id}`;
                            return (
                                <tr key={inv.productos.id}>
                                    <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>{inv.productos.codigo_barras}</td>
                                    <td><strong>{inv.productos.nombre}</strong></td>
                                    <td style={{fontSize: '0.85rem'}}>
                                        <div style={{color:'var(--text-main)'}}>${inv.productos.precio}</div>
                                        <div style={{color:'var(--text-muted)'}}>${inv.productos.precio_mayoreo} / ${inv.productos.precio_distribuidor}</div>
                                    </td>
                                    <td style={{color: inv.stock < 10 ? 'var(--primary-red)' : 'var(--success)', fontWeight: 'bold', fontSize: '1.2rem'}}>
                                        {inv.stock}
                                    </td>
                                    <td>
                                        <div style={{display: 'flex', gap: '5px', alignItems: 'center'}}>
                                            <input 
                                                id={inputId} 
                                                type="number" 
                                                defaultValue={inv.stock} 
                                                style={{width:'80px', padding:'8px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'4px'}} 
                                            />
                                            <button 
                                                onClick={() => handleUpdateStock(inv.productos.id, inputId)} 
                                                title="Actualizar Stock"
                                                className="btn-action" 
                                                style={{padding:'8px 12px', background:'var(--bg-lighter)'}}>
                                                <i className="fa-solid fa-check" style={{color: 'var(--success)'}}></i>
                                            </button>
                                            <button 
                                                onClick={() => eliminarProducto(inv.productos.id, inv.productos.nombre)} 
                                                title="Eliminar Producto"
                                                className="btn-action" 
                                                style={{padding:'8px 12px', background:'var(--bg-lighter)'}}>
                                                <i className="fa-solid fa-trash" style={{color: 'var(--primary-red)'}}></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '450px'}}>
                        <h3 style={{marginBottom: '20px'}}><i className="fa-solid fa-box"></i> Registrar Nuevo Producto</h3>
                        
                        <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                            <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Código de barras" style={{flex:1, padding:'10px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        </div>
                        
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del producto" style={{width:'100%', padding:'10px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px'}}>
                            <div>
                                <label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>General</label>
                                <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="$0.00" style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                            </div>
                            <div>
                                <label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Mayoreo</label>
                                <input type="number" value={newPriceMayoreo} onChange={(e) => setNewPriceMayoreo(e.target.value)} placeholder="$0.00" style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                            </div>
                            <div>
                                <label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Distribuidor</label>
                                <input type="number" value={newPriceDist} onChange={(e) => setNewPriceDist(e.target.value)} placeholder="$0.00" style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                            </div>
                        </div>

                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1, padding: '12px'}} onClick={guardarProducto}><i className="fa-solid fa-floppy-disk"></i> Guardar Catálogo</button>
                            <button className="btn-action" style={{flex:1, padding: '12px'}} onClick={() => setShowModal(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}