'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Inventario({ branch = 'napoles' }) {
    const { t } = useLanguage(); 
    
    // Vistas: 'catalogo', 'grupos', 'historial', 'global'
    const [subVista, setSubVista] = useState('catalogo'); 
    
    const [inventario, setInventario] = useState([]);
    const [inventarioGlobal, setInventarioGlobal] = useState([]);
    const [logs, setLogs] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    // Estados para el Modal de Producto
    const [editingProductId, setEditingProductId] = useState(null);
    const [newTipo, setNewTipo] = useState('producto'); 
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newPriceMayoreo, setNewPriceMayoreo] = useState('');
    const [newPriceDistribuidor, setNewPriceDistribuidor] = useState('');
    const [newPriceMedico, setNewPriceMedico] = useState(''); 
    const [selectedGroup, setSelectedGroup] = useState('');

    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [selectedProductsForGroup, setSelectedProductsForGroup] = useState([]);

    // ESTADOS PARA TRANSFERENCIA
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferData, setTransferData] = useState({ id: null, nombre: '', maxStock: 0 });
    const [transferDestino, setTransferDestino] = useState('');
    const [transferQty, setTransferQty] = useState('');
    const [transferMotivo, setTransferMotivo] = useState('');
    
    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const fetchDatos = async () => {
        const { data: gData } = await supabase.from('grupos_productos').select('*').order('nombre');
        if (gData) setGrupos(gData);

        if (subVista === 'catalogo' || subVista === 'grupos') {
            const { data } = await supabase
                .from('inventario')
                .select('stock, productos(id, codigo_barras, nombre, precio, precio_mayoreo, precio_distribuidor, precio_medico, grupo_id, tipo, activo, grupos_productos(nombre))')
                .eq('sucursal_id', sucursalId);
            
            if (data) {
                const activos = data.filter(inv => inv.productos && inv.productos.activo !== false);
                setInventario(activos.sort((a,b) => a.productos.nombre.localeCompare(b.productos.nombre)));
            }
        }
        
        if (subVista === 'historial') {
            const { data } = await supabase
                .from('historial_inventario')
                .select('cantidad, tipo_movimiento, motivo, fecha, productos(nombre)')
                .eq('sucursal_id', sucursalId)
                .order('fecha', { ascending: false });
            if (data) setLogs(data);
        }

        if (subVista === 'global') {
            // Obtenemos TODO el inventario de todas las sucursales para pivotarlo
            const { data } = await supabase
                .from('inventario')
                .select('stock, sucursal_id, productos(id, codigo_barras, nombre, tipo, activo, grupos_productos(nombre))');
            
            if (data) {
                const activos = data.filter(inv => inv.productos && inv.productos.activo !== false);
                const agrupado = {};
                
                activos.forEach(inv => {
                    const p = inv.productos;
                    if (!agrupado[p.id]) {
                        agrupado[p.id] = {
                            id: p.id, code: p.codigo_barras, name: p.nombre, tipo: p.tipo, familia: p.grupos_productos?.nombre || t('suelto'),
                            napoles: 0, obrera: 0, pedregal: 0, total: 0
                        };
                    }
                    if (inv.sucursal_id === 1) agrupado[p.id].napoles += inv.stock;
                    if (inv.sucursal_id === 2) agrupado[p.id].obrera += inv.stock;
                    if (inv.sucursal_id === 3) agrupado[p.id].pedregal += inv.stock;
                    
                    if (p.tipo !== 'servicio') {
                        agrupado[p.id].total += inv.stock;
                    }
                });
                
                setInventarioGlobal(Object.values(agrupado).sort((a,b) => a.name.localeCompare(b.name)));
            }
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
        const valMed = document.getElementById(`medico-${producto_id}`).value; 
        
        if (!valGen || !valMay || !valDist || !valMed) return alert(t('preciosInvalidos'));

        const { error } = await supabase.from('productos').update({ 
            precio: parseFloat(valGen), 
            precio_mayoreo: parseFloat(valMay), 
            precio_distribuidor: parseFloat(valDist),
            precio_medico: parseFloat(valMed) 
        }).eq('id', producto_id);
        
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
            precio_distribuidor: parseFloat(nuevoPrecio),
            precio_medico: parseFloat(nuevoPrecio) 
        }).eq('grupo_id', grupo_id);

        if (error) return alert(`Error: ${error.message}`);
        alert(t('preciosMasivosAplicados'));
        fetchDatos();
    };

    const openNewArticleModal = () => {
        setEditingProductId(null);
        setNewTipo('producto');
        setNewCode(''); setNewName(''); setNewPrice(''); setNewPriceMayoreo(''); setNewPriceDistribuidor(''); setNewPriceMedico(''); setSelectedGroup('');
        setShowModal(true);
    };

    const openEditArticleModal = (inv) => {
        const p = inv.productos;
        setEditingProductId(p.id);
        setNewTipo(p.tipo || 'producto');
        setNewCode(p.codigo_barras || '');
        setNewName(p.nombre);
        setNewPrice(p.precio);
        setNewPriceMayoreo(p.precio_mayoreo);
        setNewPriceDistribuidor(p.precio_distribuidor);
        setNewPriceMedico(p.precio_medico);
        setSelectedGroup(p.grupo_id || '');
        setShowModal(true);
    };

    const eliminarArticulo = async (producto_id) => {
        if (!window.confirm(t('confirmarEliminarProducto'))) return;
        
        const { error } = await supabase.from('productos').update({ activo: false }).eq('id', producto_id);
        if (error) alert(`Error: ${error.message}`);
        else {
            alert(t('productoEliminadoExito'));
            fetchDatos();
        }
    };

    const guardarProductoIndividual = async () => {
        if (!newName || !newPrice) return alert(t('faltanCampos'));
        
        const payload = {
            codigo_barras: newCode.trim() || `GEN-${Date.now()}`, 
            nombre: newName.trim(), 
            tipo: newTipo,
            precio: parseFloat(newPrice),
            precio_mayoreo: newPriceMayoreo ? parseFloat(newPriceMayoreo) : parseFloat(newPrice),
            precio_distribuidor: newPriceDistribuidor ? parseFloat(newPriceDistribuidor) : parseFloat(newPrice),
            precio_medico: newPriceMedico ? parseFloat(newPriceMedico) : parseFloat(newPrice),
            grupo_id: selectedGroup ? parseInt(selectedGroup) : null,
            activo: true
        };

        if (editingProductId) {
            const { error } = await supabase.from('productos').update(payload).eq('id', editingProductId);
            if (error) return alert(`Error: ${error.message}`);
            alert(t('productoActualizadoExito'));
        } else {
            const { data: prodData, error: prodError } = await supabase.from('productos').insert([payload]).select();
            if (prodError) return alert(`Error: ${prodError.message}`);
            
            const newProdId = prodData[0].id;
            
            await supabase.from('inventario').insert([
                { producto_id: newProdId, sucursal_id: 1, stock: 0 },
                { producto_id: newProdId, sucursal_id: 2, stock: 0 },
                { producto_id: newProdId, sucursal_id: 3, stock: 0 }
            ]);

            await supabase.from('historial_inventario').insert([{ producto_id: newProdId, sucursal_id: sucursalId, cantidad: 0, tipo_movimiento: 'entrada', motivo: 'Alta catálogo' }]);
        }

        setShowModal(false);
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
        const prodsEnGrupo = inventario.filter(inv => inv.productos && inv.productos.grupo_id === grupo.id).map(inv => inv.productos.id);
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

    // LÓGICA DE TRANSFERENCIA
    const openTransferModal = (inv) => {
        setTransferData({ id: inv.productos.id, nombre: inv.productos.nombre, maxStock: inv.stock });
        setTransferDestino('');
        setTransferQty('');
        setTransferMotivo('');
        setShowTransferModal(true);
    };

    const ejecutarTransferencia = async () => {
        if (!transferDestino) return alert(t('seleccionaDestino'));
        const qty = parseInt(transferQty);
        if (!qty || qty <= 0 || qty > transferData.maxStock) return alert(t('cantidadInvalida'));

        const destinoId = parseInt(transferDestino);
        
        const { error } = await supabase.rpc('transferir_inventario', {
            p_producto_id: transferData.id,
            p_origen_id: sucursalId,
            p_destino_id: destinoId,
            p_cantidad: qty,
            p_motivo_base: transferMotivo.trim()
        });

        if (error) alert(`${t('errorTransferencia')}${error.message}`);
        else {
            alert(t('transferenciaExitosa'));
            setShowTransferModal(false);
            fetchDatos();
        }
    };

    // LÓGICA DE EXPORTACIÓN KARDEX
    const exportKardexToCSV = () => {
        if (logs.length === 0) return alert(t('noDatosExportar'));
        const headers = [t('fecha'), t('producto'), t('movimiento'), t('cantidad'), t('motivo')];
        const rows = logs.map(l => [
            new Date(l.fecha).toLocaleString(),
            `"${l.productos?.nombre}"`,
            l.tipo_movimiento.toUpperCase(),
            l.cantidad,
            `"${l.motivo}"`
        ]);
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `Kardex_${branch}_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const triggerPDFPrint = () => { window.print(); };

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '15px'}}>
            <div style={{display: 'flex', gap: '10px', background: 'var(--bg-panel)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                <button className={`btn-action ${subVista === 'catalogo' ? 'btn-primary' : ''}`} onClick={() => setSubVista('catalogo')}><i className="fa-solid fa-boxes-stacked"></i> {t('catalogo')}</button>
                <button className={`btn-action ${subVista === 'global' ? 'btn-primary' : ''}`} onClick={() => setSubVista('global')}><i className="fa-solid fa-earth-americas"></i> {t('inventarioGlobal')}</button>
                <button className={`btn-action ${subVista === 'grupos' ? 'btn-primary' : ''}`} onClick={() => setSubVista('grupos')}><i className="fa-solid fa-layer-group"></i> {t('familiasGrupos')}</button>
                <button className={`btn-action ${subVista === 'historial' ? 'btn-primary' : ''}`} onClick={() => setSubVista('historial')}><i className="fa-solid fa-history"></i> {t('kardex')}</button>
            </div>

            {subVista === 'catalogo' && (
                <div className="panel" style={{ overflowX: 'auto' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
                        <h2>{t('inventario')} - {branch.toUpperCase()}</h2>
                        <button className="btn-action btn-primary" onClick={openNewArticleModal}>+ {t('nuevoProducto')}</button>
                    </div>
                    <table className="data-table" style={{ minWidth: '1200px' }}>
                        <thead><tr><th>{t('codigo')}</th><th>{t('familia')}</th><th>{t('producto')}</th><th>{t('general')}</th><th>{t('mayoreo')}</th><th>{t('distribuidor')}</th><th>{t('precioMedico')}</th><th></th><th>{t('stock')}</th><th>{t('ajustar')}</th><th style={{textAlign: 'center'}}><i className="fa-solid fa-gear"></i></th></tr></thead>
                        <tbody>
                            {inventario.map(inv => inv.productos && (
                                <tr key={inv.productos.id}>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{inv.productos.codigo_barras || 'N/A'}</td>
                                    <td><span style={{fontSize:'0.75rem', background:'var(--bg-dark)', padding:'2px 6px', borderRadius:'4px'}}>{inv.productos.grupos_productos?.nombre || t('suelto')}</span></td>
                                    <td>
                                        <strong>{inv.productos.nombre}</strong>
                                        {inv.productos.tipo === 'servicio' && <span style={{display: 'block', fontSize: '0.7rem', color: '#00b0ff'}}><i className="fa-solid fa-hand-sparkles"></i> Servicio Infinito</span>}
                                    </td>
                                    <td><input id={`precio-${inv.productos.id}`} type="number" defaultValue={inv.productos.precio} style={{width:'65px', background:'var(--bg-dark)', color:'white', border:'1px solid #333', padding:'4px', borderRadius: '4px'}} /></td>
                                    <td><input id={`mayoreo-${inv.productos.id}`} type="number" defaultValue={inv.productos.precio_mayoreo} style={{width:'65px', background:'var(--bg-dark)', color:'white', border:'1px solid #333', padding:'4px', borderRadius: '4px'}} /></td>
                                    <td><input id={`distribuidor-${inv.productos.id}`} type="number" defaultValue={inv.productos.precio_distribuidor} style={{width:'65px', background:'var(--bg-dark)', color:'white', border:'1px solid #333', padding:'4px', borderRadius: '4px'}} /></td>
                                    <td><input id={`medico-${inv.productos.id}`} type="number" defaultValue={inv.productos.precio_medico} style={{width:'65px', background:'var(--bg-dark)', color:'white', border:'1px solid #333', padding:'4px', borderRadius: '4px', borderLeft:'2px solid var(--accent)'}} /></td>
                                    <td><button onClick={() => handleUpdatePrecios(inv.productos.id)} className="btn-action" style={{background: '#1b5e20', border: '1px solid #2e7d32'}}><i className="fa-solid fa-save"></i></button></td>
                                    
                                    <td style={{fontWeight:'bold', color: inv.productos.tipo === 'servicio' ? '#00b0ff' : (inv.stock < 5 ? 'var(--primary-red)' : 'var(--success)'), textAlign: 'center', fontSize: inv.productos.tipo === 'servicio' ? '1.5rem' : '1rem'}}>
                                        {inv.productos.tipo === 'servicio' ? '∞' : inv.stock}
                                    </td>
                                    <td>
                                        {inv.productos.tipo === 'servicio' ? (
                                            <div style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem'}}>{t('infinito')}</div>
                                        ) : (
                                            <div style={{display:'flex', gap:'5px', justifyContent: 'center'}}>
                                                <input id={`stock-${inv.productos.id}`} type="number" defaultValue={inv.stock} style={{width:'60px', background:'var(--bg-dark)', color:'white', border:'1px solid #333', padding:'4px', borderRadius: '4px'}} />
                                                <button onClick={() => handleUpdateStock(inv.productos.id, `stock-${inv.productos.id}`, inv.stock)} className="btn-action"><i className="fa-solid fa-check"></i></button>
                                            </div>
                                        )}
                                    </td>

                                    <td>
                                        <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                                            {/* BOTÓN DE TRANSFERENCIA (Solo físico) */}
                                            {inv.productos.tipo !== 'servicio' && (
                                                <button onClick={() => openTransferModal(inv)} className="btn-action" style={{background: '#0d47a1', color: 'white', border: '1px solid #1565c0', padding: '5px 8px'}} title={t('transferir')}>
                                                    <i className="fa-solid fa-truck-fast"></i>
                                                </button>
                                            )}
                                            <button onClick={() => openEditArticleModal(inv)} className="btn-action" style={{background: 'var(--bg-lighter)', color: 'white', border: '1px solid var(--border-color)', padding: '5px 8px'}} title={t('editar')}>
                                                <i className="fa-solid fa-pen"></i>
                                            </button>
                                            <button onClick={() => eliminarArticulo(inv.productos.id)} className="btn-action" style={{background: 'transparent', color: 'var(--primary-red)', border: '1px solid var(--primary-red)', padding: '5px 8px'}} title={t('eliminar')}>
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {subVista === 'global' && (
                <div className="panel" style={{ overflowX: 'auto' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
                        <h2><i className="fa-solid fa-earth-americas"></i> {t('inventarioGlobal')}</h2>
                    </div>
                    <table className="data-table" style={{ minWidth: '900px' }}>
                        <thead>
                            <tr>
                                <th>{t('codigo')}</th>
                                <th>{t('familia')}</th>
                                <th>{t('producto')}</th>
                                <th style={{textAlign:'center', background:'rgba(198, 40, 40, 0.1)', color:'var(--primary-red)'}}>Nápoles</th>
                                <th style={{textAlign:'center', background:'rgba(198, 40, 40, 0.1)', color:'var(--primary-red)'}}>Obrera</th>
                                <th style={{textAlign:'center', background:'rgba(198, 40, 40, 0.1)', color:'var(--primary-red)'}}>Pedregal</th>
                                <th style={{textAlign:'center', background:'#1b5e2033', color:'var(--success)'}}>{t('totalGlobal')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inventarioGlobal.map(inv => (
                                <tr key={inv.id}>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{inv.code || 'N/A'}</td>
                                    <td><span style={{fontSize:'0.75rem', background:'var(--bg-dark)', padding:'2px 6px', borderRadius:'4px'}}>{inv.familia}</span></td>
                                    <td>
                                        <strong>{inv.name}</strong>
                                        {inv.tipo === 'servicio' && <span style={{display: 'block', fontSize: '0.7rem', color: '#00b0ff'}}><i className="fa-solid fa-hand-sparkles"></i> Servicio</span>}
                                    </td>
                                    
                                    {inv.tipo === 'servicio' ? (
                                        <>
                                            <td style={{textAlign: 'center', color: '#00b0ff', fontSize: '1.2rem'}}>∞</td>
                                            <td style={{textAlign: 'center', color: '#00b0ff', fontSize: '1.2rem'}}>∞</td>
                                            <td style={{textAlign: 'center', color: '#00b0ff', fontSize: '1.2rem'}}>∞</td>
                                            <td style={{textAlign: 'center', color: '#00b0ff', fontSize: '1.2rem', fontWeight: 'bold'}}>∞</td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={{textAlign: 'center', fontWeight: 'bold', color: inv.napoles === 0 ? 'var(--primary-red)' : 'white'}}>{inv.napoles}</td>
                                            <td style={{textAlign: 'center', fontWeight: 'bold', color: inv.obrera === 0 ? 'var(--primary-red)' : 'white'}}>{inv.obrera}</td>
                                            <td style={{textAlign: 'center', fontWeight: 'bold', color: inv.pedregal === 0 ? 'var(--primary-red)' : 'white'}}>{inv.pedregal}</td>
                                            <td style={{textAlign: 'center', fontWeight: 'bold', color: 'var(--success)'}}>{inv.total}</td>
                                        </>
                                    )}
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
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
                        <h2>{t('kardexAuditoria')} ({branch.toUpperCase()})</h2>
                        <div style={{display: 'flex', gap: '10px'}}>
                            <button className="btn-action" onClick={exportKardexToCSV} style={{background: '#1e3d26', border: '1px solid #2e7d32'}}><i className="fa-solid fa-file-excel" style={{color: 'var(--success)', marginRight: '8px'}}></i> {t('exportarKardex')}</button>
                            <button className="btn-action" onClick={triggerPDFPrint} style={{background: '#3d1e1e', border: '1px solid var(--primary-red)'}}><i className="fa-solid fa-file-pdf" style={{color: 'var(--accent)', marginRight: '8px'}}></i> {t('imprimirPdf')}</button>
                        </div>
                    </div>
                    
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

            {/* MODAL TRANSFERENCIAS */}
            {showTransferModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '450px'}}>
                        <h3 style={{marginBottom: '15px'}}><i className="fa-solid fa-truck-fast" style={{color: 'var(--accent)'}}></i> {t('transferenciaInventario')}</h3>
                        
                        <p style={{color: 'var(--text-muted)', marginBottom: '20px'}}>Enviando: <strong>{transferData.nombre}</strong> <br/> Disponible en {branch}: <span style={{color: 'var(--success)'}}>{transferData.maxStock} uds.</span></p>

                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('sucursalDestino')}</label>
                        <select value={transferDestino} onChange={(e) => setTransferDestino(e.target.value)} style={{width:'100%', padding:'10px', margin:'5px 0 15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}}>
                            <option value="">{t('seleccionaDestino')}</option>
                            {branch !== 'napoles' && <option value="1">Nápoles</option>}
                            {branch !== 'obrera' && <option value="2">Obrera</option>}
                            {branch !== 'pedregal' && <option value="3">Pedregal</option>}
                        </select>

                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('cantidadTransferir')}</label>
                        <input type="number" max={transferData.maxStock} min="1" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} placeholder="0" style={{width:'100%', padding:'10px', margin:'5px 0 15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} />

                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('motivoOpcional')}</label>
                        <input type="text" value={transferMotivo} onChange={(e) => setTransferMotivo(e.target.value)} placeholder="Ej. Faltante para evento" style={{width:'100%', padding:'10px', margin:'5px 0 20px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} />

                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1, padding: '12px'}} onClick={ejecutarTransferencia}>{t('confirmarTransferencia')}</button>
                            <button className="btn-action" style={{flex:1, padding: '12px'}} onClick={() => setShowTransferModal(false)}>{t('cancelar')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DEMÁS MODALES (Se mantienen igual a tu última versión) */}
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

            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '550px'}}>
                        <h3 style={{marginBottom: '15px'}}><i className="fa-solid fa-box-open" style={{color: 'var(--accent)'}}></i> {editingProductId ? t('editarArticulo') : t('nuevoArticulo')}</h3>
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('tipoArticulo')}</label>
                        <select value={newTipo} onChange={(e) => setNewTipo(e.target.value)} style={{width:'100%', padding:'10px', margin:'5px 0 15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--accent)', borderRadius:'6px'}}>
                            <option value="producto">{t('productoFisico')}</option>
                            <option value="servicio">{t('servicioInfinito')}</option>
                        </select>

                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('familiaOpcional')}</label>
                        <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{width:'100%', padding:'10px', margin:'5px 0 15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}}>
                            <option value="">{t('sinGrupo')}</option>
                            {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                        </select>
                        <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder={t('codigoBarras')} style={{width:'100%', padding:'10px', margin:'0 0 10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} />
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('nombreArticulo')} style={{width:'100%', padding:'10px', margin:'0 0 15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} />
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('preciosInstruccion')}</label>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', margin: '5px 0 20px'}}>
                            <div><span style={{fontSize: '0.75rem'}}>{t('generalReq')}</span><input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="$" style={{width:'100%', padding:'8px', background:'var(--bg-dark)', color:'white', borderRadius:'6px'}} /></div>
                            <div><span style={{fontSize: '0.75rem'}}>{t('mayoreo')}</span><input type="number" value={newPriceMayoreo} onChange={(e) => setNewPriceMayoreo(e.target.value)} placeholder="$" style={{width:'100%', padding:'8px', background:'var(--bg-dark)', color:'white', borderRadius:'6px'}} /></div>
                            <div><span style={{fontSize: '0.75rem'}}>{t('distribuidor')}</span><input type="number" value={newPriceDistribuidor} onChange={(e) => setNewPriceDistribuidor(e.target.value)} placeholder="$" style={{width:'100%', padding:'8px', background:'var(--bg-dark)', color:'white', borderRadius:'6px'}} /></div>
                            <div><span style={{fontSize: '0.75rem', color:'var(--accent)'}}>{t('precioMedico')}</span><input type="number" value={newPriceMedico} onChange={(e) => setNewPriceMedico(e.target.value)} placeholder="$" style={{width:'100%', padding:'8px', background:'var(--bg-dark)', color:'white', borderRadius:'6px', border: '1px solid var(--accent)'}} /></div>
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