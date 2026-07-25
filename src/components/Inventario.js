'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
// IMPORTAMOS EL IDIOMA
import { useLanguage } from '../context/LanguageContext';

export default function Inventario({ branch = 'napoles' }) {
    const { t } = useLanguage(); // Función de traducción
    
    const [subVista, setSubVista] = useState('catalogo'); 
    const [inventario, setInventario] = useState([]);
    const [logs, setLogs] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newPriceMayoreo, setNewPriceMayoreo] = useState('');
    const [newPriceDistribuidor, setNewPriceDistribuidor] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');

    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [selectedProductsForGroup, setSelectedProductsForGroup] = useState([]);
    
    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const fetchDatos = async () => {
        const { data: gData } = await supabase.from('grupos_productos').select('*').order('nombre');
        if (gData) setGrupos(gData);

        if (subVista === 'catalogo' || subVista === 'grupos') {
            const { data } = await supabase
                .from('inventario')
                .select('stock, productos(id, codigo_barras, nombre, precio, precio_mayoreo, precio_distribuidor, grupo_id, grupos_productos(nombre))')
                .eq('sucursal_id', sucursalId);
            if (data) setInventario(data);
        }
        if (subVista === 'historial') {
            const { data } = await supabase
                .from('historial_inventario')
                .select('cantidad, tipo_movimiento, motivo, fecha, productos(nombre)')
                .eq('sucursal_id', sucursalId)
                .order('fecha', { ascending: false });
            if (data) setLogs(data);
        }
    };

    useEffect(() => { fetchDatos(); }, [branch, subVista]);

    const handleUpdateStock = async (producto_id, inputId, currentStock) => {
        const inputVal = document.getElementById(inputId).value;
        if (inputVal === '' || isNaN(inputVal) || inputVal < 0) return alert(t('cantidadInvalida'));
        
        const nuevoStock = parseInt(inputVal);
        const diferencia = nuevoStock - currentStock;
        if (diferencia === 0) return;

        const { error } = await supabase.from('inventario').update({ stock: nuevoStock }).match({ producto_id: producto_id, sucursal_id: sucursalId });
        if (!error) {
            await supabase.from('historial_inventario').insert([{ producto_id, sucursal_id: sucursalId, cantidad: diferencia, tipo_movimiento: 'ajuste', motivo: 'Ajuste manual (Panel)' }]);
            fetchDatos();
            alert(t('stockActualizado'));
        }
    };

    const handleUpdatePrecios = async (producto_id) => {
        const valGen = document.getElementById(`precio-${producto_id}`).value;
        const valMay = document.getElementById(`mayoreo-${producto_id}`).value;
        const valDist = document.getElementById(`distribuidor-${producto_id}`).value;
        if (!valGen || !valMay || !valDist) return alert(t('preciosInvalidos'));

        const { error } = await supabase.from('productos').update({ precio: parseFloat(valGen), precio_mayoreo: parseFloat(valMay), precio_distribuidor: parseFloat(valDist) }).eq('id', producto_id);
        if (error) return alert(`Error: ${error.message}`);
        alert(t('preciosActualizadosGlobal'));
        fetchDatos();
    };

    const actualizarPrecioGrupo = async (grupo_id, nombreGrupo) => {
        const nuevoPrecio = prompt(`${t('promptPrecioMasivo1')} "${nombreGrupo}".\n${t('promptPrecioMasivo2')}`);
        if (!nuevoPrecio || isNaN(nuevoPrecio)) return;
        
        const { error } = await supabase.from('productos').update({ 
            precio: parseFloat(nuevoPrecio),
            precio_mayoreo: parseFloat(nuevoPrecio),
            precio_distribuidor: parseFloat(nuevoPrecio)
        }).eq('grupo_id', grupo_id);

        if (error) return alert(`Error: ${error.message}`);
        alert(t('preciosMasivosAplicados'));
        fetchDatos();
    };

    const openNewGroupModal = () => {
        setEditingGroupId(null);
        setGroupName('');
        setSelectedProductsForGroup([]);
        setShowGroupModal(true);
    };

    const openEditGroupModal = (grupo) => {
        setEditingGroupId(grupo.id);
        setGroupName(grupo.nombre);
        const prodsEnGrupo = inventario
            .filter(inv => inv.productos && inv.productos.grupo_id === grupo.id)
            .map(inv => inv.productos.id);
        setSelectedProductsForGroup(prodsEnGrupo);
        setShowGroupModal(true);
    };

    const toggleProductSelection = (prodId) => {
        if (selectedProductsForGroup.includes(prodId)) {
            setSelectedProductsForGroup(selectedProductsForGroup.filter(id => id !== prodId));
        } else {
            setSelectedProductsForGroup([...selectedProductsForGroup, prodId]);
        }
    };

    const guardarFamilia = async () => {
        if (!groupName.trim()) return alert(t('nombreFamiliaObligatorio'));
        
        let targetGroupId = editingGroupId;

        if (!targetGroupId) {
            const { data, error } = await supabase.from('grupos_productos').insert([{ nombre: groupName.trim() }]).select();
            if (error) return alert(`Error: ${error.message}`);
            targetGroupId = data[0].id;
        } else {
            const { error } = await supabase.from('grupos_productos').update({ nombre: groupName.trim() }).eq('id', targetGroupId);
            if (error) return alert(`Error: ${error.message}`);
            await supabase.from('productos').update({ grupo_id: null }).eq('grupo_id', targetGroupId);
        }

        if (selectedProductsForGroup.length > 0) {
            const { error: assignError } = await supabase.from('productos').update({ grupo_id: targetGroupId }).in('id', selectedProductsForGroup);
            if (assignError) alert(`Error: ${assignError.message}`);
        }

        setShowGroupModal(false);
        alert(`"${groupName}" ${t('familiaGuardadaExito')}`);
        fetchDatos();
    };

    const guardarProductoIndividual = async () => {
        if (!newCode || !newName || !newPrice) return alert(t('faltanCampos'));
        
        const { data: prodData, error: prodError } = await supabase.from('productos').insert([{ 
            codigo_barras: newCode.trim(), 
            nombre: newName.trim(), 
            precio: parseFloat(newPrice),
            precio_mayoreo: newPriceMayoreo ? parseFloat(newPriceMayoreo) : parseFloat(newPrice),
            precio_distribuidor: newPriceDistribuidor ? parseFloat(newPriceDistribuidor) : parseFloat(newPrice),
            grupo_id: selectedGroup ? parseInt(selectedGroup) : null
        }]).select();

        if (prodError) return alert(`Error: ${prodError.message}`);
        const newProdId = prodData[0].id;

        await supabase.from('inventario').insert([
            { producto_id: newProdId, sucursal_id: 1, stock: 0 },
            { producto_id: newProdId, sucursal_id: 2, stock: 0 },
            { producto_id: newProdId, sucursal_id: 3, stock: 0 }
        ]);

        await supabase.from('historial_inventario').insert([{ producto_id: newProdId, sucursal_id: sucursalId, cantidad: 0, tipo_movimiento: 'entrada', motivo: 'Alta catálogo' }]);
        setShowModal(false);
        setNewCode(''); setNewName(''); setNewPrice(''); setNewPriceMayoreo(''); setNewPriceDistribuidor(''); setSelectedGroup('');
        fetchDatos();
    };

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '15px'}}>
            <div style={{display: 'flex', gap: '10px', background: 'var(--bg-panel)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                <button className={`btn-action ${subVista === 'catalogo' ? 'btn-primary' : ''}`} onClick={() => setSubVista('catalogo')}><i className="fa-solid fa-boxes-stacked"></i> {t('catalogo')}</button>
                <button className={`btn-action ${subVista === 'grupos' ? 'btn-primary' : ''}`} onClick={() => setSubVista('grupos')}><i className="fa-solid fa-layer-group"></i> {t('familiasGrupos')}</button>
                <button className={`btn-action ${subVista === 'historial' ? 'btn-primary' : ''}`} onClick={() => setSubVista('historial')}><i className="fa-solid fa-history"></i> {t('kardex')}</button>
            </div>

            {subVista === 'catalogo' && (
                <div className="panel" style={{ overflowX: 'auto' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
                        <h2>{t('inventario')} - {branch.toUpperCase()}</h2>
                        <button className="btn-action btn-primary" onClick={() => setShowModal(true)}>+ {t('nuevoProducto')}</button>
                    </div>
                    <table className="data-table" style={{ minWidth: '950px' }}>
                        <thead><tr><th>{t('codigo')}</th><th>{t('familia')}</th><th>{t('producto')}</th><th>{t('general')}</th><th>{t('mayoreo')}</th><th>{t('distribuidor')}</th><th></th><th>{t('stock')}</th><th>{t('ajustar')}</th></tr></thead>
                        <tbody>
                            {inventario.map(inv => inv.productos && (
                                <tr key={inv.productos.id}>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{inv.productos.codigo_barras}</td>
                                    <td><span style={{fontSize:'0.75rem', background:'var(--bg-dark)', padding:'2px 6px', borderRadius:'4px'}}>{inv.productos.grupos_productos?.nombre || t('suelto')}</span></td>
                                    <td><strong>{inv.productos.nombre}</strong></td>
                                    <td><input id={`precio-${inv.productos.id}`} type="number" defaultValue={inv.productos.precio} style={{width:'65px', background:'var(--bg-dark)', color:'white', border:'1px solid #333', padding:'4px', borderRadius: '4px'}} /></td>
                                    <td><input id={`mayoreo-${inv.productos.id}`} type="number" defaultValue={inv.productos.precio_mayoreo} style={{width:'65px', background:'var(--bg-dark)', color:'white', border:'1px solid #333', padding:'4px', borderRadius: '4px'}} /></td>
                                    <td><input id={`distribuidor-${inv.productos.id}`} type="number" defaultValue={inv.productos.precio_distribuidor} style={{width:'65px', background:'var(--bg-dark)', color:'white', border:'1px solid #333', padding:'4px', borderRadius: '4px'}} /></td>
                                    <td><button onClick={() => handleUpdatePrecios(inv.productos.id)} className="btn-action" style={{background: '#1b5e20', border: '1px solid #2e7d32'}}><i className="fa-solid fa-save"></i></button></td>
                                    <td style={{fontWeight:'bold', color: inv.stock < 5 ? 'var(--primary-red)' : 'var(--success)', textAlign: 'center'}}>{inv.stock}</td>
                                    <td>
                                        <div style={{display:'flex', gap:'5px', justifyContent: 'center'}}>
                                            <input id={`stock-${inv.productos.id}`} type="number" defaultValue={inv.stock} style={{width:'60px', background:'var(--bg-dark)', color:'white', border:'1px solid #333', padding:'4px', borderRadius: '4px'}} />
                                            <button onClick={() => handleUpdateStock(inv.productos.id, `stock-${inv.productos.id}`, inv.stock)} className="btn-action"><i className="fa-solid fa-check"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {subVista === 'grupos' && (
                <div className="panel">
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
                        <h2>{t('familiasAgrupaciones')}</h2>
                        <button className="btn-action btn-primary" onClick={openNewGroupModal}>+ {t('crearFamilia')}</button>
                    </div>
                    
                    <table className="data-table">
                        <thead><tr><th>{t('id')}</th><th>{t('nombreFamilia')}</th><th>{t('accionesFamilia')}</th></tr></thead>
                        <tbody>
                            {grupos.map(g => (
                                <tr key={g.id}>
                                    <td style={{color: 'var(--text-muted)'}}>{g.id}</td>
                                    <td><strong>{g.nombre}</strong></td>
                                    <td>
                                        <div style={{display: 'flex', gap: '10px'}}>
                                            <button className="btn-action" onClick={() => openEditGroupModal(g)} style={{background: 'var(--bg-lighter)', color: 'white', border: '1px solid var(--border-color)'}}>
                                                <i className="fa-solid fa-pen" style={{marginRight:'5px'}}></i> {t('editarIntegrantes')}
                                            </button>
                                            <button className="btn-action" onClick={() => actualizarPrecioGrupo(g.id, g.nombre)} style={{background: '#1b5e20', color: 'white', border: '1px solid #2e7d32'}}>
                                                <i className="fa-solid fa-coins" style={{marginRight:'5px'}}></i>{t('fijarPrecioMasivo')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {grupos.length === 0 && <tr><td colSpan="3" style={{textAlign: 'center', color: 'var(--text-muted)'}}>{t('noFamiliasCreadas')}</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {subVista === 'historial' && (
                <div className="panel">
                    <h2>{t('kardexAuditoria')} ({branch.toUpperCase()})</h2>
                    <table className="data-table">
                        <thead><tr><th>{t('fecha')}</th><th>{t('producto')}</th><th>{t('movimiento')}</th><th>{t('cantidad')}</th><th>{t('motivo')}</th></tr></thead>
                        <tbody>
                            {logs.map((log, idx) => (
                                <tr key={idx}>
                                    <td style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>{new Date(log.fecha).toLocaleString()}</td>
                                    <td><strong>{log.productos?.nombre}</strong></td>
                                    <td><span style={{padding:'4px 8px', borderRadius:'4px', fontSize:'0.75rem', background: log.tipo_movimiento === 'salida' ? '#3a0f0f' : '#0f3a1c'}}>{log.tipo_movimiento.toUpperCase()}</span></td>
                                    <td style={{fontWeight: 'bold', color: log.cantidad >= 0 ? 'var(--success)' : 'var(--primary-red)'}}>{log.cantidad >= 0 ? `+${log.cantidad}` : log.cantidad}</td>
                                    <td style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>{log.motivo}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL PARA CREAR/EDITAR FAMILIA DE PRODUCTOS */}
            {showGroupModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '500px'}}>
                        <h3 style={{marginBottom: '15px'}}><i className="fa-solid fa-layer-group" style={{color: 'var(--accent)'}}></i> {editingGroupId ? t('editarFamilia') : t('nuevaFamilia')}</h3>
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('labelNombreFamilia')}</label>
                        <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={t('ejemploFamilia')} style={{width:'100%', padding:'10px', margin:'5px 0 20px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} />
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('seleccionaProductosFamilia')}</label>
                        <div style={{ maxHeight: '250px', overflowY: 'auto', background: 'var(--bg-dark)', padding: '10px', margin: '5px 0 20px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {inventario.map(inv => {
                                const prod = inv.productos;
                                if (!prod) return null;
                                const isSelected = selectedProductsForGroup.includes(prod.id);
                                return (
                                    <label key={prod.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: isSelected ? '#1b5e2033' : 'var(--bg-panel)', border: isSelected ? '1px solid var(--success)' : '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleProductSelection(prod.id)} style={{ width: '18px', height: '18px' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 'bold' }}>{prod.nombre}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('codigo')}: {prod.codigo_barras}</span>
                                        </div>
                                    </label>
                                )
                            })}
                        </div>

                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1, padding: '12px'}} onClick={guardarFamilia}>{t('guardarFamilia')}</button>
                            <button className="btn-action" style={{flex:1, padding: '12px'}} onClick={() => setShowGroupModal(false)}>{t('cancelar')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE ALTA DE PRODUCTO INDIVIDUAL */}
            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '450px'}}>
                        <h3 style={{marginBottom: '15px'}}><i className="fa-solid fa-box-open" style={{color: 'var(--accent)'}}></i> {t('nuevoArticulo')}</h3>
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('familiaOpcional')}</label>
                        <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{width:'100%', padding:'10px', margin:'5px 0 15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}}>
                            <option value="">{t('sinGrupo')}</option>
                            {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                        </select>
                        <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder={t('codigoBarras')} style={{width:'100%', padding:'10px', margin:'0 0 10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} />
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('nombreArticulo')} style={{width:'100%', padding:'10px', margin:'0 0 15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} />
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('preciosInstruccion')}</label>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', margin: '5px 0 20px'}}>
                            <div><span style={{fontSize: '0.75rem'}}>{t('generalReq')}</span><input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="$" style={{width:'100%', padding:'8px', background:'var(--bg-dark)', color:'white', borderRadius:'6px'}} /></div>
                            <div><span style={{fontSize: '0.75rem'}}>{t('mayoreo')}</span><input type="number" value={newPriceMayoreo} onChange={(e) => setNewPriceMayoreo(e.target.value)} placeholder="$" style={{width:'100%', padding:'8px', background:'var(--bg-dark)', color:'white', borderRadius:'6px'}} /></div>
                            <div><span style={{fontSize: '0.75rem'}}>{t('distribuidor')}</span><input type="number" value={newPriceDistribuidor} onChange={(e) => setNewPriceDistribuidor(e.target.value)} placeholder="$" style={{width:'100%', padding:'8px', background:'var(--bg-dark)', color:'white', borderRadius:'6px'}} /></div>
                        </div>
                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1, padding: '12px'}} onClick={guardarProductoIndividual}>{t('guardarArticulo')}</button>
                            <button className="btn-action" style={{flex:1, padding: '12px'}} onClick={() => setShowModal(false)}>{t('cancelar')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}