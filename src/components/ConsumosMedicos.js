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
            .select('stock, productos(id, codigo_barras, nombre, activo)')
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
    useEffect(() => { if (subVista === 'registro') scannerInputRef.current?.focus(); }, [subVista]);

    const addToCartManual = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            const currentQty = existing ? existing.qty : 0;
            
            // VALIDACIÓN DE STOCK
            if (currentQty + 1 > product.stock) {
                alert(`¡Stock insuficiente! Solo quedan ${product.stock} unidades de ${product.nombre} en ${branch.toUpperCase()}.`);
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
            alert(`Código "${targetCode}" no registrado en esta sucursal.`);
            setBarcode('');
        }
    };

    const updateQty = (id, delta) => setCart(prev => prev.map(item => {
        if (item.id === id) {
            const newQty = item.qty + delta;
            // VALIDACIÓN DE STOCK EN EL CARRITO
            if (newQty > item.maxStock) {
                alert(`Límite alcanzado: Solo hay ${item.maxStock} disponibles.`);
                return item;
            }
            if (newQty > 0) return { ...item, qty: newQty };
        }
        return item;
    }));

    const removeItem = (id) => setCart(prev => prev.filter(item => item.id !== id));

    const registrarConsumo = async () => {
        if (cart.length === 0) return alert(t('carritoVacio'));
        if (!selectedDoctor) return alert(t('seleccionaDoctorAlert') || 'Selecciona un doctor.');

        const btn = document.getElementById('btn-consumo');
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('procesando')}`;
        btn.disabled = true;

        const payloadItems = cart.map(item => ({ producto_id: item.id, qty: item.qty }));

        const { error } = await supabase.rpc('procesar_consumo_medico', { 
            p_doctor_id: parseInt(selectedDoctor), 
            p_sucursal_id: sucursalId, 
            p_items: payloadItems 
        });

        if (error) {
            alert('Atención: ' + error.message);
        } else {
            alert(t('consumoRegistrado'));
            setCart([]); setSelectedDoctor('');
            fetchDatosGlobales(); // Actualizar el stock en memoria inmediatamente
        }
        
        btn.innerHTML = `<i class="fa-solid fa-hand-holding-medical"></i> ${t('registrarSalida')}`; 
        btn.disabled = false;
        setTimeout(() => scannerInputRef.current?.focus(), 50);
    };

    const guardarDoctor = async () => {
        if (!newDocName) return;
        const { error } = await supabase.from('doctores').insert([{ nombre: newDocName, especialidad: newDocSpec, telefono: newDocPhone }]);
        if (error) alert('Error: ' + error.message);
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
        if (reporteConsumos.length === 0) return alert(t('noDatosExportar'));
        const headers = [t('folio'), t('fechaHora'), t('empleado') + " (Doctor)", t('articulosEntregados') + "\n"];
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

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '15px'}}>
            <div style={{display: 'flex', gap: '10px', background: 'var(--bg-panel)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                <button className={`btn-action ${subVista === 'registro' ? 'btn-primary' : ''}`} onClick={() => setSubVista('registro')}><i className="fa-solid fa-barcode"></i> {t('registroConsumo')}</button>
                <button className={`btn-action ${subVista === 'doctores' ? 'btn-primary' : ''}`} onClick={() => setSubVista('doctores')}><i className="fa-solid fa-user-doctor"></i> {t('directorioDoctores')}</button>
                <button className={`btn-action ${subVista === 'reportes' ? 'btn-primary' : ''}`} onClick={() => setSubVista('reportes')}><i className="fa-solid fa-clipboard-list"></i> {t('reportesConsumo')}</button>
            </div>

            {subVista === 'registro' && (
                <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', height: '100%'}}>
                    <div className="panel" style={{display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden'}}>
                        <div style={{padding: '20px', borderBottom: '1px solid var(--border-color)'}}>
                            <div style={{display: 'flex', gap: '10px'}}>
                                <input ref={scannerInputRef} type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder={t('placeholderEscanear')} style={{flex:1, padding:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '8px'}} />
                                <button className="btn-action btn-primary" onClick={handleSearch}><i className="fa-solid fa-plus"></i></button>
                                <button className="btn-action" onClick={() => { setShowCatalogModal(true); setTimeout(() => scannerInputRef.current?.blur(), 50); }} style={{background: 'var(--bg-lighter)', color: 'white', border: '1px solid var(--border-color)', padding: '0 20px'}}><i className="fa-solid fa-list" style={{marginRight: '8px'}}></i> {t('verCatalogo')}</button>
                            </div>
                        </div>
                        <div style={{flex: 1, overflowY: 'auto', padding: '20px'}}>
                            <table className="data-table">
                                <thead><tr><th>{t('producto')}</th><th style={{textAlign:'center'}}>{t('cantidadAbrev')}</th><th></th></tr></thead>
                                <tbody>
                                    {cart.length === 0 ? <tr><td colSpan="3" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>{t('esperandoLecturas')}</td></tr> : 
                                        cart.map((item, idx) => (
                                            <tr key={idx}>
                                                <td><strong>{item.name}</strong><br/><span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>{item.code}</span></td>
                                                <td>
                                                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
                                                        <button onClick={() => updateQty(item.id, -1)} style={{background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', width: '28px', height: '28px', borderRadius: '4px', cursor:'pointer'}}>-</button>
                                                        <span style={{fontWeight: 'bold', width: '20px', textAlign: 'center'}}>{item.qty}</span>
                                                        <button onClick={() => updateQty(item.id, 1)} style={{background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', width: '28px', height: '28px', borderRadius: '4px', cursor:'pointer'}}>+</button>
                                                    </div>
                                                </td>
                                                <td style={{textAlign: 'right'}}><button onClick={() => removeItem(item.id)} style={{background: 'transparent', color: 'var(--primary-red)', border: 'none', cursor: 'pointer', fontSize: '1.2rem'}}><i className="fa-solid fa-trash-can"></i></button></td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="panel" style={{display: 'flex', flexDirection: 'column'}}>
                        <h3 style={{marginBottom: '20px', color: 'var(--accent)'}}><i className="fa-solid fa-user-doctor"></i> Terapeuta Asignado</h3>
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block'}}>{t('seleccionaDoctor')}</label>
                        <select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)} style={{width: '100%', padding: '15px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '20px', fontSize: '1rem'}}>
                            <option value="">{t('seleccionaDoctor')}</option>
                            {doctores.map(doc => <option key={doc.id} value={doc.id}>{doc.nombre} - {doc.especialidad}</option>)}
                        </select>

                        <div style={{marginTop: 'auto', background: 'rgba(255, 179, 0, 0.1)', padding: '15px', borderRadius: '8px', border: '1px dashed #ffb300', marginBottom: '20px'}}>
                            <p style={{fontSize: '0.8rem', color: '#ffb300', margin: 0, textAlign: 'center'}}><i className="fa-solid fa-triangle-exclamation"></i> Esta acción descontará el inventario en <b>{branch.toUpperCase()}</b> pero no generará ingresos monetarios.</p>
                        </div>
                        
                        <button id="btn-consumo" onClick={registrarConsumo} className="pay-btn" style={{width:'100%', padding:'20px', background:'#1b5e20', color:'white', border:'none', borderRadius:'8px', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer'}}><i className="fa-solid fa-hand-holding-medical"></i> {t('registrarSalida')}</button>
                    </div>
                </div>
            )}

            {subVista === 'doctores' && (
                <div className="panel">
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
                        <h2><i className="fa-solid fa-address-book"></i> {t('directorioDoctores')}</h2>
                        <button className="btn-action btn-primary" onClick={() => setShowModalDoctor(true)}>+ {t('nuevoDoctor')}</button>
                    </div>
                    <table className="data-table">
                        <thead><tr><th>{t('nombreCompleto')}</th><th>{t('especialidad')}</th><th>{t('telefono')}</th><th>{t('estado')}</th></tr></thead>
                        <tbody>
                            {doctores.map(doc => (
                                <tr key={doc.id}>
                                    <td><strong>{doc.nombre}</strong></td>
                                    <td style={{color: 'var(--accent)'}}>{doc.especialidad || 'General'}</td>
                                    <td>{doc.telefono || t('sinTelefono')}</td>
                                    <td><span style={{padding:'4px 8px', borderRadius:'4px', fontSize:'0.75rem', background: doc.activo ? '#0f3a1c' : '#3a0f0f'}}>{doc.activo ? t('activo') : t('inactiva')}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {subVista === 'reportes' && (
                <div className="panel">
                    <h2><i className="fa-solid fa-file-contract"></i> {t('historialDoctores')} - {branch.toUpperCase()}</h2>
                    
                    <div style={{display: 'flex', gap: '15px', background: 'var(--bg-dark)', padding: '15px', borderRadius: '8px', marginBottom: '20px', alignItems: 'flex-end'}}>
                        <div style={{flex: 1}}>
                            <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block'}}>{t('fechaInicio')}</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{width: '100%', padding: '10px', background: 'var(--bg-panel)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        </div>
                        <div style={{flex: 1}}>
                            <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block'}}>{t('fechaFin')}</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{width: '100%', padding: '10px', background: 'var(--bg-panel)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        </div>
                        <div style={{flex: 1}}>
                            <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block'}}>{t('seleccionaDoctor')}</label>
                            <select value={filterDoctorId} onChange={(e) => setFilterDoctorId(e.target.value)} style={{width: '100%', padding: '10px', background: 'var(--bg-panel)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                                <option value="all">{t('todasGlobal')}</option>
                                {doctores.map(doc => <option key={doc.id} value={doc.id}>{doc.nombre}</option>)}
                            </select>
                        </div>
                        <button className="btn-action" onClick={exportarReporte} style={{background: '#1e3d26', border: '1px solid #2e7d32', height: '42px'}}><i className="fa-solid fa-file-excel" style={{color: 'var(--success)', marginRight: '8px'}}></i> {t('excelCsv')}</button>
                    </div>

                    <table className="data-table">
                        <thead><tr><th>{t('folio')}</th><th>{t('fechaHora')}</th><th>Doctor</th><th>{t('articulosEntregados')}</th></tr></thead>
                        <tbody>
                            {reporteConsumos.map(c => (
                                <tr key={c.id}>
                                    <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{c.id.toString().padStart(5, '0')}</td>
                                    <td style={{fontSize: '0.85rem'}}>{new Date(c.fecha).toLocaleString()}</td>
                                    <td><strong>{c.doctores?.nombre}</strong></td>
                                    <td>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                            {c.consumos_detalles?.map((d, i) => (
                                                <span key={i} style={{fontSize: '0.85rem'}}><b style={{color: 'var(--accent)'}}>{d.cantidad}x</b> {d.productos?.nombre}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {reporteConsumos.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', color: 'var(--text-muted)'}}>{t('sinDatos')}</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL NUEVO DOCTOR */}
            {showModalDoctor && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '400px'}}>
                        <h3 style={{marginBottom: '20px'}}><i className="fa-solid fa-stethoscope"></i> {t('crearDoctor')}</h3>
                        <input type="text" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder={t('nombreCompleto')} style={{width:'100%', padding:'10px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <input type="text" value={newDocSpec} onChange={(e) => setNewDocSpec(e.target.value)} placeholder={`${t('especialidad')} (Ej. Acupunturista)`} style={{width:'100%', padding:'10px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <input type="text" value={newDocPhone} onChange={(e) => setNewDocPhone(e.target.value)} placeholder={t('telefono')} style={{width:'100%', padding:'10px', marginBottom:'20px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1}} onClick={guardarDoctor}>{t('agregar')}</button>
                            <button className="btn-action" style={{flex:1}} onClick={() => setShowModalDoctor(false)}>{t('cancelar')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CATÁLOGO MANUAL (Para seleccionar sin escáner) */}
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
                                <thead><tr><th>{t('codigo')}</th><th>{t('nombre')}</th><th>Stock</th><th></th></tr></thead>
                                <tbody>
                                    {filteredCatalog.map(p => (
                                        <tr key={p.id}>
                                            <td style={{color: 'var(--text-muted)'}}>{p.codigo_barras}</td>
                                            <td><strong>{p.nombre}</strong></td>
                                            <td style={{color: p.stock > 0 ? 'var(--success)' : 'var(--primary-red)', fontWeight: 'bold'}}>{p.stock}</td>
                                            <td style={{textAlign: 'right'}}><button className="btn-action btn-primary" onClick={() => addToCartManual(p)} style={{padding: '6px 12px', fontSize: '0.9rem'}}>{t('agregar')}</button></td>
                                        </tr>
                                    ))}
                                    {filteredCatalog.length === 0 && <tr><td colSpan="4" style={{textAlign:'center', color:'var(--text-muted)'}}>{t('sinDatos')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}