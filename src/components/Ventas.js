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
    const [metodoPago, setMetodoPago] = useState('efectivo'); // efectivo | tarjeta | transferencia | mixto
    const [montoRecibido, setMontoRecibido] = useState('');
    
    const [folioTransferencia, setFolioTransferencia] = useState('');
    const [tipoTarjeta, setTipoTarjeta] = useState('debito');
    
    // Estados para Pago Mixto
    const [montosMixtos, setMontosMixtos] = useState({ efectivo: '', tarjeta: '', transferencia: '' });

    const [historialHoy, setHistorialHoy] = useState([]);
    const scannerInputRef = useRef(null);

    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    // 🚀 NUEVO MODAL: Buscador de Pacientes (Reemplaza al Dropdown que se cortaba)
    const [showClientSearchModal, setShowClientSearchModal] = useState(false);
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
                        return { ...p, precio: invLocal.precio ?? p.precio, precio_mayoreo: invLocal.precio_mayoreo ?? p.precio_mayoreo, precio_distribuidor: invLocal.precio_distribuidor ?? p.precio_distribuidor, precio_medico: invLocal.precio_medico ?? p.precio_medico };
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
        const { data } = await supabase.from('ventas').select(`id, fecha, total, metodo_pago, vendedor_nombre, clientes ( nombre ), venta_detalles ( cantidad, productos ( nombre ) )`).eq('sucursal_id', sucursalId).gte('fecha', `${hoy}T00:00:00`).order('fecha', { ascending: false });
        if (data) setHistorialHoy(data);
    };

    useEffect(() => {
        fetchDatos();
        fetchHistorialHoy();
        scannerInputRef.current?.focus();
    }, [branch]);

    // Escáner Inteligente (Captura códigos aunque el input no esté en foco)
    const modalsState = useRef({ cat: false, cli: false, drop: false });
    useEffect(() => { modalsState.current = { cat: showCatalogModal, cli: showNewClientModal, drop: showClientSearchModal }; }, [showCatalogModal, showNewClientModal, showClientSearchModal]);

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const activeElement = document.activeElement;
            const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');
            const mods = modalsState.current;
            if (!isInputFocused && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !mods.cat && !mods.cli && !mods.drop) {
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
        else { alert(`Código "${targetCode}" no registrado.`); setBarcode(''); scannerInputRef.current?.focus(); }
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            return [...prev, { 
                id: product.id, code: product.codigo_barras, name: product.nombre, grupo_id: product.grupo_id, qty: 1, tipo_precio: 'general', precio_aplicado: product.precio,
                opciones_precio: { general: product.precio, mayoreo: product.precio_mayoreo, distribuidor: product.precio_distribuidor, medico: product.precio_medico }
            }];
        });
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    const updatePriceType = (id, tipo) => { setCart(prev => prev.map(item => item.id === id ? { ...item, tipo_precio: tipo, precio_aplicado: item.opciones_precio[tipo] } : item)); scannerInputRef.current?.focus(); };
    const updateQty = (id, delta) => { setCart(prev => prev.map(item => item.id === id && (item.qty + delta > 0) ? { ...item, qty: item.qty + delta } : item)); scannerInputRef.current?.focus(); };
    const removeItem = (id) => { setCart(prev => prev.filter(item => item.id !== id)); scannerInputRef.current?.focus(); };

    const guardarClienteExpres = async () => {
        if (!newClientName) return alert(t('camposObligatorios') || 'Faltan campos.');
        const { data, error } = await supabase.from('clientes').insert([{ nombre: newClientName, telefono: newClientPhone }]).select();
        if (error) return alert('Error: ' + error.message);
        setClientesDB([...clientesDB, data[0]].sort((a,b) => a.nombre.localeCompare(b.nombre)));
        setSelectedClient(data[0].id); setShowNewClientModal(false); setNewClientName(''); setNewClientPhone('');
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    // CÁLCULO DE TOTALES Y DESCUENTOS
    let subtotalBruto = 0;
    let totalDescuentos = 0;
    const hoy = new Date();
    const cantidadesPorGrupo = {};
    cart.forEach(item => { if (item.grupo_id) cantidadesPorGrupo[item.grupo_id] = (cantidadesPorGrupo[item.grupo_id] || 0) + item.qty; });
    const gruposYaDescontados = {}; 

    const cartRender = cart.map(item => {
        let descuentoRow = 0;
        let msjPromo = null;
        const promo = promocionesDB.find(p => p.activa && hoy >= new Date(p.fecha_inicio) && hoy <= new Date(p.fecha_fin) && (p.producto_id === item.id || p.grupo_id === item.grupo_id));

        if (promo && item.tipo_precio === 'general') {
            if (promo.tipo_descuento === 'porcentaje') {
                descuentoRow = (item.precio_aplicado * (promo.valor / 100)) * item.qty;
                msjPromo = `-${promo.valor}% Off`;
            } else if (promo.tipo_descuento === 'precio_fijo') {
                descuentoRow = Math.max(0, (item.precio_aplicado - promo.valor) * item.qty);
                msjPromo = `Precio Esp.`;
            } else if (promo.tipo_descuento === 'volumen' && promo.cantidad_requerida > 0) {
                const cantidadA_Evaluar = promo.grupo_id ? cantidadesPorGrupo[item.grupo_id] : item.qty;
                if (cantidadA_Evaluar >= promo.cantidad_requerida) {
                    const paquetes = Math.floor(cantidadA_Evaluar / promo.cantidad_requerida);
                    const unidadesRegaladas = paquetes * promo.cantidad_regalo;
                    if (promo.grupo_id && !gruposYaDescontados[item.grupo_id]) {
                        descuentoRow = unidadesRegaladas * item.precio_aplicado;
                        msjPromo = `Promo ${promo.cantidad_requerida}x${promo.cantidad_requerida - promo.cantidad_regalo}`;
                        gruposYaDescontados[item.grupo_id] = true;
                    } else if (!promo.grupo_id) {
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

    // Lógicas de Pago Mixto
    const tMixEfe = parseFloat(montosMixtos.efectivo) || 0;
    const tMixTar = parseFloat(montosMixtos.tarjeta) || 0;
    const tMixTra = parseFloat(montosMixtos.transferencia) || 0;
    const sumaMixta = tMixEfe + tMixTar + tMixTra;
    const restanteMixto = totalCobrar - sumaMixta;
    const cambioMixto = sumaMixta > totalCobrar ? sumaMixta - totalCobrar : 0;

    const handleCheckout = async () => {
        if (cartRender.length === 0) return alert(t('carritoVacio'));
        if (!selectedClient) return alert('Por favor, selecciona un paciente o selecciona Público General obligatoriamente.');

        let stringMetodoPago = metodoPago;
        let cashToRegister = 0; 

        if (metodoPago === 'efectivo') {
            if (!montoRecibido || parseFloat(montoRecibido) < totalCobrar) return alert(t('montoInsuficiente'));
            cashToRegister = totalCobrar;
        } else if (metodoPago === 'tarjeta') {
            stringMetodoPago = `Tarjeta (${tipoTarjeta === 'debito' ? t('debito') : t('credito')})`;
        } else if (metodoPago === 'transferencia') {
            if (!folioTransferencia.trim()) return alert(t('folioRequerido'));
            stringMetodoPago = `Transferencia (Folio: ${folioTransferencia.trim()})`;
        } else if (metodoPago === 'mixto') {
            if (sumaMixta < totalCobrar) return alert('El monto total mixto no cubre el total a pagar.');
            
            const efectivoNeto = tMixEfe - cambioMixto;
            if (efectivoNeto < 0) return alert('El cambio supera el monto en efectivo recibido. Revisa las cantidades, no puedes dar cambio de una tarjeta.');

            let desglose = [];
            if (efectivoNeto > 0) desglose.push(`Efe: $${efectivoNeto.toFixed(2)}`);
            // 🚀 FIX: Especificamos el tipo de tarjeta en el mixto
            if (tMixTar > 0) desglose.push(`Tar (${tipoTarjeta === 'debito' ? 'Déb' : 'Cré'}): $${tMixTar.toFixed(2)}`);
            if (tMixTra > 0) desglose.push(`Tra: $${tMixTra.toFixed(2)}${folioTransferencia ? ' f-'+folioTransferencia : ''}`);
            
            stringMetodoPago = `Mixto (${desglose.join(', ')})`;
            cashToRegister = efectivoNeto; 
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

            if (cashToRegister > 0) {
                await supabase.rpc('registrar_movimiento_caja', { p_sucursal_id: sucursalId, p_tipo: 'venta_efectivo', p_monto: cashToRegister, p_motivo: `Venta de mostrador (${stringMetodoPago})` });
            }

            if (metodoPago === 'efectivo') {
                alert(`${t('cobradoExito')} EFECTIVO!\n\n${t('cambio')}: $${(parseFloat(montoRecibido) - totalCobrar).toFixed(2)}`);
            } else if (metodoPago === 'mixto') {
                alert(`${t('cobradoExito')} PAGO MIXTO!\n\n${t('cambio')}: $${cambioMixto.toFixed(2)}`);
            } else {
                alert(`${t('cobradoExito')} ${stringMetodoPago.toUpperCase()}!`);
            }
            
            setCart([]); setSelectedClient(''); setMontoRecibido(''); setFolioTransferencia(''); setMontosMixtos({efectivo:'', tarjeta:'', transferencia:''});
            fetchHistorialHoy();
        }
        
        btn.innerHTML = `<i class="fa-solid fa-cash-register"></i> ${t('cobrar')}`; 
        btn.disabled = false;
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    const filteredCatalog = productosDB.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (p.codigo_barras && p.codigo_barras.includes(searchTerm)));
    const productosAnclados = productosDB.filter(p => p.acceso_rapido);

    return (
        <div className="view-section active" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: '5px' }}>
            
            {/* ÁREA PRINCIPAL POS */}
            <div style={{ display: 'flex', gap: '25px', height: '64vh', minHeight: '560px', flex: '0 0 auto' }}>
                
                {/* PANEL IZQUIERDO (CARRITO) */}
                <div className="panel" style={{ flex: 1.6, display: 'flex', flexDirection: 'column', padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                    
                    {/* INPUTS ESTÉTICOS Y GIGANTES */}
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexShrink: 0 }}>
                        <div style={{position: 'relative', flex: 1}}>
                            <i className="fa-solid fa-barcode" style={{position: 'absolute', left: '20px', top: '18px', color: 'var(--text-muted)', fontSize: '1.2rem'}}></i>
                            <input 
                                ref={scannerInputRef} type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} autoFocus 
                                placeholder={t('placeholderEscanear')} 
                                style={{ width: '100%', padding: '16px 20px 16px 55px', fontSize: '1.2rem', fontWeight: 'bold', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.3s' }} 
                            />
                        </div>
                        <button className="btn-primary" onClick={handleSearch} style={{padding: '0 30px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '1.2rem'}}><i className="fa-solid fa-magnifying-glass"></i></button>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-panel)' }}>
                        <table className="data-table">
                            <thead style={{position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-main)'}}>
                                <tr>
                                    <th style={{padding: '15px'}}>{t('producto')}</th>
                                    <th>{t('tipoPrecio')}</th>
                                    <th>{t('unitario')}</th>
                                    <th style={{textAlign: 'center'}}>{t('cantidadAbrev')}</th>
                                    <th style={{textAlign: 'right'}}>{t('importeNeto')}</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {cartRender.length === 0 ? <tr><td colSpan="6" style={{textAlign: 'center', padding: '60px', color: 'var(--text-muted)'}}><i className="fa-solid fa-basket-shopping fa-3x" style={{marginBottom: '15px', display: 'block', opacity: 0.3}}></i> {t('esperandoLecturas')}</td></tr> : 
                                    cartRender.map((item, idx) => (
                                        <tr key={idx}>
                                            <td style={{padding: '15px'}}>
                                                <strong style={{color: 'var(--text-main)', fontSize: '1.05rem'}}>{item.name}</strong><br/>
                                                {item.msjPromo && <span style={{fontSize:'0.75rem', background:'var(--accent)', color:'white', padding:'3px 8px', borderRadius:'6px', display:'inline-block', marginTop:'5px', fontWeight: 'bold'}}><i className="fa-solid fa-tag"></i> {item.msjPromo}</span>}
                                            </td>
                                            <td>
                                                <select value={item.tipo_precio} onChange={(e) => updatePriceType(item.id, e.target.value)} style={{padding:'8px 12px', borderRadius: '8px', fontSize: '0.9rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', outline: 'none'}}>
                                                    <option value="general">{t('general')}</option>
                                                    <option value="mayoreo">{t('mayoreo')}</option>
                                                    <option value="distribuidor">{t('distribuidor')}</option>
                                                    <option value="medico">{t('precioMedico')}</option>
                                                </select>
                                            </td>
                                            <td style={{color: 'var(--text-main)'}}>${item.precio_aplicado.toFixed(2)}</td>
                                            <td>
                                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: 'var(--bg-main)', padding: '6px', borderRadius: '8px', width: 'max-content', margin: '0 auto'}}>
                                                    <button onClick={() => updateQty(item.id, -1)} style={{background: 'transparent', color: 'var(--text-main)', border: 'none', cursor:'pointer', fontSize: '1.3rem', padding: '0 10px'}}>-</button>
                                                    <span style={{color: 'var(--text-main)', fontWeight: 'bold', width: '30px', textAlign: 'center', fontSize: '1.2rem'}}>{item.qty}</span>
                                                    <button onClick={() => updateQty(item.id, 1)} style={{background: 'transparent', color: 'var(--text-main)', border: 'none', cursor:'pointer', fontSize: '1.3rem', padding: '0 10px'}}>+</button>
                                                </div>
                                            </td>
                                            <td style={{textAlign: 'right'}}>
                                                <div style={{fontWeight:'900', fontSize: '1.1rem', color: item.descuentoRow > 0 ? 'var(--success)' : 'var(--text-main)'}}>${item.importeNeto.toFixed(2)}</div>
                                                {item.descuentoRow > 0 && <div style={{fontSize:'0.8rem', color:'var(--accent)', textDecoration:'line-through'}}>${(item.precio_aplicado * item.qty).toFixed(2)}</div>}
                                            </td>
                                            <td style={{textAlign: 'center'}}><button onClick={() => removeItem(item.id)} className="btn-action" style={{background: 'transparent', color: 'var(--primary-red)', border: 'none', cursor: 'pointer', fontSize: '1.3rem'}}><i className="fa-solid fa-trash-can"></i></button></td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
                
                {/* PANEL DERECHO (AUTO-AJUSTABLE SIN SCROLL EXCESIVO) */}
                <div className="panel" style={{ flex: 1.1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                    
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                        
                        {/* 🚀 AÑADIR RÁPIDO (GRID AJUSTADO PARA NO ALARGARSE) */}
                        <div style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: '120px', marginBottom: '15px'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                                <h3 style={{margin: 0, color: 'var(--text-main)', fontSize: '1rem'}}><i className="fa-solid fa-bolt" style={{color:'var(--accent)', marginRight: '8px'}}></i> {t('anadirRapido')}</h3>
                                <button className="btn-action" onClick={() => { setShowCatalogModal(true); setTimeout(() => scannerInputRef.current?.blur(), 50); }} style={{padding: '6px 12px', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '6px', fontSize: '0.8rem'}}><i className="fa-solid fa-list"></i> {t('verCatalogo')}</button>
                            </div>

                            {productosAnclados.length === 0 ? (
                                <div style={{textAlign:'center', padding:'10px', color:'var(--text-muted)', fontSize:'0.85rem', background:'var(--bg-main)', borderRadius:'12px', border:'1px dashed var(--border-color)'}}>
                                    <i className="fa-regular fa-star" style={{fontSize:'1.2rem', marginBottom:'5px', display:'block'}}></i>
                                    Marca la estrella en el catálogo para anclar.
                                </div>
                            ) : (
                                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(110px, 1fr))', alignContent: 'start', gap:'8px', overflowY: 'auto', paddingRight: '5px', flex: 1}}>
                                    {productosAnclados.map((prod) => (
                                        <div key={prod.id} onClick={() => addToCart(prod)} style={{background:'var(--bg-main)', padding:'10px', borderRadius:'10px', textAlign:'center', cursor:'pointer', border:'1px solid var(--border-color)', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center'}} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                                            <span style={{fontSize:'0.75rem', display:'block', color: 'var(--text-main)', marginBottom: '2px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={prod.nombre}>{prod.nombre}</span>
                                            <span style={{color:'var(--success)', fontWeight:'900', fontSize: '0.9rem'}}>${prod.precio.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* PACIENTE ESTÉTICO Y GIGANTE (SIN DROPDOWN CLIPPED) */}
                        <div style={{marginBottom: '15px', borderTop: '1px dashed var(--border-color)', paddingTop: '15px'}}>
                            <label style={{display: 'block', color: 'var(--text-main)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px', textTransform: 'uppercase'}}>{t('asignarPaciente')} *</label>
                            <div style={{display: 'flex', gap: '10px'}}>
                                <div 
                                    onClick={() => { setShowClientSearchModal(true); setClientSearchTerm(''); }}
                                    style={{ flex: 1, padding: '14px 20px', background: 'var(--bg-main)', color: selectedClient ? 'var(--text-main)' : 'var(--text-muted)', border: selectedClient ? '1px solid var(--accent)' : '1px dashed var(--primary-red)', borderRadius: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.3s' }}
                                >
                                    <span style={{fontSize: '1.05rem', fontWeight: selectedClient ? 'bold' : 'normal'}}>
                                        {selectedClient === 'general' ? t('publicoGeneral') : (selectedClient ? clientesDB.find(c => c.id === selectedClient)?.nombre : '-- Selecciona un paciente --')}
                                    </span>
                                    <i className="fa-solid fa-magnifying-glass" style={{fontSize: '0.9rem', color: 'var(--accent)'}}></i>
                                </div>
                                
                                <button className="btn-action btn-primary" onClick={() => setShowNewClientModal(true)} style={{padding: '0 20px', borderRadius: '12px'}} title={t('registrarPaciente')}><i className="fa-solid fa-user-plus"></i></button>
                            </div>
                        </div>

                        {/* FORMA DE PAGO */}
                        <div>
                            <label style={{display: 'block', color: 'var(--text-main)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px', textTransform: 'uppercase'}}>{t('formaPago')}</label>
                            
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px'}}>
                                <button onClick={() => setMetodoPago('efectivo')} className="btn-action" style={{padding: '10px', borderRadius: '10px', background: metodoPago === 'efectivo' ? 'var(--success)' : 'var(--bg-main)', color: metodoPago === 'efectivo' ? 'white' : 'var(--text-main)', border: metodoPago === 'efectivo' ? 'none' : '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s'}}><i className="fa-solid fa-money-bill-1-wave" style={{marginRight: '5px'}}></i> Efectivo</button>
                                <button onClick={() => setMetodoPago('tarjeta')} className="btn-action" style={{padding: '10px', borderRadius: '10px', background: metodoPago === 'tarjeta' ? 'var(--accent)' : 'var(--bg-main)', color: metodoPago === 'tarjeta' ? 'white' : 'var(--text-main)', border: metodoPago === 'tarjeta' ? 'none' : '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s'}}><i className="fa-solid fa-credit-card" style={{marginRight: '5px'}}></i> Tarjeta</button>
                                <button onClick={() => setMetodoPago('transferencia')} className="btn-action" style={{padding: '10px', borderRadius: '10px', background: metodoPago === 'transferencia' ? '#9333ea' : 'var(--bg-main)', color: metodoPago === 'transferencia' ? 'white' : 'var(--text-main)', border: metodoPago === 'transferencia' ? 'none' : '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s'}}><i className="fa-solid fa-building-columns" style={{marginRight: '5px'}}></i> Transf.</button>
                                <button onClick={() => setMetodoPago('mixto')} className="btn-action" style={{padding: '10px', borderRadius: '10px', background: metodoPago === 'mixto' ? '#eab308' : 'var(--bg-main)', color: metodoPago === 'mixto' ? 'white' : 'var(--text-main)', border: metodoPago === 'mixto' ? 'none' : '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s'}}><i className="fa-solid fa-chart-pie" style={{marginRight: '5px'}}></i> Mixto</button>
                            </div>

                            {/* DETALLES DEL PAGO */}
                            {metodoPago === 'efectivo' && (
                                <div style={{background: 'rgba(22, 163, 74, 0.05)', padding: '15px', borderRadius: '10px', border: '1px solid var(--success)'}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                                        <span style={{color: 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem'}}>{t('montoRecibido')}</span>
                                        <input type="number" value={montoRecibido} onChange={(e) => setMontoRecibido(e.target.value)} placeholder="$ 0.00" 
                                            style={{width: '120px', textAlign: 'right', fontSize: '1.1rem', fontWeight: '900', backgroundColor: 'var(--bg-main)', color: 'var(--success)', border: '1px solid var(--success)', padding: '8px', borderRadius: '8px', outline: 'none'}} />
                                    </div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '900', fontSize: '1.1rem', color: (parseFloat(montoRecibido || 0) >= totalCobrar) ? 'var(--success)' : 'var(--primary-red)'}}>
                                        <span>{t('cambio')}:</span>
                                        <span>${(parseFloat(montoRecibido || 0) >= totalCobrar) ? (parseFloat(montoRecibido) - totalCobrar).toFixed(2) : '0.00'}</span>
                                    </div>
                                </div>
                            )}

                            {metodoPago === 'tarjeta' && (
                                <div style={{background: 'rgba(2, 132, 199, 0.05)', padding: '15px', borderRadius: '10px', border: '1px solid var(--accent)'}}>
                                    <label style={{fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '10px', display: 'block', fontWeight: 'bold'}}>{t('tipoTarjeta')}</label>
                                    <div style={{display: 'flex', gap: '10px'}}>
                                        <button onClick={() => setTipoTarjeta('debito')} className="btn-action" style={{flex: 1, padding: '12px', borderRadius: '8px', background: tipoTarjeta === 'debito' ? 'var(--accent)' : 'var(--bg-main)', color: tipoTarjeta === 'debito' ? 'white' : 'var(--text-main)', border: tipoTarjeta === 'debito' ? 'none' : '1px solid var(--border-color)', fontWeight: 'bold', transition: 'all 0.2s'}}>{t('debito')}</button>
                                        <button onClick={() => setTipoTarjeta('credito')} className="btn-action" style={{flex: 1, padding: '12px', borderRadius: '8px', background: tipoTarjeta === 'credito' ? 'var(--accent)' : 'var(--bg-main)', color: tipoTarjeta === 'credito' ? 'white' : 'var(--text-main)', border: tipoTarjeta === 'credito' ? 'none' : '1px solid var(--border-color)', fontWeight: 'bold', transition: 'all 0.2s'}}>{t('credito')}</button>
                                    </div>
                                </div>
                            )}

                            {metodoPago === 'transferencia' && (
                                <div style={{background: 'rgba(147, 51, 234, 0.05)', padding: '15px', borderRadius: '10px', border: '1px solid #9333ea'}}>
                                    <label style={{fontSize: '0.9rem', color: '#9333ea', display: 'block', marginBottom: '10px', fontWeight: 'bold'}}><i className="fa-solid fa-hashtag"></i> {t('folioTransferencia')}</label>
                                    <input type="text" value={folioTransferencia} onChange={(e) => setFolioTransferencia(e.target.value)} placeholder={t('ingresaFolio')} style={{width: '100%', padding: '14px', border: '1px solid #9333ea', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', borderRadius: '8px', fontSize: '1rem', outline: 'none'}} />
                                </div>
                            )}

                            {/* 🚀 PAGO MIXTO ESTILIZADO CON SELECTOR DE TARJETA */}
                            {metodoPago === 'mixto' && (
                                <div style={{background: 'rgba(234, 179, 8, 0.05)', padding: '15px', borderRadius: '10px', border: '1px solid #eab308'}}>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px'}}>
                                        <div>
                                            <label style={{fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--success)', display: 'block', marginBottom: '4px'}}>Efectivo</label>
                                            <input type="number" value={montosMixtos.efectivo} onChange={e=>setMontosMixtos({...montosMixtos, efectivo: e.target.value})} style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--success)', background: 'var(--bg-main)', color: 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem', outline: 'none'}} placeholder="$0.00" />
                                        </div>
                                        <div>
                                            <label style={{fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--accent)', display: 'block', marginBottom: '4px'}}>Tarjeta</label>
                                            <input type="number" value={montosMixtos.tarjeta} onChange={e=>setMontosMixtos({...montosMixtos, tarjeta: e.target.value})} style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'var(--bg-main)', color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.9rem', outline: 'none'}} placeholder="$0.00" />
                                        </div>
                                        <div>
                                            <label style={{fontSize: '0.7rem', fontWeight: 'bold', color: '#9333ea', display: 'block', marginBottom: '4px'}}>Transf.</label>
                                            <input type="number" value={montosMixtos.transferencia} onChange={e=>setMontosMixtos({...montosMixtos, transferencia: e.target.value})} style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #9333ea', background: 'var(--bg-main)', color: '#9333ea', fontWeight: 'bold', fontSize: '0.9rem', outline: 'none'}} placeholder="$0.00" />
                                        </div>
                                    </div>

                                    {/* Sub-opciones Dinámicas en el Mixto */}
                                    {(parseFloat(montosMixtos.tarjeta) > 0) && (
                                        <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                                            <button onClick={() => setTipoTarjeta('debito')} className="btn-action" style={{flex: 1, padding: '8px', borderRadius: '6px', background: tipoTarjeta === 'debito' ? 'var(--accent)' : 'var(--bg-main)', color: tipoTarjeta === 'debito' ? 'white' : 'var(--text-main)', border: tipoTarjeta === 'debito' ? 'none' : '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '0.8rem'}}>{t('debito')}</button>
                                            <button onClick={() => setTipoTarjeta('credito')} className="btn-action" style={{flex: 1, padding: '8px', borderRadius: '6px', background: tipoTarjeta === 'credito' ? 'var(--accent)' : 'var(--bg-main)', color: tipoTarjeta === 'credito' ? 'white' : 'var(--text-main)', border: tipoTarjeta === 'credito' ? 'none' : '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '0.8rem'}}>{t('credito')}</button>
                                        </div>
                                    )}
                                    
                                    {(parseFloat(montosMixtos.transferencia) > 0) && (
                                        <input type="text" value={folioTransferencia} onChange={(e) => setFolioTransferencia(e.target.value)} placeholder="Folio Transf. (Opcional)" style={{width: '100%', padding: '8px', border: '1px solid #9333ea', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', marginBottom: '10px'}} />
                                    )}

                                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold'}}>
                                        <span style={{color: 'var(--text-muted)'}}>Restante: <strong style={{color: restanteMixto > 0 ? 'var(--primary-red)' : 'var(--success)'}}>${Math.max(0, restanteMixto).toFixed(2)}</strong></span>
                                        <span style={{color: 'var(--text-muted)'}}>{t('cambio')}: <strong style={{color: 'var(--text-main)'}}>${cambioMixto.toFixed(2)}</strong></span>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* TOTALES Y BOTÓN DE COBRO (FIJOS AL FONDO) */}
                    <div style={{ padding: '25px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)', marginTop: 'auto', flexShrink: 0, boxShadow: '0 -4px 20px rgba(0,0,0,0.05)' }}>
                        <div style={{display:'flex', justifyContent:'space-between', color:'var(--text-muted)', marginBottom:'10px', fontSize: '1rem', fontWeight: 'bold'}}><span>{t('subtotal')}</span><span>${subtotalBruto.toFixed(2)}</span></div>
                        <div style={{display:'flex', justifyContent:'space-between', color:'var(--accent)', marginBottom:'15px', fontSize: '1rem', fontWeight: 'bold'}}><span>{t('descuentos')}</span><span>-${totalDescuentos.toFixed(2)}</span></div>
                        
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '15px', borderTop: '1px dashed var(--border-color)'}}>
                            <span style={{fontSize: '1.3rem', color: 'var(--text-main)', fontWeight: 'bold', textTransform: 'uppercase'}}>{t('total')}</span>
                            <span style={{fontSize: '2.8rem', color: 'var(--success)', fontWeight: '900'}}>${totalCobrar.toFixed(2)}</span>
                        </div>
                        
                        <button id="btn-cobrar" onClick={handleCheckout} className="btn-primary" 
                            style={{
                                width:'100%', padding:'20px', border:'none', borderRadius:'12px', 
                                fontSize:'1.4rem', fontWeight:'900', cursor:'pointer', 
                                boxShadow: '0 10px 25px rgba(211, 47, 47, 0.3)', transition: 'all 0.3s ease'
                            }}>
                            <i className="fa-solid fa-cash-register" style={{marginRight: '10px'}}></i> {t('cobrar')}
                        </button>
                    </div>
                </div>
            </div>

            {/* TABLA HISTORIAL DEL DÍA */}
            <div className="panel" style={{ flex: '0 0 auto', marginTop: '25px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{marginBottom: '20px', color: 'var(--text-main)', fontSize: '1.2rem'}}><i className="fa-solid fa-clock-history" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('historialDia')} - {branch.toUpperCase()}</h3>
                <div style={{maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px'}}>
                    <table className="data-table">
                        <thead style={{position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-main)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>
                            <tr>
                                <th style={{padding: '15px 25px'}}>{t('folio')}</th>
                                <th>{t('hora')}</th>
                                <th>{t('clientes')}</th>
                                <th>{t('articulos')}</th>
                                <th>{t('formaPago')}</th>
                                <th>{t('vendedor')}</th>
                                <th style={{textAlign: 'right', paddingRight: '25px'}}>{t('total')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historialHoy.map(venta => (
                                <tr key={venta.id}>
                                    <td style={{fontFamily: 'monospace', color: 'var(--text-muted)', padding: '15px 25px'}}>#{venta.id.toString().padStart(5, '0')}</td>
                                    <td style={{fontSize: '0.85rem', color: 'var(--text-main)'}}>{new Date(venta.fecha).toLocaleTimeString()}</td>
                                    <td><strong style={{color: 'var(--text-main)'}}>{venta.clientes?.nombre || t('publicoGeneral')}</strong></td>
                                    <td>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                            {venta.venta_detalles?.map((d, i) => (
                                                <span key={i} style={{fontSize: '0.85rem', color: 'var(--text-main)'}}><span style={{color:'var(--accent)', fontWeight:'bold'}}>{d.cantidad}x</span> {d.productos?.nombre}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td><span style={{fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '5px 12px', borderRadius: '6px', fontWeight: 'bold'}}>{venta.metodo_pago.toUpperCase()}</span></td>
                                    <td style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>{venta.vendedor_nombre || 'N/A'}</td>
                                    <td style={{color: 'var(--success)', fontWeight: 'bold', textAlign: 'right', fontSize: '1.1rem', paddingRight: '25px'}}>${parseFloat(venta.total).toFixed(2)}</td>
                                </tr>
                            ))}
                            {historialHoy.length === 0 && <tr><td colSpan="7" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-receipt fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('sinDatos') || 'No se han registrado ventas hoy.'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 🚀 MODALES CON EFECTO BLUR (PREMIUM) */}

            {/* 🚀 NUEVO MODAL: BUSCADOR DE PACIENTES */}
            {showClientSearchModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '16px', width: '550px', border: '1px solid var(--accent)', boxShadow: '0 10px 40px rgba(2, 132, 199, 0.15)', textAlign: 'left', display: 'flex', flexDirection: 'column', maxHeight: '80vh'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                            <h3 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-users" style={{color: 'var(--accent)', marginRight: '10px'}}></i> Buscar Paciente</h3>
                            <button onClick={() => { setShowClientSearchModal(false); scannerInputRef.current?.focus(); }} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer'}}>&times;</button>
                        </div>
                        
                        <div style={{position: 'relative', marginBottom: '15px'}}>
                            <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)'}}></i>
                            <input type="text" autoFocus placeholder="Buscar por nombre, CURP o teléfono..." value={clientSearchTerm} onChange={(e) => setClientSearchTerm(e.target.value)} style={{width: '100%', padding: '14px 14px 14px 45px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', outline: 'none'}} />
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px' }}>
                            {t('publicoGeneral').toLowerCase().includes(clientSearchTerm.toLowerCase()) && (
                                <div onClick={() => { setSelectedClient('general'); setShowClientSearchModal(false); scannerInputRef.current?.focus(); }} style={{ padding: '15px', borderRadius: '10px', cursor: 'pointer', color: 'var(--accent)', fontWeight: 'bold', background: 'rgba(2, 132, 199, 0.05)', border: '1px dashed var(--accent)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(2, 132, 199, 0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(2, 132, 199, 0.05)'}>
                                    <i className="fa-solid fa-users" style={{marginRight: '12px', fontSize: '1.2rem'}}></i> {t('publicoGeneral')}
                                </div>
                            )}
                            {clientesDB.filter(c => c.nombre.toLowerCase().includes(clientSearchTerm.toLowerCase()) || (c.telefono && c.telefono.includes(clientSearchTerm)) || (c.curp && c.curp.toLowerCase().includes(clientSearchTerm.toLowerCase()))).map(cli => (
                                <div key={cli.id} onClick={() => { setSelectedClient(cli.id); setShowClientSearchModal(false); scannerInputRef.current?.focus(); }} style={{ padding: '15px', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '1rem', transition: '0.2s', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
                                    <strong style={{display: 'block', marginBottom: '4px'}}>{cli.nombre}</strong>
                                    <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>
                                        <i className="fa-solid fa-phone" style={{marginRight: '5px'}}></i> {cli.telefono || 'Sin teléfono'} <span style={{margin: '0 8px', opacity: 0.3}}>|</span> 
                                        <i className="fa-solid fa-id-card" style={{marginRight: '5px'}}></i> {cli.curp || 'Sin CURP'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DEL CATÁLOGO DE PRODUCTOS */}
            {showCatalogModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{width: '900px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', textAlign: 'left', background: 'var(--bg-panel)', padding: '0', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '25px 30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)'}}>
                            <h3 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-book-open" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('catalogoProductos')}</h3>
                            <button onClick={() => { setShowCatalogModal(false); scannerInputRef.current?.focus(); }} style={{background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'}} onMouseEnter={e => {e.currentTarget.style.color = 'var(--primary-red)'; e.currentTarget.style.borderColor = 'var(--primary-red)';}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)';}}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        
                        <div style={{padding: '20px 30px'}}>
                            <div style={{position: 'relative'}}>
                                <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)'}}></i>
                                <input type="text" placeholder={t('buscarNombreCodigo')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{width:'100%', padding:'14px 14px 14px 45px', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', outline: 'none'}} autoFocus />
                            </div>
                        </div>
                        
                        <div style={{overflowY: 'auto', flex: 1, borderTop: '1px solid var(--border-color)', background: 'var(--bg-panel)'}}>
                            <table className="data-table">
                                <thead style={{position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-main)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>
                                    <tr>
                                        <th style={{textAlign: 'center', padding: '15px'}}><i className="fa-solid fa-star"></i></th>
                                        <th>{t('codigo')}</th>
                                        <th>{t('nombre')}</th>
                                        <th>{t('precio')}</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCatalog.map(p => (
                                        <tr key={p.id}>
                                            <td style={{textAlign: 'center', padding: '15px'}}>
                                                <button onClick={() => toggleAccesoRapido(p)} className="btn-action" style={{background: 'transparent', border: 'none', color: p.acceso_rapido ? '#ffb300' : 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', transition: '0.2s'}}>
                                                    <i className={p.acceso_rapido ? "fa-solid fa-star" : "fa-regular fa-star"}></i>
                                                </button>
                                            </td>
                                            <td style={{color: 'var(--text-muted)', fontFamily: 'monospace'}}>{p.codigo_barras || 'N/A'}</td>
                                            <td style={{color: 'var(--text-main)', fontSize: '1.05rem'}}><strong>{p.nombre}</strong></td>
                                            <td style={{color: 'var(--success)', fontWeight: '900', fontSize: '1.1rem'}}>${p.precio.toFixed(2)}</td>
                                            <td style={{textAlign: 'right', paddingRight: '25px'}}>
                                                <button className="btn-action btn-primary" onClick={() => { addToCart(p); setShowCatalogModal(false); setSearchTerm(''); }} style={{padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.2)'}}>
                                                    <i className="fa-solid fa-plus" style={{marginRight: '8px'}}></i> {t('agregar')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredCatalog.length === 0 && <tr><td colSpan="5" style={{textAlign: 'center', padding: '50px', color: 'var(--text-muted)'}}><i className="fa-solid fa-box-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> No se encontró el insumo.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL REGISTRO DE CLIENTE EXPRÉS */}
            {showNewClientModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '450px', border: '1px solid var(--accent)', boxShadow: '0 10px 40px rgba(2, 132, 199, 0.15)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '25px', color: 'var(--text-main)', fontSize: '1.4rem', textAlign: 'center'}}><i className="fa-solid fa-user-plus" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('registrarPaciente')}</h3>
                        
                        <div style={{marginBottom: '20px'}}>
                            <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('nombreCompleto')} *</label>
                            <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Ej. Juan Pérez" style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', outline: 'none'}} autoFocus />
                        </div>
                        
                        <div style={{marginBottom: '35px'}}>
                            <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('telefono')}</label>
                            <input type="text" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="Opcional" style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', outline: 'none'}} />
                        </div>
                        
                        <div style={{display:'flex', gap:'15px'}}>
                            <button className="btn-action" style={{flex:1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold'}} onClick={() => { setShowNewClientModal(false); scannerInputRef.current?.focus(); }}>{t('cancelar')}</button>
                            <button className="btn-primary" style={{flex:2, padding: '16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}} onClick={guardarClienteExpres}><i className="fa-solid fa-save"></i> {t('guardarSeleccionar')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}