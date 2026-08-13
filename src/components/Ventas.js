'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Ventas({ branch = 'napoles' }) {
    const { t } = useLanguage();

    const [barcode, setBarcode] = useState('');
    const [cart, setCart] = useState([]);
    const [productosDB, setProductosDB] = useState([]);
    const [clientesDB, setClientesDB] = useState([]);
    const [promocionesDB, setPromocionesDB] = useState([]);
    
    // Estado del cliente (Inicia vacío para obligar a seleccionar)
    const [selectedClient, setSelectedClient] = useState('');
    const [metodoPago, setMetodoPago] = useState('efectivo');
    const [montoRecibido, setMontoRecibido] = useState('');
    
    const scannerInputRef = useRef(null);

    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    // Estados para el nuevo Menú Desplegable Inteligente de Clientes
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');

    const fetchDatos = async () => {
        // FILTRO APLICADO: Solo traer los productos que están activos
        const { data: prods } = await supabase.from('productos').select('*').eq('activo', true);
        if (prods) setProductosDB(prods);

        const { data: clis } = await supabase.from('clientes').select('*').order('nombre', { ascending: true });
        if (clis) setClientesDB(clis);

        const { data: promos } = await supabase.from('promociones').select('*');
        if (promos) setPromocionesDB(promos);
    };

    useEffect(() => {
        fetchDatos();
        scannerInputRef.current?.focus();
    }, []);

    // 🚀 ESCÁNER UNIVERSAL (MODO FANTASMA)
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const activeElement = document.activeElement;
            const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');
            
            // Si el recepcionista no está escribiendo en ningún input y presiona una tecla válida (como el escáner)
            if (!isInputFocused && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                // Enfocamos el input del escáner en milisegundos para atrapar el código
                scannerInputRef.current?.focus();
            }
        };
        
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const handleSearch = () => {
        const targetCode = barcode.trim();
        if (!targetCode) return;

        const product = productosDB.find(p => p.codigo_barras === targetCode);
        if (product) { addToCart(product); setBarcode(''); } 
        else {
            alert(`Código "${targetCode}" no registrado.`);
            setBarcode(''); scannerInputRef.current?.focus();
        }
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            return [...prev, { 
                id: product.id, code: product.codigo_barras, name: product.nombre, 
                grupo_id: product.grupo_id,
                qty: 1, tipo_precio: 'general', precio_aplicado: product.precio,
                opciones_precio: { 
                    general: product.precio, 
                    mayoreo: product.precio_mayoreo, 
                    distribuidor: product.precio_distribuidor,
                    medico: product.precio_medico 
                }
            }];
        });
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    const updatePriceType = (id, tipo) => { setCart(prev => prev.map(item => item.id === id ? { ...item, tipo_precio: tipo, precio_aplicado: item.opciones_precio[tipo] } : item)); scannerInputRef.current?.focus(); };
    const updateQty = (id, delta) => { setCart(prev => prev.map(item => item.id === id && (item.qty + delta > 0) ? { ...item, qty: item.qty + delta } : item)); scannerInputRef.current?.focus(); };
    const removeItem = (id) => { setCart(prev => prev.filter(item => item.id !== id)); scannerInputRef.current?.focus(); };

    const guardarClienteExpres = async () => {
        if (!newClientName) return;
        const { data, error } = await supabase.from('clientes').insert([{ nombre: newClientName, telefono: newClientPhone }]).select();
        if (error) return alert('Error: ' + error.message);
        setClientesDB([...clientesDB, data[0]].sort((a,b) => a.nombre.localeCompare(b.nombre)));
        setSelectedClient(data[0].id); setShowNewClientModal(false); setNewClientName(''); setNewClientPhone('');
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    let subtotalBruto = 0;
    let totalDescuentos = 0;
    const hoy = new Date();

    const cantidadesPorGrupo = {};
    cart.forEach(item => {
        if (item.grupo_id) cantidadesPorGrupo[item.grupo_id] = (cantidadesPorGrupo[item.grupo_id] || 0) + item.qty;
    });

    const gruposYaDescontados = {}; 

    const cartRender = cart.map(item => {
        let descuentoRow = 0;
        let msjPromo = null;
        
        const promo = promocionesDB.find(p => {
            const vigente = p.activa && hoy >= new Date(p.fecha_inicio) && hoy <= new Date(p.fecha_fin);
            if (!vigente) return false;
            if (p.producto_id) return p.producto_id === item.id;
            if (p.grupo_id) return p.grupo_id === item.grupo_id;
            return false;
        });

        if (promo && item.tipo_precio === 'general') {
            if (promo.tipo_descuento === 'porcentaje') {
                descuentoRow = (item.precio_aplicado * (promo.valor / 100)) * item.qty;
                msjPromo = `-${promo.valor}% Off ${promo.grupo_id ? '(F)' : ''}`;
            } 
            else if (promo.tipo_descuento === 'precio_fijo') {
                descuentoRow = Math.max(0, (item.precio_aplicado - promo.valor) * item.qty);
                msjPromo = `Precio Esp. ${promo.grupo_id ? '(F)' : ''}`;
            } 
            else if (promo.tipo_descuento === 'volumen' && promo.cantidad_requerida > 0) {
                const cantidadA_Evaluar = promo.grupo_id ? cantidadesPorGrupo[item.grupo_id] : item.qty;
                if (cantidadA_Evaluar >= promo.cantidad_requerida) {
                    const paquetes = Math.floor(cantidadA_Evaluar / promo.cantidad_requerida);
                    const unidadesRegaladas = paquetes * promo.cantidad_regalo;
                    
                    if (promo.grupo_id) {
                        if (!gruposYaDescontados[item.grupo_id]) {
                            descuentoRow = unidadesRegaladas * item.precio_aplicado;
                            msjPromo = `Promo Familia ${promo.cantidad_requerida}x${promo.cantidad_requerida - promo.cantidad_regalo}`;
                            gruposYaDescontados[item.grupo_id] = true;
                        }
                    } else {
                        descuentoRow = unidadesRegaladas * item.precio_aplicado;
                        msjPromo = `${promo.cantidad_requerida}x${promo.cantidad_requerida - promo.cantidad_regalo}`;
                    }
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
        if (cartRender.length === 0) return alert(t('carritoVacio'));
        
        // VALIDACIÓN DE CLIENTE OBLIGATORIO
        if (!selectedClient) return alert('Por favor, selecciona un paciente o selecciona Público General obligatoriamente.');

        if (metodoPago === 'efectivo') {
            if (!montoRecibido || parseFloat(montoRecibido) < totalCobrar) {
                return alert(t('montoInsuficiente'));
            }
        }

        const btn = document.getElementById('btn-cobrar');
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('procesando')}`;
        btn.disabled = true;

        const payloadItems = cartRender.map(item => ({
            producto_id: item.id, qty: item.qty, tipo_precio: item.tipo_precio,
            precio: item.qty > 0 ? (item.importeNeto / item.qty).toFixed(2) : item.precio_aplicado 
        }));

        // Convertir 'general' a valor null para la base de datos
        const clienteIdFinal = selectedClient === 'general' ? null : parseInt(selectedClient);
        
        const { error } = await supabase.rpc('procesar_venta', { 
            p_sucursal_id: sucursalId, p_cliente_id: clienteIdFinal, p_total: totalCobrar, 
            p_metodo_pago: metodoPago, p_items: payloadItems 
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            if (metodoPago === 'efectivo') {
                const cambioDeVenta = parseFloat(montoRecibido) - totalCobrar;
                await supabase.rpc('registrar_movimiento_caja', {
                    p_sucursal_id: sucursalId, p_tipo: 'venta_efectivo', p_monto: totalCobrar, p_motivo: `Venta de mostrador`
                });
                alert(`${t('cobradoExito')} EFECTIVO!\n\n${t('cambio')}: $${cambioDeVenta.toFixed(2)}`);
            } else {
                alert(`${t('cobradoExito')} ${t(metodoPago).toUpperCase()}!`);
            }
            
            setCart([]); setSelectedClient(''); setMontoRecibido('');
        }
        
        btn.innerHTML = `<i class="fa-solid fa-cash-register"></i> ${t('cobrar')}`; 
        btn.disabled = false;
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    const filteredCatalog = productosDB.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.codigo_barras.includes(searchTerm));

    return (
        <div className="view-section active">
            <div className="register-section">
                <div className="search-bar">
                    <input ref={scannerInputRef} type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} autoFocus placeholder={t('placeholderEscanear')} style={{flex:1, padding:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 0 10px rgba(198, 40, 40, 0.1)'}} />
                    <button className="btn-action btn-primary" onClick={handleSearch}><i className="fa-solid fa-magnifying-glass"></i> {t('buscar')}</button>
                </div>
                
                <div className="cart-table-container">
                    <table className="data-table">
                        <thead><tr><th>{t('producto')}</th><th>{t('tipoPrecio')}</th><th>{t('unitario')}</th><th>{t('cantidadAbrev')}</th><th>{t('importeNeto')}</th><th></th></tr></thead>
                        <tbody>
                            {cartRender.length === 0 ? <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>{t('esperandoLecturas')}</td></tr> : 
                                cartRender.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <strong>{item.name}</strong><br/>
                                            {item.msjPromo && <span style={{fontSize:'0.75rem', background:'var(--accent)', color:'white', padding:'2px 6px', borderRadius:'4px', display:'inline-block', marginTop:'4px'}}><i className="fa-solid fa-tag"></i> {item.msjPromo}</span>}
                                        </td>
                                        <td>
                                            <select value={item.tipo_precio} onChange={(e) => updatePriceType(item.id, e.target.value)} style={{background:'var(--bg-dark)', color:'white', padding:'5px', borderRadius: '4px'}}>
                                                <option value="general">{t('general')}</option>
                                                <option value="mayoreo">{t('mayoreo')}</option>
                                                <option value="distribuidor">{t('distribuidor')}</option>
                                                <option value="medico">{t('precioMedico')}</option>
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
                    <h3 style={{marginBottom:'10px'}}><i className="fa-solid fa-bolt" style={{color:'var(--accent)'}}></i> {t('anadirRapido')}</h3>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px'}}>
                        {productosDB.slice(0, 4).map((prod) => (
                            <div key={prod.id} onClick={() => addToCart(prod)} className="product-card" style={{background:'var(--bg-dark)', padding:'10px', borderRadius:'8px', textAlign:'center', cursor:'pointer', border:'1px solid var(--border-color)'}}>
                                <span style={{fontSize:'0.8rem', display:'block'}}>{prod.nombre}</span>
                                <span style={{color:'var(--success)', fontWeight:'bold'}}>${prod.precio.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <button className="btn-action" onClick={() => { setShowCatalogModal(true); setTimeout(() => scannerInputRef.current?.blur(), 50); }} style={{width: '100%', marginTop: '15px', padding: '12px', background: 'var(--bg-lighter)', border: '1px solid var(--border-color)', color: 'white'}}><i className="fa-solid fa-list" style={{marginRight: '8px'}}></i> {t('verCatalogo')}</button>
                </div>
                
                <div className="totals-box">
                    <div style={{display:'flex', justifyContent:'space-between', color:'var(--text-muted)', marginBottom:'5px'}}><span>{t('subtotal')}</span><span>${subtotalBruto.toFixed(2)}</span></div>
                    <div style={{display:'flex', justifyContent:'space-between', color:'var(--accent)', marginBottom:'10px'}}><span>{t('descuentos')}</span><span>-${totalDescuentos.toFixed(2)}</span></div>
                    
                    <div style={{marginBottom: '15px', borderTop: '1px dashed var(--border-color)', paddingTop: '15px'}}>
                        <label style={{display: 'block', color: 'white', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px'}}>{t('asignarPaciente')} *</label>
                        <div style={{display: 'flex', gap: '8px'}}>
                            
                            {/* NUEVO MENU DESPLEGABLE INTELIGENTE DE CLIENTES */}
                            <div style={{ position: 'relative', flex: 1 }}>
                                <div 
                                    onClick={() => { setShowClientDropdown(!showClientDropdown); setClientSearchTerm(''); }}
                                    style={{ padding: '10px 15px', background: 'var(--bg-dark)', color: selectedClient ? 'white' : 'var(--text-muted)', border: selectedClient ? '1px solid var(--border-color)' : '1px dashed var(--primary-red)', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                >
                                    <span>
                                        {selectedClient === 'general' 
                                            ? t('publicoGeneral') 
                                            : (selectedClient ? clientesDB.find(c => c.id === selectedClient)?.nombre : '-- Selecciona un paciente --')}
                                    </span>
                                    <i className="fa-solid fa-chevron-down" style={{fontSize: '0.8rem'}}></i>
                                </div>
                                
                                {showClientDropdown && (
                                    <>
                                        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10}} onClick={() => setShowClientDropdown(false)}></div>
                                        <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px', zIndex: 11, marginBottom: '5px', boxShadow: '0 -5px 15px rgba(0,0,0,0.5)', padding: '10px' }}>
                                            <input 
                                                type="text" 
                                                autoFocus
                                                placeholder="🔍 Buscar por nombre o teléfono..." 
                                                value={clientSearchTerm} 
                                                onChange={(e) => setClientSearchTerm(e.target.value)} 
                                                style={{width: '100%', padding: '10px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', marginBottom: '10px'}}
                                            />
                                            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                {t('publicoGeneral').toLowerCase().includes(clientSearchTerm.toLowerCase()) && (
                                                    <div 
                                                        onClick={() => { setSelectedClient('general'); setShowClientDropdown(false); scannerInputRef.current?.focus(); }}
                                                        style={{ padding: '10px', borderRadius: '4px', cursor: 'pointer', color: 'var(--accent)', fontWeight: 'bold' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-lighter)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        {t('publicoGeneral')}
                                                    </div>
                                                )}
                                                {clientesDB.filter(c => c.nombre.toLowerCase().includes(clientSearchTerm.toLowerCase()) || (c.telefono && c.telefono.includes(clientSearchTerm))).map(cli => (
                                                    <div 
                                                        key={cli.id}
                                                        onClick={() => { setSelectedClient(cli.id); setShowClientDropdown(false); scannerInputRef.current?.focus(); }}
                                                        style={{ padding: '10px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted)' }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-lighter)'; e.currentTarget.style.color = 'white'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                    >
                                                        {cli.nombre} {cli.telefono ? `(${cli.telefono})` : ''}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button className="btn-action" onClick={() => setShowNewClientModal(true)} style={{padding: '10px 14px', background: 'var(--bg-lighter)', border: '1px solid var(--border-color)', color: 'white'}} title={t('registrarPaciente')}><i className="fa-solid fa-user-plus"></i></button>
                        </div>
                    </div>

                    <div style={{marginBottom: '15px'}}>
                        <label style={{display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px'}}>{t('formaPago')}</label>
                        <div style={{display: 'flex', gap: '10px'}}>
                            <button onClick={() => setMetodoPago('efectivo')} style={{flex: 1, padding: '10px', background: metodoPago === 'efectivo' ? '#1b5e20' : 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}}><i className="fa-solid fa-money-bill-1-wave"></i> {t('efectivo')}</button>
                            <button onClick={() => setMetodoPago('tarjeta')} style={{flex: 1, padding: '10px', background: metodoPago === 'tarjeta' ? '#0d47a1' : 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}}><i className="fa-solid fa-credit-card"></i> {t('tarjeta')}</button>
                            <button onClick={() => setMetodoPago('transferencia')} style={{flex: 1, padding: '10px', background: metodoPago === 'transferencia' ? '#6a1b9a' : 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}}><i className="fa-solid fa-building-columns"></i> {t('transferencia')}</button>
                        </div>
                    </div>

                    {metodoPago === 'efectivo' && (
                        <div style={{marginBottom: '20px', background: '#1b5e2011', padding: '15px', borderRadius: '8px', border: '1px dashed var(--success)'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                                <span style={{color: 'var(--success)'}}>{t('montoRecibido')}</span>
                                <input 
                                    type="number" 
                                    value={montoRecibido} 
                                    onChange={(e) => setMontoRecibido(e.target.value)} 
                                    placeholder="$ 0.00"
                                    style={{width: '120px', padding: '8px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--success)', borderRadius: '6px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold'}}
                                />
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: (parseFloat(montoRecibido || 0) >= totalCobrar) ? 'var(--success)' : 'var(--primary-red)'}}>
                                <span>{t('cambio')}:</span>
                                <span>${(parseFloat(montoRecibido || 0) >= totalCobrar) ? (parseFloat(montoRecibido) - totalCobrar).toFixed(2) : '0.00'}</span>
                            </div>
                        </div>
                    )}

                    <div className="totals-row grand-total"><span>{t('total')}</span><span style={{color: 'var(--success)'}}>${totalCobrar.toFixed(2)}</span></div>
                    <button id="btn-cobrar" onClick={handleCheckout} className="pay-btn" style={{width:'100%', padding:'20px', background:'var(--primary-red)', color:'white', border:'none', borderRadius:'8px', fontSize:'1.3rem', fontWeight:'bold', cursor:'pointer'}}>{t('cobrar')}</button>
                </div>
            </div>

            {showCatalogModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                            <h3><i className="fa-solid fa-book-open" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('catalogoProductos')}</h3>
                            <button onClick={() => { setShowCatalogModal(false); scannerInputRef.current?.focus(); }} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer'}}>&times;</button>
                        </div>
                        <input type="text" placeholder={t('buscarNombreCodigo')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{width:'100%', padding:'12px', marginBottom:'20px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <div style={{overflowY: 'auto', flex: 1, border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                            <table className="data-table">
                                <thead><tr><th>{t('codigo')}</th><th>{t('nombre')}</th><th>{t('precio')}</th><th></th></tr></thead>
                                <tbody>
                                    {filteredCatalog.map(p => (
                                        <tr key={p.id}>
                                            <td style={{color: 'var(--text-muted)'}}>{p.codigo_barras}</td>
                                            <td><strong>{p.nombre}</strong></td>
                                            <td style={{color: 'var(--success)'}}>${p.precio.toFixed(2)}</td>
                                            <td style={{textAlign: 'right'}}><button className="btn-action btn-primary" onClick={() => { addToCart(p); setShowCatalogModal(false); setSearchTerm(''); }} style={{padding: '6px 12px', fontSize: '0.9rem'}}>{t('agregar')}</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {showNewClientModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '400px'}}>
                        <h3 style={{marginBottom: '20px'}}><i className="fa-solid fa-user-plus"></i> {t('registrarPaciente')}</h3>
                        <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder={t('nombreCompleto')} style={{width:'100%', padding:'10px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <input type="text" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder={t('telefono')} style={{width:'100%', padding:'10px', marginBottom:'20px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1, padding: '12px'}} onClick={guardarClienteExpres}>{t('guardarSeleccionar')}</button>
                            <button className="btn-action" style={{flex:1, padding: '12px'}} onClick={() => { setShowNewClientModal(false); scannerInputRef.current?.focus(); }}>{t('cancelar')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}