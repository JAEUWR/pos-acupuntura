'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Ventas({ branch = 'napoles' }) {
    const [barcode, setBarcode] = useState('');
    const [cart, setCart] = useState([]);
    const [productosDB, setProductosDB] = useState([]);
    const [clientesDB, setClientesDB] = useState([]);
    const [promocionesDB, setPromocionesDB] = useState([]);
    const [selectedClient, setSelectedClient] = useState('');
    
    // Estados para Modales
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    const fetchDatos = async () => {
        const { data: prods } = await supabase.from('productos').select('*');
        if (prods) setProductosDB(prods);

        const { data: clis } = await supabase.from('clientes').select('*').order('nombre', { ascending: true });
        if (clis) setClientesDB(clis);

        const { data: promos } = await supabase.from('promociones').select('*');
        if (promos) setPromocionesDB(promos);
    };

    useEffect(() => { fetchDatos(); }, []);

    const branchIdMap = { napoles: 1, roma: 2, centro: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const handleSearch = () => {
        const product = productosDB.find(p => p.codigo_barras === barcode.trim());
        if (product) { addToCart(product); setBarcode(''); } 
        else alert('Producto no encontrado.');
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            return [...prev, { 
                id: product.id, code: product.codigo_barras, name: product.nombre, qty: 1, 
                tipo_precio: 'general', precio_aplicado: product.precio,
                opciones_precio: { general: product.precio, mayoreo: product.precio_mayoreo, distribuidor: product.precio_distribuidor }
            }];
        });
    };

    const updatePriceType = (id, tipo) => setCart(prev => prev.map(item => item.id === id ? { ...item, tipo_precio: tipo, precio_aplicado: item.opciones_precio[tipo] } : item));
    const updateQty = (id, delta) => setCart(prev => prev.map(item => item.id === id && (item.qty + delta > 0) ? { ...item, qty: item.qty + delta } : item));
    const removeItem = (id) => setCart(prev => prev.filter(item => item.id !== id));

    const guardarClienteExpres = async () => {
        if (!newClientName) return alert('El nombre es obligatorio');
        const { data, error } = await supabase.from('clientes').insert([{ nombre: newClientName, telefono: newClientPhone }]).select();
        
        if (error) return alert('Error al guardar: ' + error.message);
        
        setClientesDB([...clientesDB, data[0]].sort((a,b) => a.nombre.localeCompare(b.nombre)));
        setSelectedClient(data[0].id); 
        setShowNewClientModal(false);
        setNewClientName(''); setNewClientPhone('');
    };

    // Evaluación matemática de promociones vigentes al vuelo
    let subtotalBruto = 0;
    let totalDescuentos = 0;
    const hoy = new Date();

    const cartRender = cart.map(item => {
        let descuentoRow = 0;
        let msjPromo = null;
        
        const promo = promocionesDB.find(p => p.producto_id === item.id && p.activa && hoy >= new Date(p.fecha_inicio) && hoy <= new Date(p.fecha_fin));

        if (promo && item.tipo_precio === 'general') {
            if (promo.tipo_descuento === 'porcentaje') {
                descuentoRow = (item.precio_aplicado * (promo.valor / 100)) * item.qty;
                msjPromo = `-${promo.valor}% Off`;
            } else if (promo.tipo_descuento === 'precio_fijo') {
                descuentoRow = Math.max(0, (item.precio_aplicado - promo.valor) * item.qty);
                msjPromo = `Precio Especial`;
            } else if (promo.tipo_descuento === 'volumen' && promo.cantidad_requerida > 0) {
                if (item.qty >= promo.cantidad_requerida) {
                    const paquetes = Math.floor(item.qty / promo.cantidad_requerida);
                    descuentoRow = (paquetes * promo.cantidad_regalo) * item.precio_aplicado;
                    msjPromo = `${promo.cantidad_requerida}x${promo.cantidad_requerida - promo.cantidad_regalo}`;
                }
            }
        }

        const importeOriginal = item.precio_aplicado * item.qty;
        subtotalBruto += importeOriginal;
        totalDescuentos += descuentoRow;

        return { ...item, descuentoRow, importeNeto: importeOriginal - descuentoRow, msjPromo };
    });

    const totalCobrar = subtotalBruto - totalDescuentos;

    const handleCheckout = async () => {
        if (cartRender.length === 0) return alert('Carrito vacío.');
        const btn = document.getElementById('btn-cobrar');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESANDO...';
        btn.disabled = true;

        const payloadItems = cartRender.map(item => ({
            producto_id: item.id, qty: item.qty, tipo_precio: item.tipo_precio,
            precio: item.qty > 0 ? (item.importeNeto / item.qty).toFixed(2) : item.precio_aplicado 
        }));

        const clienteIdFinal = selectedClient ? parseInt(selectedClient) : null;
        const { error } = await supabase.rpc('procesar_venta', { p_sucursal_id: sucursalId, p_cliente_id: clienteIdFinal, p_total: totalCobrar, p_items: payloadItems });

        if (error) alert('Error al cobrar: ' + error.message);
        else { alert('¡Venta procesada y stock descontado!'); setCart([]); setSelectedClient(''); }
        
        btn.innerHTML = '<i class="fa-solid fa-cash-register"></i> COBRAR';
        btn.disabled = false;
    };

    const filteredCatalog = productosDB.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.codigo_barras.includes(searchTerm));

    return (
        <div className="view-section active">
            <div className="register-section">
                <div className="search-bar">
                    <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Código de Barras..." style={{flex:1, padding:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '8px'}} />
                    <button className="btn-action btn-primary" onClick={handleSearch}><i className="fa-solid fa-magnifying-glass"></i> BUSCAR</button>
                </div>
                
                <div className="cart-table-container">
                    <table className="data-table">
                        <thead><tr><th>Producto</th><th>Tipo Precio</th><th>Unitario</th><th>Cant.</th><th>Importe Neto</th><th></th></tr></thead>
                        <tbody>
                            {cartRender.length === 0 ? <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>Carrito vacío.</td></tr> : 
                                cartRender.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <strong>{item.name}</strong><br/>
                                            {item.msjPromo && <span style={{fontSize:'0.75rem', background:'var(--accent)', color:'white', padding:'2px 6px', borderRadius:'4px'}}><i className="fa-solid fa-tag"></i> {item.msjPromo}</span>}
                                        </td>
                                        <td>
                                            <select value={item.tipo_precio} onChange={(e) => updatePriceType(item.id, e.target.value)} style={{background:'var(--bg-dark)', color:'white', padding:'5px', borderRadius: '4px'}}>
                                                <option value="general">General</option><option value="mayoreo">Mayoreo</option><option value="distribuidor">Distribuidor</option>
                                            </select>
                                        </td>
                                        <td>${item.precio_aplicado.toFixed(2)}</td>
                                        <td>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-panel)', padding: '4px', borderRadius: '4px', width: 'max-content'}}>
                                                <button onClick={() => updateQty(item.id, -1)} style={{background: 'var(--bg-lighter)', color: 'white', border: 'none', width: '24px', height: '24px', cursor:'pointer'}}>-</button>
                                                <span>{item.qty}</span>
                                                <button onClick={() => updateQty(item.id, 1)} style={{background: 'var(--bg-lighter)', color: 'white', border: 'none', width: '24px', height: '24px', cursor:'pointer'}}>+</button>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{fontWeight:'bold', color: item.descuentoRow > 0 ? 'var(--success)' : 'white'}}>${item.importeNeto.toFixed(2)}</div>
                                            {item.descuentoRow > 0 && <div style={{fontSize:'0.8rem', color:'var(--accent)', textDecoration:'line-through'}}>${(item.precio_aplicado * item.qty).toFixed(2)}</div>}
                                        </td>
                                        <td style={{textAlign: 'right'}}><button onClick={() => removeItem(item.id)} style={{background: 'transparent', color: 'var(--primary-red)', border: 'none', cursor: 'pointer', fontSize: '1.2rem'}}><i className="fa-solid fa-trash-can"></i></button></td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="checkout-section">
                <div className="quick-products">
                    <h3 style={{marginBottom:'10px'}}><i className="fa-solid fa-bolt" style={{color:'var(--accent)'}}></i> Añadir Rápido</h3>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px'}}>
                        {productosDB.slice(0, 4).map((prod) => (
                            <div key={prod.id} onClick={() => addToCart(prod)} className="product-card" style={{background:'var(--bg-dark)', padding:'10px', borderRadius:'8px', textAlign:'center', cursor:'pointer', border:'1px solid var(--border-color)'}}>
                                <span style={{fontSize:'0.8rem', display:'block'}}>{prod.nombre}</span>
                                <span style={{color:'var(--success)', fontWeight:'bold'}}>${prod.precio.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <button className="btn-action" onClick={() => setShowCatalogModal(true)} style={{width: '100%', marginTop: '15px', padding: '12px', background: 'var(--bg-lighter)', border: '1px solid var(--border-color)', color: 'white'}}>
                        <i className="fa-solid fa-list" style={{marginRight: '8px'}}></i> Ver Catálogo Completo
                    </button>
                </div>
                
                <div className="totals-box">
                    <div style={{display:'flex', justifycontent:'space-between', color:'var(--text-muted)', marginBottom:'5px'}}><span>Subtotal:</span><span>${subtotalBruto.toFixed(2)}</span></div>
                    <div style={{display:'flex', justifycontent:'space-between', color:'var(--accent)', marginBottom:'10px'}}><span>Descuentos:</span><span>-${totalDescuentos.toFixed(2)}</span></div>
                    
                    {/* SECCIÓN CORREGIDA: SELECTOR FLEX MÁS BOTÓN EXPRÉS */}
                    <div style={{marginBottom: '15px', borderTop: '1px dashed var(--border-color)', paddingTop: '15px'}}>
                        <label style={{display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '5px'}}>Asignar Paciente:</label>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} style={{flex: 1, padding: '10px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                                <option value="">-- Público General --</option>
                                {clientesDB.map(cli => <option key={cli.id} value={cli.id}>{cli.nombre}</option>)}
                            </select>
                            <button className="btn-action" onClick={() => setShowNewClientModal(true)} title="Registrar Paciente Nuevo" style={{padding: '10px 14px', background: 'var(--bg-lighter)', border: '1px solid var(--border-color)', color: 'white', cursor: 'pointer'}}>
                                <i className="fa-solid fa-user-plus"></i>
                            </button>
                        </div>
                    </div>

                    <div className="totals-row grand-total"><span>TOTAL:</span><span style={{color: 'var(--success)'}}>${totalCobrar.toFixed(2)}</span></div>
                    <button id="btn-cobrar" onClick={handleCheckout} className="pay-btn" style={{width:'100%', padding:'20px', background:'var(--primary-red)', color:'white', border:'none', borderRadius:'8px', fontSize:'1.3rem', fontWeight:'bold', cursor:'pointer'}}>COBRAR</button>
                </div>
            </div>

            {/* MODAL DEL CATÁLOGO COMPLETO */}
            {showCatalogModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                            <h3><i className="fa-solid fa-book-open" style={{color: 'var(--accent)', marginRight: '10px'}}></i> Catálogo de Productos</h3>
                            <button onClick={() => setShowCatalogModal(false)} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer'}}>&times;</button>
                        </div>
                        <input type="text" placeholder="🔍 Buscar por nombre o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{width:'100%', padding:'12px', marginBottom:'20px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <div style={{overflowY: 'auto', flex: 1, border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                            <table className="data-table">
                                <thead><tr><th>Código</th><th>Nombre</th><th>Precio</th><th></th></tr></thead>
                                <tbody>
                                    {filteredCatalog.map(p => (
                                        <tr key={p.id}>
                                            <td style={{color: 'var(--text-muted)'}}>{p.codigo_barras}</td>
                                            <td><strong>{p.nombre}</strong></td>
                                            <td style={{color: 'var(--success)'}}>${p.precio.toFixed(2)}</td>
                                            <td style={{textAlign: 'right'}}><button className="btn-action btn-primary" onClick={() => { addToCart(p); setShowCatalogModal(false); setSearchTerm(''); }} style={{padding: '6px 12px', fontSize: '0.9rem'}}>Agregar</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE ALTA EXPRÉS COMPORTAMIENTO RESTAURADO */}
            {showNewClientModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '400px'}}>
                        <h3 style={{marginBottom: '20px'}}><i className="fa-solid fa-user-plus"></i> Registrar Paciente Rápido</h3>
                        <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nombre Completo" style={{width:'100%', padding:'10px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <input type="text" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="Teléfono" style={{width:'100%', padding:'10px', marginBottom:'20px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1, padding: '12px'}} onClick={guardarClienteExpres}>Guardar y Seleccionar</button>
                            <button className="btn-action" style={{flex:1, padding: '12px'}} onClick={() => setShowNewClientModal(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}