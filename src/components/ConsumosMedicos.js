'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function ConsumosMedicos({ branch = 'napoles' }) {
    const { t } = useLanguage();
    const [subVista, setSubVista] = useState('registro'); 
    
    const [doctores, setDoctores] = useState([]);
    
    // Estados para "Registro" (Carrito)
    const [barcode, setBarcode] = useState('');
    const [cart, setCart] = useState([]);
    const [productosDB, setProductosDB] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const scannerInputRef = useRef(null);

    // Estados para el Catálogo Manual
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Estados para "Doctores" (CRUD)
    const [showModalDoctor, setShowModalDoctor] = useState(false);
    const [newDocName, setNewDocName] = useState('');
    const [newDocSpec, setNewDocSpec] = useState('');
    const [newDocPhone, setNewDocPhone] = useState('');

    // Estados para "Reportes"
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [reporteConsumos, setReporteConsumos] = useState([]);
    const [filterDoctorId, setFilterDoctorId] = useState('all');

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const fetchDatosGlobales = async () => {
        const { data: docs } = await supabase.from('doctores').select('*').order('nombre');
        if (docs) setDoctores(docs);

        // Extraemos los productos y su estado 'activo'
        const { data: inv } = await supabase
            .from('inventario')
            .select('stock, productos(id, codigo_barras, nombre, activo, acceso_rapido)')
            .eq('sucursal_id', sucursalId);
            
        if (inv) {
            // FILTRAMOS SOLO LOS ACTIVOS antes de guardarlos en el catálogo del médico
            const prodsConStock = inv
                .filter(i => i.productos && i.productos.activo !== false)
                .map(i => ({
                    ...i.productos,
                    stock: i.stock
                }));
            setProductosDB(prodsConStock);
        }
    };

    // Refrescar los datos si cambias de sucursal
    useEffect(() => { fetchDatosGlobales(); setCart([]); }, [sucursalId]);
    
    // Escáner Fantasma
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const activeElement = document.activeElement;
            const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');
            if (!isInputFocused && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && subVista === 'registro') {
                scannerInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [subVista]);

    const addToCartManual = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            const currentQty = existing ? existing.qty : 0;
            
            // VALIDACIÓN DE STOCK
            if (currentQty + 1 > product.stock) {
                alert(`${t('stockInsuficiente') || '¡Stock insuficiente! Solo quedan'} ${product.stock} ${t('unidadesDe') || 'unidades de'} ${product.nombre} ${t('enLugar') || 'en'} ${branch.toUpperCase()}.`);
                return prev;
            }
            
            if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            return [...prev, { id: product.id, code: product.codigo_barras, name: product.nombre, qty: 1, maxStock: product.stock }];
        });
        setShowCatalogModal(false);
        setSearchTerm('');
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    const handleSearch = () => {
        const targetCode = barcode.trim();
        if (!targetCode) return;
        const product = productosDB.find(p => p.codigo_barras === targetCode);
        if (product) {
            addToCartManual(product);
            setBarcode('');
        } else {
            alert(`${t('codigoNoRegistrado') || 'Código no registrado en esta sucursal:'} "${targetCode}"`);
            setBarcode('');
        }
    };

    const updateQty = (id, delta) => setCart(prev => prev.map(item => {
        if (item.id === id) {
            const newQty = item.qty + delta;
            // VALIDACIÓN DE STOCK EN EL CARRITO
            if (newQty > item.maxStock) {
                alert(`${t('limiteAlcanzado') || 'Límite alcanzado: Solo hay'} ${item.maxStock} ${t('disponibles') || 'disponibles.'}`);
                return item;
            }
            if (newQty > 0) return { ...item, qty: newQty };
        }
        return item;
    }));

    const removeItem = (id) => setCart(prev => prev.filter(item => item.id !== id));

    const registrarConsumo = async () => {
        if (cart.length === 0) return alert(t('carritoVacio') || 'El carrito está vacío.');
        if (!selectedDoctor) return alert(t('seleccionaDoctorAlert') || 'Selecciona un doctor de la lista.');

        const btn = document.getElementById('btn-consumo');
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('procesando') || 'Procesando...'}`;
        btn.disabled = true;

        const payloadItems = cart.map(item => ({ producto_id: item.id, qty: item.qty }));

        const { error } = await supabase.rpc('procesar_consumo_medico', { 
            p_doctor_id: parseInt(selectedDoctor), 
            p_sucursal_id: sucursalId, 
            p_items: payloadItems 
        });

        if (error) {
            alert((t('atencion') || 'Atención: ') + error.message);
        } else {
            alert(t('consumoRegistrado') || 'Salida de inventario registrada con éxito.');
            setCart([]); setSelectedDoctor('');
            fetchDatosGlobales(); // Actualizar el stock en memoria inmediatamente
        }
        
        btn.innerHTML = `<i class="fa-solid fa-hand-holding-medical"></i> ${t('registrarSalida') || 'Registrar Salida'}`; 
        btn.disabled = false;
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    const guardarDoctor = async () => {
        if (!newDocName) return;
        const { error } = await supabase.from('doctores').insert([{ nombre: newDocName, especialidad: newDocSpec, telefono: newDocPhone }]);
        if (error) alert((t('error') || 'Error: ') + error.message);
        else {
            setShowModalDoctor(false); setNewDocName(''); setNewDocSpec(''); setNewDocPhone('');
            fetchDatosGlobales();
        }
    };

    const fetchReportes = async () => {
        let query = supabase.from('consumos_medicos').select(`
            id, fecha,
            doctores ( nombre, especialidad ),
            consumos_detalles ( cantidad, productos ( nombre ) )
        `).gte('fecha', `${startDate}T00:00:00`).lte('fecha', `${endDate}T23:59:59`).eq('sucursal_id', sucursalId).order('fecha', { ascending: false });

        if (filterDoctorId !== 'all') query = query.eq('doctor_id', filterDoctorId);

        const { data, error } = await query;
        if (!error && data) setReporteConsumos(data);
    };

    useEffect(() => { if (subVista === 'reportes') fetchReportes(); }, [subVista, startDate, endDate, filterDoctorId, sucursalId]);

    const exportarReporte = () => {
        if (reporteConsumos.length === 0) return alert(t('noDatosExportar') || 'No hay datos para exportar.');
        const headers = [t('folio') || 'Folio', t('fechaHora') || 'Fecha y Hora', (t('empleado') || 'Empleado') + " (Doctor)", (t('articulosEntregados') || 'Artículos Entregados') + "\n"];
        const rows = reporteConsumos.map(c => [
            `#${c.id.toString().padStart(5, '0')}`,
            new Date(c.fecha).toLocaleString(),
            c.doctores?.nombre || 'N/A',
            c.consumos_detalles?.map(d => `${d.cantidad}x ${d.productos?.nombre}`).join(' | ')
        ]);
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => `"${e[0]}","${e[1]}","${e[2]}","${e[3]}"`)].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `Reporte_Consumo_${branch}_${startDate}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const filteredCatalog = productosDB.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.codigo_barras?.includes(searchTerm));
    const productosRapidos = productosDB.filter(p => p.acceso_rapido);

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '20px', paddingRight: '5px'}}>
            
            {/* MENÚ SUPERIOR */}
            <div style={{display: 'flex', gap: '15px', background: 'var(--bg-panel)', padding: '15px 25px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                <button className={`btn-action ${subVista === 'registro' ? 'btn-primary' : ''}`} onClick={() => setSubVista('registro')} style={{padding: '12px 20px', borderRadius: '30px', fontWeight: 'bold'}}><i className="fa-solid fa-barcode"></i> {t('registroConsumo') || 'Salida de Material'}</button>
                <button className={`btn-action ${subVista === 'doctores' ? 'btn-primary' : ''}`} onClick={() => setSubVista('doctores')} style={{padding: '12px 20px', borderRadius: '30px', fontWeight: 'bold'}}><i className="fa-solid fa-user-doctor"></i> {t('directorioTerapeutas') || 'Terapeutas'}</button>
                <button className={`btn-action ${subVista === 'reportes' ? 'btn-primary' : ''}`} onClick={() => setSubVista('reportes')} style={{padding: '12px 20px', borderRadius: '30px', fontWeight: 'bold'}}><i className="fa-solid fa-clipboard-list"></i> {t('reportesConsumo') || 'Reportes de Salida'}</button>
            </div>

            {/* VISTA 1: REGISTRO DE SALIDA DE MATERIAL (CARRITO) */}
            {subVista === 'registro' && (
                <div style={{display: 'flex', gap: '25px', height: '65vh', minHeight: '520px'}}>
                    
                    {/* PANEL IZQUIERDO: BÚSQUEDA Y CARRITO */}
                    <div className="panel" style={{display: 'flex', flexDirection: 'column', padding: '25px', flex: 2, borderRadius: '16px', boxShadow: 'var(--shadow-sm)'}}>
                        
                        {/* Buscador Integrado */}
                        <div style={{display: 'flex', gap: '15px', marginBottom: '20px', flexShrink: 0}}>
                            <div style={{position: 'relative', flex: 1}}>
                                <i className="fa-solid fa-barcode" style={{position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)'}}></i>
                                <input 
                                    ref={scannerInputRef} 
                                    type="text" 
                                    value={barcode} 
                                    onChange={(e) => setBarcode(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
                                    placeholder={t('placeholderEscanear') || '[Listo para escanear] Pasa el código de barras...'} 
                                    style={{width: '100%', padding: '14px 14px 14px 45px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', transition: 'all 0.3s'}} 
                                />
                            </div>
                            <button className="btn-action btn-primary" onClick={handleSearch} style={{padding: '0 25px', borderRadius: '10px'}}><i className="fa-solid fa-plus"></i></button>
                        </div>
                        
                        {/* Tabla del Carrito */}
                        <div style={{flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-panel)'}}>
                            <table className="data-table">
                                <thead style={{background: 'var(--bg-main)', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>
                                    <tr>
                                        <th style={{padding: '15px 20px'}}>{t('producto') || 'Producto / Insumo'}</th>
                                        <th style={{textAlign:'center'}}>{t('cantidadAbrev') || 'Cant.'}</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.length === 0 ? <tr><td colSpan="3" style={{textAlign: 'center', padding: '50px', color: 'var(--text-muted)'}}><i className="fa-solid fa-box-open fa-2x" style={{marginBottom: '10px', display: 'block', opacity: 0.5}}></i> {t('agregaInsumos') || 'Agrega insumos para registrar salida.'}</td></tr> : 
                                        cart.map((item, idx) => (
                                            <tr key={idx}>
                                                <td style={{padding: '15px 20px'}}>
                                                    <strong style={{color: 'var(--text-main)', fontSize: '1.05rem'}}>{item.name}</strong><br/>
                                                    <span style={{fontSize:'0.8rem', color:'var(--text-muted)', fontFamily: 'monospace'}}>{item.code}</span>
                                                </td>
                                                <td>
                                                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--bg-main)', padding: '6px', borderRadius: '8px', width: 'max-content', margin: '0 auto'}}>
                                                        <button onClick={() => updateQty(item.id, -1)} style={{background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', width: '28px', height: '28px', borderRadius: '4px', cursor:'pointer'}}>-</button>
                                                        <span style={{fontWeight: 'bold', width: '25px', textAlign: 'center', color: 'var(--text-main)', fontSize: '1.1rem'}}>{item.qty}</span>
                                                        <button onClick={() => updateQty(item.id, 1)} style={{background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', width: '28px', height: '28px', borderRadius: '4px', cursor:'pointer'}}>+</button>
                                                    </div>
                                                </td>
                                                <td style={{textAlign: 'right', paddingRight: '20px'}}>
                                                    <button onClick={() => removeItem(item.id)} className="btn-action" style={{background: 'transparent', color: 'var(--primary-red)', border: 'none', cursor: 'pointer', fontSize: '1.2rem'}}><i className="fa-solid fa-trash-can"></i></button>
                                                </td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    {/* PANEL DERECHO: AÑADIR RÁPIDO Y CONFIRMACIÓN */}
                    <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '20px'}}>
                        
                        {/* SECCIÓN AÑADIR RÁPIDO */}
                        <div className="panel" style={{flex: 1, padding: '25px', borderRadius: '16px', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-sm)'}}>
                            <h3 style={{marginBottom:'15px', color: 'var(--text-main)', fontSize: '1.1rem'}}><i className="fa-solid fa-bolt" style={{color:'var(--accent)'}}></i> {t('anadirRapido') || 'Añadir Rápido'}</h3>
                            
                            {productosRapidos.length === 0 ? (
                                <div style={{textAlign:'center', padding:'20px', color:'var(--text-muted)', fontSize:'0.85rem', background:'var(--bg-main)', borderRadius:'10px', border:'1px dashed var(--border-color)'}}>
                                    <i className="fa-regular fa-star" style={{fontSize:'1.5rem', marginBottom:'8px', display:'block'}}></i>
                                    {t('marcaEstrella') || 'Marca la estrella en el inventario para anclar insumos aquí.'}
                                </div>
                            ) : (
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', overflowY: 'auto', paddingRight: '5px', maxHeight: '180px'}}>
                                    {productosRapidos.map((prod) => (
                                        <div key={prod.id} onClick={() => addToCartManual(prod)} style={{background:'var(--bg-main)', padding:'12px', borderRadius:'10px', textAlign:'center', cursor:'pointer', border:'1px solid var(--border-color)', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'}} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                                            <span style={{fontSize:'0.85rem', display:'block', color: 'var(--text-main)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={prod.nombre}>{prod.nombre}</span>
                                            <span style={{color:'var(--text-muted)', fontSize: '0.75rem', marginTop: '5px', display: 'block'}}><i className="fa-solid fa-box"></i> {prod.stock} {t('disp') || 'Disp.'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button className="btn-action" onClick={() => { setShowCatalogModal(true); setTimeout(() => scannerInputRef.current?.blur(), 50); }} style={{width: '100%', marginTop: 'auto', padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold'}}><i className="fa-solid fa-list" style={{marginRight: '8px'}}></i> {t('verCatalogoCompleto') || 'Ver Catálogo Completo'}</button>
                        </div>

                        {/* SECCIÓN DOCTOR Y REGISTRO */}
                        <div className="panel" style={{padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)'}}>
                            <h3 style={{marginBottom: '20px', color: 'var(--text-main)', fontSize: '1.1rem'}}><i className="fa-solid fa-user-doctor" style={{color: 'var(--accent)'}}></i> {t('terapeutaAsignado') || 'Terapeuta Asignado'}</h3>
                            
                            <select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)} style={{width: '100%', padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '20px', fontSize: '1rem', outline: 'none'}}>
                                <option value="">-- {t('seleccionaQuienRetira') || 'Selecciona quién retira'} --</option>
                                {doctores.map(doc => <option key={doc.id} value={doc.id}>{doc.nombre} - {doc.especialidad}</option>)}
                            </select>

                            <div style={{background: 'rgba(255, 179, 0, 0.05)', padding: '15px', borderRadius: '10px', border: '1px dashed #ffb300', marginBottom: '25px'}}>
                                <p style={{fontSize: '0.8rem', color: '#ffb300', margin: 0, textAlign: 'center'}}><i className="fa-solid fa-triangle-exclamation"></i> {t('accionDescontaraInventario') || 'Esta acción descontará el inventario en'} <b>{branch.toUpperCase()}</b> {t('noGeneraraIngresos') || 'pero no generará ingresos financieros.'}</p>
                            </div>
                            
                            <button id="btn-consumo" onClick={registrarConsumo} className="btn-primary" style={{width:'100%', padding:'18px', border:'none', borderRadius:'10px', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer', boxShadow: '0 4px 15px rgba(2, 132, 199, 0.3)'}}>
                                <i className="fa-solid fa-hand-holding-medical"></i> {t('registrarSalida') || 'Registrar Salida'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VISTA 2: DIRECTORIO DE DOCTORES */}
            {subVista === 'doctores' && (
                <div className="panel" style={{padding: 0, borderRadius: '16px', overflow: 'hidden'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '25px 30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)'}}>
                        <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-address-book" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('directorioTerapeutas') || 'Directorio de Terapeutas'}</h2>
                        <button className="btn-primary" onClick={() => setShowModalDoctor(true)} style={{padding: '12px 25px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'}}>
                            <i className="fa-solid fa-plus" style={{marginRight: '8px'}}></i> {t('nuevoTerapeuta') || 'Nuevo Terapeuta'}
                        </button>
                    </div>
                    <table className="data-table">
                        <thead style={{background: 'var(--bg-panel)'}}>
                            <tr>
                                <th style={{padding: '15px 30px'}}>{t('nombreCompleto') || 'Nombre Completo'}</th>
                                <th>{t('especialidad') || 'Especialidad'}</th>
                                <th>{t('telefono') || 'Teléfono'}</th>
                                <th>{t('estado') || 'Estado'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {doctores.map(doc => (
                                <tr key={doc.id}>
                                    <td style={{padding: '15px 30px'}}><strong style={{color: 'var(--text-main)', fontSize: '1.05rem'}}>{doc.nombre}</strong></td>
                                    <td><span style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', padding: '5px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold'}}>{doc.especialidad || (t('general') || 'General')}</span></td>
                                    <td style={{color: 'var(--text-main)'}}>{doc.telefono || t('sinTelefono')}</td>
                                    <td>
                                        {doc.activo 
                                            ? <span style={{background: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(22, 163, 74, 0.3)'}}><i className="fa-solid fa-circle-check"></i> {t('activo') || 'Activo'}</span>
                                            : <span style={{background: 'rgba(211, 47, 47, 0.1)', color: 'var(--primary-red)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(211, 47, 47, 0.3)'}}><i className="fa-solid fa-circle-xmark"></i> {t('inactivo') || 'Inactivo'}</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                            {doctores.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-user-doctor fa-2x" style={{marginBottom: '10px', display: 'block', opacity: 0.5}}></i> {t('noDoctores') || 'No hay doctores registrados.'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {/* VISTA 3: REPORTES DE CONSUMO */}
            {subVista === 'reportes' && (
                <div className="panel" style={{padding: 0, borderRadius: '16px', overflow: 'hidden'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '25px 30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)'}}>
                        <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-clipboard-list" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('historialSalidas') || 'Historial de Salidas'} - {branch.toUpperCase()}</h2>
                        <button className="btn-action" onClick={exportarReporte} style={{background: 'rgba(46, 125, 50, 0.1)', color: 'var(--success)', border: '1px solid var(--success)', fontWeight: 'bold', padding: '12px 20px', borderRadius: '10px'}}><i className="fa-solid fa-file-excel" style={{marginRight: '8px'}}></i> {t('excelCsv') || 'Exportar CSV'}</button>
                    </div>
                    
                    <div style={{display: 'flex', gap: '20px', background: 'var(--bg-panel)', padding: '25px 30px', borderBottom: '1px solid var(--border-color)'}}>
                        <div style={{flex: 1}}>
                            <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('fechaInicio') || 'Desde'}</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{width: '100%', padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none', cursor: 'pointer'}} />
                        </div>
                        <div style={{flex: 1}}>
                            <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('fechaFin') || 'Hasta'}</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{width: '100%', padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none', cursor: 'pointer'}} />
                        </div>
                        <div style={{flex: 2}}>
                            <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('filtrarTerapeuta') || 'Filtrar por Terapeuta'}</label>
                            <select value={filterDoctorId} onChange={(e) => setFilterDoctorId(e.target.value)} style={{width: '100%', padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none'}}>
                                <option value="all">{t('todosTerapeutas') || 'Todos los Terapeutas'}</option>
                                {doctores.map(doc => <option key={doc.id} value={doc.id}>{doc.nombre}</option>)}
                            </select>
                        </div>
                    </div>

                    <table className="data-table">
                        <thead style={{background: 'var(--bg-main)'}}>
                            <tr>
                                <th style={{padding: '15px 30px'}}>{t('folio') || 'Folio'}</th>
                                <th>{t('fechaHora') || 'Fecha y Hora'}</th>
                                <th>Terapeuta</th>
                                <th>{t('materialRetirado') || 'Material Retirado'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reporteConsumos.map(c => (
                                <tr key={c.id}>
                                    <td style={{fontFamily: 'monospace', color: 'var(--text-muted)', padding: '15px 30px'}}>#{c.id.toString().padStart(5, '0')}</td>
                                    <td style={{fontSize: '0.85rem', color: 'var(--text-main)'}}>{new Date(c.fecha).toLocaleString()}</td>
                                    <td><strong style={{color: 'var(--text-main)'}}>{c.doctores?.nombre}</strong></td>
                                    <td>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                            {c.consumos_detalles?.map((d, i) => (
                                                <span key={i} style={{fontSize: '0.9rem', color: 'var(--text-main)'}}>
                                                    <span style={{background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--accent)', fontWeight: 'bold', marginRight: '5px'}}>{d.cantidad}x</span> 
                                                    {d.productos?.nombre}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {reporteConsumos.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-folder-open fa-2x" style={{marginBottom: '10px', display: 'block', opacity: 0.5}}></i> {t('noSalidas') || 'No se encontraron salidas en este periodo.'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODALES DESENFOCADOS (GLASSMORPHISM) */}

            {/* MODAL NUEVO DOCTOR */}
            {showModalDoctor && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '450px', border: '1px solid var(--accent)', boxShadow: '0 10px 40px rgba(2, 132, 199, 0.15)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '25px', color: 'var(--text-main)', fontSize: '1.4rem', textAlign: 'center'}}><i className="fa-solid fa-stethoscope" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('registrarTerapeuta') || 'Registrar Terapeuta'}</h3>
                        
                        <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('nombreCompleto') || 'Nombre Completo'} *</label>
                        <input type="text" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="Ej. Dr. Juan Pérez" style={{width:'100%', padding:'14px', marginBottom:'20px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem'}} />
                        
                        <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('especialidad') || 'Especialidad'} *</label>
                        <input type="text" value={newDocSpec} onChange={(e) => setNewDocSpec(e.target.value)} placeholder={t('ejAcupunturista') || 'Ej. Acupunturista'} style={{width:'100%', padding:'14px', marginBottom:'20px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem'}} />
                        
                        <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('telefono') || 'Teléfono'}</label>
                        <input type="text" value={newDocPhone} onChange={(e) => setNewDocPhone(e.target.value)} placeholder={t('opcional') || 'Opcional'} style={{width:'100%', padding:'14px', marginBottom:'30px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem'}} />
                        
                        <div style={{display:'flex', gap:'15px'}}>
                            <button className="btn-action" style={{flex:1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold'}} onClick={() => setShowModalDoctor(false)}>{t('cancelar') || 'Cancelar'}</button>
                            <button className="btn-primary" style={{flex:1, padding: '16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}} onClick={guardarDoctor}><i className="fa-solid fa-save"></i> {t('guardar') || 'Guardar'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CATÁLOGO MANUAL (Para seleccionar sin escáner) */}
            {showCatalogModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '0', borderRadius: '16px', width: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)'}}>
                        
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '25px 30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)'}}>
                            <h3 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.3rem'}}><i className="fa-solid fa-book-open" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('catalogoInsumos') || 'Catálogo de Insumos'}</h3>
                            <button onClick={() => { setShowCatalogModal(false); scannerInputRef.current?.focus(); }} style={{background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'}} onMouseEnter={e => {e.currentTarget.style.color = 'var(--primary-red)'; e.currentTarget.style.borderColor = 'var(--primary-red)';}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)';}}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        
                        <div style={{padding: '20px 30px'}}>
                            <div style={{position: 'relative'}}>
                                <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)'}}></i>
                                <input type="text" placeholder={t('buscarNombreCodigo') || 'Buscar por nombre o código de barras...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{width:'100%', padding:'14px 14px 14px 45px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '1rem', outline: 'none'}} />
                            </div>
                        </div>

                        <div style={{overflowY: 'auto', flex: 1, borderTop: '1px solid var(--border-color)', background: 'var(--bg-panel)'}}>
                            <table className="data-table">
                                <thead style={{position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>
                                    <tr>
                                        <th style={{padding: '15px 30px'}}>{t('codigo')}</th>
                                        <th>{t('nombre')}</th>
                                        <th style={{textAlign: 'center'}}>{t('disp') || 'Disp.'}</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCatalog.map(p => (
                                        <tr key={p.id}>
                                            <td style={{color: 'var(--text-muted)', fontFamily: 'monospace', padding: '15px 30px'}}>{p.codigo_barras}</td>
                                            <td><strong style={{color: 'var(--text-main)', fontSize: '0.95rem'}}>{p.nombre}</strong></td>
                                            <td style={{textAlign: 'center', color: p.stock > 0 ? 'var(--success)' : 'var(--primary-red)', fontWeight: 'bold', fontSize: '1.1rem'}}>{p.stock}</td>
                                            <td style={{textAlign: 'right', paddingRight: '20px'}}>
                                                <button className="btn-action btn-primary" onClick={() => addToCartManual(p)} style={{padding: '8px 15px', borderRadius: '8px', fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.2)'}}>
                                                    <i className="fa-solid fa-plus"></i> {t('anadir') || 'Añadir'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredCatalog.length === 0 && <tr><td colSpan="4" style={{textAlign:'center', color:'var(--text-muted)', padding: '40px'}}><i className="fa-solid fa-box-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('noInsumo') || 'No se encontró el insumo.'}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}