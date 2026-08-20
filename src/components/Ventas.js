'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Ventas({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage();

    const [barcode, setBarcode] = useState('');
    const [cart, setCart] = useState([]);
    const [productosDB, setProductosDB] = useState([]);
    const [clientesDB, setClientesDB] = useState([]);
    const [promocionesDB, setPromocionesDB] = useState([]);
    
    const [selectedClient, setSelectedClient] = useState('');
    const [metodoPago, setMetodoPago] = useState('efectivo');
    const [montoRecibido, setMontoRecibido] = useState('');
    
    const [folioTransferencia, setFolioTransferencia] = useState('');
    const [tipoTarjeta, setTipoTarjeta] = useState('debito');
    const [historialHoy, setHistorialHoy] = useState([]);
    
    const scannerInputRef = useRef(null);

    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const fetchDatos = async () => {
        const { data: prods } = await supabase.from('productos')
            .select('*, inventario(sucursal_id, precio, precio_mayoreo, precio_distribuidor, precio_medico)')
            .eq('activo', true);
            
        if (prods) {
            const productosAdaptados = prods.map(p => {
                if (p.usa_precio_sucursal) {
                    const invLocal = p.inventario.find(i => i.sucursal_id === sucursalId);
                    if (invLocal) {
                        return {
                            ...p,
                            precio: invLocal.precio ?? p.precio,
                            precio_mayoreo: invLocal.precio_mayoreo ?? p.precio_mayoreo,
                            precio_distribuidor: invLocal.precio_distribuidor ?? p.precio_distribuidor,
                            precio_medico: invLocal.precio_medico ?? p.precio_medico
                        };
                    }
                }
                return p;
            });
            setProductosDB(productosAdaptados);
        }

        const { data: clis } = await supabase.from('clientes').select('*').order('nombre', { ascending: true });
        if (clis) setClientesDB(clis);

        const { data: promos } = await supabase.from('promociones').select('*');
        if (promos) setPromocionesDB(promos);
    };

    const fetchHistorialHoy = async () => {
        const hoy = new Date().toISOString().split('T')[0];
        const { data } = await supabase
            .from('ventas')
            .select(`
                id, fecha, total, metodo_pago, vendedor_nombre,
                clientes ( nombre ),
                venta_detalles ( cantidad, productos ( nombre ) )
            `)
            .eq('sucursal_id', sucursalId)
            .gte('fecha', `${hoy}T00:00:00`)
            .order('fecha', { ascending: false });
        if (data) setHistorialHoy(data);
    };

    useEffect(() => {
        fetchDatos();
        fetchHistorialHoy();
        scannerInputRef.current?.focus();
    }, [branch]);

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const activeElement = document.activeElement;
            const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');
            if (!isInputFocused && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                scannerInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

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
                    general: product.precio, mayoreo: product.precio_mayoreo, 
                    distribuidor: product.precio_distribuidor, medico: product.precio_medico 
                }
            }];
        });
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    const updatePriceType = (id, tipo) => { setCart(prev => prev.map(item => item.id === id ? { ...item, tipo_precio: tipo, precio_aplicado: item.opciones_precio[tipo] } : item)); scannerInputRef.current?.focus(); };
    const updateQty = (id, delta) => { setCart(prev => prev.map(item => item.id === id && (item.qty + delta > 0) ? { ...item, qty: item.qty + delta } : item)); scannerInputRef.current?.focus(); };
    const removeItem = (id) => { setCart(prev => prev.filter(item => item.id !== id)); scannerInputRef.current?.focus(); };

    const toggleAccesoRapido = async (producto) => {
        const nuevoEstado = !producto.acceso_rapido;
        const { error } = await supabase.from('productos').update({ acceso_rapido: nuevoEstado }).eq('id', producto.id);
        if (error) alert('Error al actualizar: ' + error.message);
        else setProductosDB(prev => prev.map(p => p.id === producto.id ? { ...p, acceso_rapido: nuevoEstado } : p));
    };

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
    cart.forEach(item => { if (item.grupo_id) cantidadesPorGrupo[item.grupo_id] = (cantidadesPorGrupo[item.grupo_id] || 0) + item.qty; });
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
            } else if (promo.tipo_descuento === 'precio_fijo') {
                descuentoRow = Math.max(0, (item.precio_aplicado - promo.valor) * item.qty);
                msjPromo = `Precio Esp. ${promo.grupo_id ? '(F)' : ''}`;
            } else if (promo.tipo_descuento === 'volumen' && promo.cantidad_requerida > 0) {
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
        if (!selectedClient) return alert('Por favor, selecciona un paciente o selecciona Público General obligatoriamente.');

        let stringMetodoPago = metodoPago;

        if (metodoPago === 'efectivo') {
            if (!montoRecibido || parseFloat(montoRecibido) < totalCobrar) {
                return alert(t('montoInsuficiente'));
            }
        } else if (metodoPago === 'tarjeta') {
            stringMetodoPago = `Tarjeta (${tipoTarjeta === 'debito' ? t('debito') : t('credito')})`;
        } else if (metodoPago === 'transferencia') {
            if (!folioTransferencia.trim()) return alert(t('folioRequerido'));
            stringMetodoPago = `Transferencia (Folio: ${folioTransferencia.trim()})`;
        }

        const btn = document.getElementById('btn-cobrar');
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('procesando')}`;
        btn.disabled = true;

        const payloadItems = cartRender.map(item => ({
            producto_id: item.id, qty: item.qty, tipo_precio: item.tipo_precio,
            precio: item.qty > 0 ? (item.importeNeto / item.qty).toFixed(2) : item.precio_aplicado 
        }));

        const clienteIdFinal = selectedClient === 'general' ? null : parseInt(selectedClient);
        
        const { error } = await supabase.rpc('procesar_venta', { 
            p_sucursal_id: sucursalId, p_cliente_id: clienteIdFinal, p_total: totalCobrar, 
            p_metodo_pago: stringMetodoPago, p_items: payloadItems 
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            const { data: latestSale } = await supabase.from('ventas').select('id').eq('sucursal_id', sucursalId).order('fecha', { ascending: false }).limit(1);
            if (latestSale && latestSale.length > 0) {
                await supabase.from('ventas').update({ vendedor_nombre: perfilActual?.nombre || 'Recepcionista' }).eq('id', latestSale[0].id);
            }

            if (metodoPago === 'efectivo') {
                const cambioDeVenta = parseFloat(montoRecibido) - totalCobrar;
                await supabase.rpc('registrar_movimiento_caja', { p_sucursal_id: sucursalId, p_tipo: 'venta_efectivo', p_monto: totalCobrar, p_motivo: `Venta de mostrador` });
                alert(`${t('cobradoExito')} EFECTIVO!\n\n${t('cambio')}: $${cambioDeVenta.toFixed(2)}`);
            } else {
                alert(`${t('cobradoExito')} ${stringMetodoPago.toUpperCase()}!`);
            }
            
            setCart([]); setSelectedClient(''); setMontoRecibido(''); setFolioTransferencia('');
            fetchHistorialHoy();
        }
        
        btn.innerHTML = `<i class="fa-solid fa-cash-register"></i> ${t('cobrar')}`; 
        btn.disabled = false;
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    const filteredCatalog = productosDB.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (p.codigo_barras && p.codigo_barras.includes(searchTerm)));
    const productosAnclados = productosDB.filter(p => p.acceso_rapido);

    return (
        <div className="view-section active" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            
            {/* ÁREA PRINCIPAL POS (Diseñada para encajar al 100% de zoom) */}
            <div style={{ display: 'flex', gap: '20px', height: '62vh', minHeight: '520px', flex: '0 0 auto' }}>
                
                {/* PANEL IZQUIERDO (CARRITO) */}
                <div className="panel" style={{ flex: 2, display: 'flex', flexDirection: 'column', padding: '20px' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexShrink: 0 }}>
                        <input 
                            ref={scannerInputRef} 
                            type="text" 
                            value={barcode} 
                            onChange={(e) => setBarcode(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
                            autoFocus 
                            placeholder={t('placeholderEscanear')} 
                            style={{
                                flex: 1, padding: '16px 20px', fontSize: '1.05rem', 
                                backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', 
                                border: '1px solid var(--border-color)', borderRadius: '10px', 
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)', transition: 'all 0.3s'
                            }} 
                        />
                        <button className="btn-action btn-primary" onClick={handleSearch} style={{padding: '0 25px', borderRadius: '10px'}}><i className="fa-solid fa-magnifying-glass"></i> {t('buscar')}</button>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-panel)' }}>
                        <table className="data-table">
                            <thead style={{position: 'sticky', top: 0, zIndex: 1}}>
                                <tr><th>{t('producto')}</th><th>{t('tipoPrecio')}</th><th>{t('unitario')}</th><th>{t('cantidadAbrev')}</th><th>{t('importeNeto')}</th><th></th></tr>
                            </thead>
                            <tbody>
                                {cartRender.length === 0 ? <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-barcode fa-2x" style={{marginBottom: '10px', display: 'block', opacity: 0.5}}></i> {t('esperandoLecturas')}</td></tr> : 
                                    cartRender.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <strong style={{color: 'var(--text-main)', fontSize: '0.95rem'}}>{item.name}</strong><br/>
                                                {item.msjPromo && <span style={{fontSize:'0.75rem', background:'var(--accent)', color:'white', padding:'2px 6px', borderRadius:'4px', display:'inline-block', marginTop:'4px'}}><i className="fa-solid fa-tag"></i> {item.msjPromo}</span>}
                                            </td>
                                            <td>
                                                <select value={item.tipo_precio} onChange={(e) => updatePriceType(item.id, e.target.value)} style={{padding:'6px', borderRadius: '6px', fontSize: '0.85rem'}}>
                                                    <option value="general">{t('general')}</option>
                                                    <option value="mayoreo">{t('mayoreo')}</option>
                                                    <option value="distribuidor">{t('distribuidor')}</option>
                                                    <option value="medico">{t('precioMedico')}</option>
                                                </select>
                                            </td>
                                            <td style={{color: 'var(--text-main)'}}>${item.precio_aplicado.toFixed(2)}</td>
                                            <td>
                                                <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-main)', padding: '4px 8px', borderRadius: '6px', width: 'max-content'}}>
                                                    <button onClick={() => updateQty(item.id, -1)} style={{background: 'transparent', color: 'var(--text-main)', border: 'none', cursor:'pointer', fontSize: '1.2rem', padding: '0 5px'}}>-</button>
                                                    <span style={{color: 'var(--text-main)', fontWeight: 'bold', width: '20px', textAlign: 'center'}}>{item.qty}</span>
                                                    <button onClick={() => updateQty(item.id, 1)} style={{background: 'transparent', color: 'var(--text-main)', border: 'none', cursor:'pointer', fontSize: '1.2rem', padding: '0 5px'}}>+</button>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{fontWeight:'bold', fontSize: '1.05rem', color: item.descuentoRow > 0 ? 'var(--success)' : 'var(--text-main)'}}>${item.importeNeto.toFixed(2)}</div>
                                                {item.descuentoRow > 0 && <div style={{fontSize:'0.8rem', color:'var(--accent)', textDecoration:'line-through'}}>${(item.precio_aplicado * item.qty).toFixed(2)}</div>}
                                            </td>
                                            <td style={{textAlign: 'right'}}><button onClick={() => removeItem(item.id)} className="btn-action" style={{background: 'transparent', color: 'var(--primary-red)', border: 'none', fontSize: '1.2rem'}}><i className="fa-solid fa-trash-can"></i></button></td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
                
                {/* PANEL DERECHO (PAGO Y TOTALES FIJOS) */}
                <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
                    
                    {/* Sección Superior (Scrollable internamente si es necesario) */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '25px 25px 10px 25px' }}>
                        
                        {/* AÑADIR RÁPIDO */}
                        <div style={{marginBottom: '25px'}}>
                            <h3 style={{marginBottom:'15px', color: 'var(--text-main)', fontSize: '1rem'}}><i className="fa-solid fa-bolt" style={{color:'var(--accent)'}}></i> {t('anadirRapido')}</h3>
                            {productosAnclados.length === 0 ? (
                                <div style={{textAlign:'center', padding:'15px', color:'var(--text-muted)', fontSize:'0.8rem', background:'var(--bg-main)', borderRadius:'8px', border:'1px dashed var(--border-color)'}}>
                                    <i className="fa-regular fa-star" style={{fontSize:'1.2rem', marginBottom:'5px', display:'block'}}></i>
                                    Marca la estrella en el catálogo para anclar.
                                </div>
                            ) : (
                                <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px', maxHeight: '110px', overflowY: 'auto', paddingRight: '5px'}}>
                                    {productosAnclados.map((prod) => (
                                        <div key={prod.id} onClick={() => addToCart(prod)} style={{background:'var(--bg-main)', padding:'12px', borderRadius:'8px', textAlign:'center', cursor:'pointer', border:'1px solid var(--border-color)', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>
                                            <span style={{fontSize:'0.8rem', display:'block', color: 'var(--text-main)', marginBottom: '4px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{prod.nombre}</span>
                                            <span style={{color:'var(--success)', fontWeight:'bold', fontSize: '0.9rem'}}>${prod.precio.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button className="btn-action" onClick={() => { setShowCatalogModal(true); setTimeout(() => scannerInputRef.current?.blur(), 50); }} style={{width: '100%', marginTop: '10px', padding: '10px'}}><i className="fa-solid fa-list" style={{marginRight: '8px'}}></i> {t('verCatalogo')}</button>
                        </div>

                        {/* PACIENTE */}
                        <div style={{marginBottom: '20px', borderTop: '1px dashed var(--border-color)', paddingTop: '20px'}}>
                            <label style={{display: 'block', color: 'var(--text-main)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px'}}>{t('asignarPaciente')} *</label>
                            <div style={{display: 'flex', gap: '8px'}}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <div 
                                        onClick={() => { setShowClientDropdown(!showClientDropdown); setClientSearchTerm(''); }}
                                        style={{ padding: '10px 15px', background: 'var(--bg-main)', color: selectedClient ? 'var(--text-main)' : 'var(--text-muted)', border: selectedClient ? '1px solid var(--border-color)' : '1px dashed var(--primary-red)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    >
                                        <span style={{fontSize: '0.9rem'}}>
                                            {selectedClient === 'general' 
                                                ? t('publicoGeneral') 
                                                : (selectedClient ? clientesDB.find(c => c.id === selectedClient)?.nombre : '-- Selecciona un paciente --')}
                                        </span>
                                        <i className="fa-solid fa-chevron-down" style={{fontSize: '0.8rem'}}></i>
                                    </div>
                                    
                                    {showClientDropdown && (
                                        <>
                                            <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10}} onClick={() => setShowClientDropdown(false)}></div>
                                            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 11, marginBottom: '5px', boxShadow: '0 -5px 25px rgba(0,0,0,0.15)', padding: '10px' }}>
                                                <input type="text" autoFocus placeholder=" Buscar por nombre..." value={clientSearchTerm} onChange={(e) => setClientSearchTerm(e.target.value)} style={{width: '100%', marginBottom: '10px', background: 'var(--bg-main)'}} />
                                                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    {t('publicoGeneral').toLowerCase().includes(clientSearchTerm.toLowerCase()) && (
                                                        <div onClick={() => { setSelectedClient('general'); setShowClientDropdown(false); scannerInputRef.current?.focus(); }} style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', color: 'var(--accent)', fontWeight: 'bold' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-main)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{t('publicoGeneral')}</div>
                                                    )}
                                                    {clientesDB.filter(c => c.nombre.toLowerCase().includes(clientSearchTerm.toLowerCase()) || (c.telefono && c.telefono.includes(clientSearchTerm))).map(cli => (
                                                        <div key={cli.id} onClick={() => { setSelectedClient(cli.id); setShowClientDropdown(false); scannerInputRef.current?.focus(); }} style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.9rem' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-main)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                                            {cli.nombre} {cli.telefono ? `(${cli.telefono})` : ''}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button className="btn-action" onClick={() => setShowNewClientModal(true)} style={{padding: '0 15px'}} title={t('registrarPaciente')}><i className="fa-solid fa-user-plus"></i></button>
                            </div>
                        </div>

                        {/* FORMA DE PAGO */}
                        <div style={{marginBottom: '15px'}}>
                            <label style={{display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px'}}>{t('formaPago')}</label>
                            <div style={{display: 'flex', gap: '8px'}}>
                                <button onClick={() => setMetodoPago('efectivo')} className="btn-action" style={{flex: 1, padding: '10px', background: metodoPago === 'efectivo' ? 'var(--success)' : 'var(--bg-main)', color: metodoPago === 'efectivo' ? 'white' : 'var(--text-main)', border: metodoPago === 'efectivo' ? 'none' : '1px solid var(--border-color)', fontSize: '0.85rem'}}><i className="fa-solid fa-money-bill-1-wave"></i> {t('efectivo')}</button>
                                <button onClick={() => setMetodoPago('tarjeta')} className="btn-action" style={{flex: 1, padding: '10px', background: metodoPago === 'tarjeta' ? 'var(--accent)' : 'var(--bg-main)', color: metodoPago === 'tarjeta' ? 'white' : 'var(--text-main)', border: metodoPago === 'tarjeta' ? 'none' : '1px solid var(--border-color)', fontSize: '0.85rem'}}><i className="fa-solid fa-credit-card"></i> {t('tarjeta')}</button>
                                <button onClick={() => setMetodoPago('transferencia')} className="btn-action" style={{flex: 1, padding: '10px', background: metodoPago === 'transferencia' ? '#6a1b9a' : 'var(--bg-main)', color: metodoPago === 'transferencia' ? 'white' : 'var(--text-main)', border: metodoPago === 'transferencia' ? 'none' : '1px solid var(--border-color)', fontSize: '0.85rem'}}><i className="fa-solid fa-building-columns"></i> Transf.</button>
                            </div>
                        </div>

                        {/* DETALLES DEL PAGO (CAJAS ESTILIZADAS) */}
                        {metodoPago === 'efectivo' && (
                            <div style={{background: 'rgba(46, 125, 50, 0.05)', padding: '15px', borderRadius: '10px', border: '1px solid var(--success)', marginBottom: '10px'}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                                    <span style={{color: 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem'}}>{t('montoRecibido')}</span>
                                    <input type="number" value={montoRecibido} onChange={(e) => setMontoRecibido(e.target.value)} placeholder="$ 0.00" 
                                        style={{width: '130px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 'bold', backgroundColor: 'var(--bg-main)', color: 'var(--success)', border: '1px solid var(--success)', padding: '8px 12px', borderRadius: '8px', outline: 'none'}} />
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: (parseFloat(montoRecibido || 0) >= totalCobrar) ? 'var(--success)' : 'var(--primary-red)'}}>
                                    <span>{t('cambio')}:</span>
                                    <span>${(parseFloat(montoRecibido || 0) >= totalCobrar) ? (parseFloat(montoRecibido) - totalCobrar).toFixed(2) : '0.00'}</span>
                                </div>
                            </div>
                        )}

                        {metodoPago === 'tarjeta' && (
                            <div style={{background: 'rgba(2, 132, 199, 0.05)', padding: '15px', borderRadius: '10px', border: '1px solid var(--accent)', marginBottom: '10px'}}>
                                <label style={{fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '8px', display: 'block', fontWeight: 'bold'}}>{t('tipoTarjeta')}</label>
                                <div style={{display: 'flex', gap: '10px'}}>
                                    <button onClick={() => setTipoTarjeta('debito')} className="btn-action" style={{flex: 1, background: tipoTarjeta === 'debito' ? 'var(--accent)' : 'var(--bg-main)', color: tipoTarjeta === 'debito' ? 'white' : 'var(--text-main)', border: tipoTarjeta === 'debito' ? 'none' : '1px solid var(--border-color)'}}>{t('debito')}</button>
                                    <button onClick={() => setTipoTarjeta('credito')} className="btn-action" style={{flex: 1, background: tipoTarjeta === 'credito' ? 'var(--accent)' : 'var(--bg-main)', color: tipoTarjeta === 'credito' ? 'white' : 'var(--text-main)', border: tipoTarjeta === 'credito' ? 'none' : '1px solid var(--border-color)'}}>{t('credito')}</button>
                                </div>
                            </div>
                        )}

                        {metodoPago === 'transferencia' && (
                            <div style={{background: 'rgba(106, 27, 154, 0.05)', padding: '15px', borderRadius: '10px', border: '1px solid #6a1b9a', marginBottom: '10px'}}>
                                <label style={{fontSize: '0.8rem', color: '#6a1b9a', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}><i className="fa-solid fa-hashtag"></i> {t('folioTransferencia')}</label>
                                <input type="text" value={folioTransferencia} onChange={(e) => setFolioTransferencia(e.target.value)} placeholder={t('ingresaFolio')} style={{width: '100%', border: '1px solid #6a1b9a', backgroundColor: 'var(--bg-main)'}} />
                            </div>
                        )}
                    </div>

                    {/* TOTALES Y BOTÓN DE COBRO (FIJOS AL FONDO) */}
                    <div style={{ padding: '20px 25px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)', marginTop: 'auto', flexShrink: 0, boxShadow: '0 -4px 10px rgba(0,0,0,0.02)' }}>
                        <div style={{display:'flex', justifyContent:'space-between', color:'var(--text-muted)', marginBottom:'5px', fontSize: '0.9rem'}}><span>{t('subtotal')}</span><span>${subtotalBruto.toFixed(2)}</span></div>
                        <div style={{display:'flex', justifyContent:'space-between', color:'var(--accent)', marginBottom:'10px', fontSize: '0.9rem'}}><span>{t('descuentos')}</span><span>-${totalDescuentos.toFixed(2)}</span></div>
                        
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)'}}>
                            <span style={{fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 'bold'}}>{t('total')}</span>
                            <span style={{fontSize: '2.2rem', color: 'var(--success)', fontWeight: '900'}}>${totalCobrar.toFixed(2)}</span>
                        </div>
                        
                        <button id="btn-cobrar" onClick={handleCheckout} className="btn-primary" 
                            style={{
                                width:'100%', padding:'16px', border:'none', borderRadius:'10px', 
                                fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer', 
                                boxShadow: '0 4px 15px rgba(211, 47, 47, 0.25)', transition: 'all 0.3s ease'
                            }}>
                            <i className="fa-solid fa-cash-register"></i> {t('cobrar')}
                        </button>
                    </div>
                </div>
            </div>

            {/* TABLA HISTORIAL DEL DÍA */}
            <div className="panel" style={{ flex: '0 0 auto', marginTop: '20px' }}>
                <h3 style={{marginBottom: '15px', color: 'var(--text-main)'}}><i className="fa-solid fa-clock-history" style={{color: 'var(--accent)'}}></i> {t('historialDia')} - {branch.toUpperCase()}</h3>
                <div style={{maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px'}}>
                    <table className="data-table">
                        <thead style={{position: 'sticky', top: 0, zIndex: 1}}>
                            <tr>
                                <th>{t('folio')}</th>
                                <th>{t('hora')}</th>
                                <th>{t('clientes')}</th>
                                <th>{t('articulos')}</th>
                                <th>{t('formaPago')}</th>
                                <th>{t('vendedor')}</th>
                                <th style={{textAlign: 'right'}}>{t('total')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historialHoy.map(venta => (
                                <tr key={venta.id}>
                                    <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{venta.id.toString().padStart(5, '0')}</td>
                                    <td style={{fontSize: '0.85rem', color: 'var(--text-main)'}}>{new Date(venta.fecha).toLocaleTimeString()}</td>
                                    <td><strong style={{color: 'var(--text-main)'}}>{venta.clientes?.nombre || t('publicoGeneral')}</strong></td>
                                    <td>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '3px'}}>
                                            {venta.venta_detalles?.map((d, i) => (
                                                <span key={i} style={{fontSize: '0.8rem', color: 'var(--text-main)'}}><span style={{color:'var(--accent)', fontWeight:'bold'}}>{d.cantidad}x</span> {d.productos?.nombre}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td><span style={{fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '4px'}}>{venta.metodo_pago.toUpperCase()}</span></td>
                                    <td style={{color: 'var(--text-muted)'}}>{venta.vendedor_nombre || 'N/A'}</td>
                                    <td style={{color: 'var(--success)', fontWeight: 'bold', textAlign: 'right'}}>${parseFloat(venta.total).toFixed(2)}</td>
                                </tr>
                            ))}
                            {historialHoy.length === 0 && <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>{t('sinDatos')}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DEL CATÁLOGO DE PRODUCTOS */}
            {showCatalogModal && (
                <div className="modal-overlay" style={{display: 'flex'}}>
                    <div className="modal-box" style={{width: '800px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', textAlign: 'left'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                            <h3 style={{margin: 0, color: 'var(--text-main)'}}><i className="fa-solid fa-book-open" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('catalogoProductos')}</h3>
                            <button onClick={() => { setShowCatalogModal(false); scannerInputRef.current?.focus(); }} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer'}}>&times;</button>
                        </div>
                        <input type="text" placeholder={t('buscarNombreCodigo')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{marginBottom:'20px', backgroundColor: 'var(--bg-main)'}} />
                        
                        <div style={{overflowY: 'auto', flex: 1, border: '1px solid var(--border-color)', borderRadius: '10px'}}>
                            <table className="data-table">
                                <thead style={{position: 'sticky', top: 0, zIndex: 1}}>
                                    <tr>
                                        <th style={{textAlign: 'center'}}><i className="fa-solid fa-star"></i></th>
                                        <th>{t('codigo')}</th>
                                        <th>{t('nombre')}</th>
                                        <th>{t('precio')}</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCatalog.map(p => (
                                        <tr key={p.id}>
                                            <td style={{textAlign: 'center'}}>
                                                <button onClick={() => toggleAccesoRapido(p)} className="btn-action" style={{background: 'transparent', border: 'none', color: p.acceso_rapido ? '#ffb300' : 'var(--text-muted)', fontSize: '1.1rem'}}>
                                                    <i className={p.acceso_rapido ? "fa-solid fa-star" : "fa-regular fa-star"}></i>
                                                </button>
                                            </td>
                                            <td style={{color: 'var(--text-muted)'}}>{p.codigo_barras || 'N/A'}</td>
                                            <td style={{color: 'var(--text-main)'}}><strong>{p.nombre}</strong></td>
                                            <td style={{color: 'var(--success)', fontWeight: 'bold'}}>${p.precio.toFixed(2)}</td>
                                            <td style={{textAlign: 'right'}}><button className="btn-action btn-primary" onClick={() => { addToCart(p); setShowCatalogModal(false); setSearchTerm(''); }}>{t('agregar')}</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL REGISTRO DE CLIENTE EXPRÉS */}
            {showNewClientModal && (
                <div className="modal-overlay" style={{display: 'flex'}}>
                    <div className="modal-box" style={{width: '400px', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '20px', color: 'var(--text-main)'}}><i className="fa-solid fa-user-plus" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('registrarPaciente')}</h3>
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px', display: 'block'}}>{t('nombreCompleto')}</label>
                        <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} style={{width:'100%', marginBottom:'15px', backgroundColor: 'var(--bg-main)'}} />
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px', display: 'block'}}>{t('telefono')}</label>
                        <input type="text" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} style={{width:'100%', marginBottom:'25px', backgroundColor: 'var(--bg-main)'}} />
                        
                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1}} onClick={guardarClienteExpres}>{t('guardarSeleccionar')}</button>
                            <button className="btn-action" style={{flex:1}} onClick={() => { setShowNewClientModal(false); scannerInputRef.current?.focus(); }}>{t('cancelar')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}