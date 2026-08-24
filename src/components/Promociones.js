'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Promociones() {
    const { t } = useLanguage(); 

    const [promos, setPromos] = useState([]);
    const [productos, setProductos] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [showModal, setShowModal] = useState(false);

    // Selector dual
    const [targetType, setTargetType] = useState('producto'); // 'producto' o 'grupo'
    const [selectedProd, setSelectedProd] = useState('');
    const [selectedGrupo, setSelectedGrupo] = useState('');
    
    const [promoName, setPromoName] = useState('');
    const [discountType, setDiscountType] = useState('porcentaje');
    const [value, setValue] = useState('');
    const [reqQty, setReqQty] = useState('');
    const [freeQty, setFreeQty] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchData = async () => {
        const { data: pData } = await supabase.from('promociones').select('*, productos(nombre), grupos_productos(nombre)').order('fecha_fin', { ascending: true });
        if (pData) setPromos(pData);

        const { data: prodData } = await supabase.from('productos').select('id, nombre');
        if (prodData) setProductos(prodData);

        const { data: gData } = await supabase.from('grupos_productos').select('*');
        if (gData) setGrupos(gData);
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreatePromo = async () => {
        if (!promoName || !startDate || !endDate) return alert(t('llenaCampos') || 'Llena todos los campos requeridos.');
        if (targetType === 'producto' && !selectedProd) return alert(t('seleccionaProductoAlert') || 'Selecciona un producto.');
        if (targetType === 'grupo' && !selectedGrupo) return alert(t('seleccionaFamiliaAlert') || 'Selecciona una familia.');

        const payload = {
            nombre_promo: promoName.trim(),
            producto_id: targetType === 'producto' ? parseInt(selectedProd) : null,
            grupo_id: targetType === 'grupo' ? parseInt(selectedGrupo) : null,
            tipo_descuento: discountType,
            valor: discountType === 'volumen' ? 0 : parseFloat(value),
            cantidad_requerida: discountType === 'volumen' ? parseInt(reqQty) : 0,
            cantidad_regalo: discountType === 'volumen' ? parseInt(freeQty) : 0,
            fecha_inicio: startDate,
            fecha_fin: endDate
        };

        const { error } = await supabase.from('promociones').insert([payload]);
        if (error) return alert(`${t('errorCrear') || 'Error al crear:'} ${error.message}`);

        alert(t('campanaLanzada') || 'Campaña lanzada exitosamente.');
        setShowModal(false);
        setSelectedProd(''); setSelectedGrupo(''); setPromoName(''); setValue(''); setReqQty(''); setFreeQty(''); setStartDate(''); setEndDate('');
        fetchData();
    };

    const deletePromo = async (id) => {
        if (!window.confirm(t('confirmarBajaCampana') || '¿Confirmas dar de baja esta campaña?')) return;
        await supabase.from('promociones').delete().eq('id', id);
        fetchData();
    };

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '25px', overflowY: 'auto', paddingRight: '5px'}}>
            
            {/* PANEL PRINCIPAL: TABLA DE PROMOCIONES */}
            <div className="panel" style={{padding: 0, borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column'}}>
                
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding: '25px 30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)'}}>
                    <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-tags" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('panelPromociones') || 'Promociones Activas'}</h2>
                    <button className="btn-primary" onClick={() => setShowModal(true)} style={{padding: '12px 25px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'}}>
                        <i className="fa-solid fa-plus" style={{marginRight: '8px'}}></i> {t('crearCampana') || 'Crear Campaña'}
                    </button>
                </div>

                <div style={{overflowX: 'auto'}}>
                    <table className="data-table" style={{minWidth: '900px'}}>
                        <thead style={{background: 'var(--bg-panel)'}}>
                            <tr>
                                <th style={{padding: '15px 30px'}}>{t('campana') || 'Campaña'}</th>
                                <th>{t('aplicaA') || 'Aplica A'}</th>
                                <th>{t('mecanica') || 'Mecánica'}</th>
                                <th>{t('vigencia') || 'Vigencia'}</th>
                                <th>{t('estado') || 'Estado'}</th>
                                <th style={{textAlign: 'center'}}><i className="fa-solid fa-gear"></i></th>
                            </tr>
                        </thead>
                        <tbody>
                            {promos.map(promo => {
                                const hoy = new Date();
                                const activa = promo.activa && hoy >= new Date(promo.fecha_inicio) && hoy <= new Date(promo.fecha_fin);
                                
                                let mecanica = '';
                                if (promo.tipo_descuento === 'porcentaje') mecanica = `${promo.valor}% OFF`;
                                if (promo.tipo_descuento === 'precio_fijo') mecanica = `$${promo.valor} ${t('precioFijo') || 'Neto'}`;
                                if (promo.tipo_descuento === 'volumen') mecanica = `${t('lleva') || 'Lleva'} ${promo.cantidad_requerida}, ${t('gratis') || 'Gratis'} ${promo.cantidad_regalo}`;
                                
                                const aplicaA = promo.grupo_id 
                                    ? <span style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', padding: '5px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(2, 132, 199, 0.2)'}}><i className="fa-solid fa-layer-group"></i> Familia: {promo.grupos_productos?.nombre}</span>
                                    : <span style={{background: 'rgba(255, 179, 0, 0.1)', color: '#ea580c', padding: '5px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(255, 179, 0, 0.2)'}}><i className="fa-solid fa-box"></i> Prod: {promo.productos?.nombre}</span>;

                                return (
                                    <tr key={promo.id}>
                                        <td style={{padding: '15px 30px'}}>
                                            <strong style={{color: 'var(--text-main)', fontSize: '1.05rem'}}>{promo.nombre_promo}</strong>
                                        </td>
                                        <td>{aplicaA}</td>
                                        <td>
                                            <span style={{color: 'var(--accent)', fontWeight: 'bold', background: 'var(--bg-main)', padding: '5px 12px', borderRadius: '8px', border: '1px dashed var(--border-color)'}}>
                                                {mecanica}
                                            </span>
                                        </td>
                                        <td style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>
                                            <i className="fa-regular fa-calendar" style={{marginRight: '5px'}}></i>
                                            {new Date(promo.fecha_inicio).toLocaleDateString()} &rarr; {new Date(promo.fecha_fin).toLocaleDateString()}
                                        </td>
                                        <td>
                                            {activa 
                                                ? <span style={{background: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(22, 163, 74, 0.3)'}}><i className="fa-solid fa-circle-check"></i> {t('vigente') || 'Vigente'}</span>
                                                : <span style={{background: 'rgba(211, 47, 47, 0.1)', color: 'var(--primary-red)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(211, 47, 47, 0.3)'}}><i className="fa-solid fa-circle-xmark"></i> {t('inactiva') || 'Inactiva'}</span>
                                            }
                                        </td>
                                        <td style={{textAlign: 'center'}}>
                                            <button className="btn-action" onClick={() => deletePromo(promo.id)} style={{background: 'transparent', color: 'var(--primary-red)', border: '1px solid transparent', transition: 'all 0.2s', padding: '8px 12px'}} onMouseEnter={e => e.currentTarget.style.border = '1px solid var(--primary-red)'} onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'} title="Eliminar Campaña">
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {promos.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', padding: '50px', color: 'var(--text-muted)'}}><i className="fa-solid fa-ticket fa-3x" style={{marginBottom: '15px', opacity: 0.3, display: 'block'}}></i> No hay campañas promocionales activas.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL CREAR PROMOCIÓN (GLASSMORPHISM) */}
            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '500px', border: '1px solid var(--accent)', boxShadow: '0 10px 40px rgba(2, 132, 199, 0.15)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '25px', color: 'var(--text-main)', fontSize: '1.4rem', textAlign: 'center'}}><i className="fa-solid fa-wand-magic-sparkles" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('nuevaPromocion') || 'Lanzar Nueva Campaña'}</h3>
                        
                        {/* SELECTOR DUAL ESTILO iOS */}
                        <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '25px' }}>
                            <button 
                                onClick={() => setTargetType('producto')}
                                style={{flex: 1, background: targetType === 'producto' ? 'var(--bg-panel)' : 'transparent', color: targetType === 'producto' ? 'var(--accent)' : 'var(--text-muted)', border: 'none', boxShadow: targetType === 'producto' ? 'var(--shadow-sm)' : 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold', transition: 'all 0.3s', cursor: 'pointer'}} 
                            >
                                <i className="fa-solid fa-box"></i> {t('porProducto') || 'Por Producto'}
                            </button>
                            <button 
                                onClick={() => setTargetType('grupo')}
                                style={{flex: 1, background: targetType === 'grupo' ? 'var(--bg-panel)' : 'transparent', color: targetType === 'grupo' ? 'var(--accent)' : 'var(--text-muted)', border: 'none', boxShadow: targetType === 'grupo' ? 'var(--shadow-sm)' : 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold', transition: 'all 0.3s', cursor: 'pointer'}} 
                            >
                                <i className="fa-solid fa-layer-group"></i> {t('porFamilia') || 'Por Familia'}
                            </button>
                        </div>

                        <div style={{marginBottom: '20px'}}>
                            {targetType === 'producto' ? (
                                <>
                                    <label style={{display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold'}}>{t('seleccionaProducto') || 'Selecciona un Producto'} *</label>
                                    <select value={selectedProd} onChange={(e) => setSelectedProd(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'10px', fontSize: '1rem', outline: 'none'}}>
                                        <option value="">-- Seleccionar --</option>
                                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                    </select>
                                </>
                            ) : (
                                <>
                                    <label style={{display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold'}}>{t('seleccionaFamilia') || 'Selecciona una Familia'} *</label>
                                    <select value={selectedGrupo} onChange={(e) => setSelectedGrupo(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'10px', fontSize: '1rem', outline: 'none'}}>
                                        <option value="">-- Seleccionar --</option>
                                        {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                                    </select>
                                </>
                            )}
                        </div>
                        
                        <div style={{marginBottom: '20px'}}>
                            <label style={{display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold'}}>{t('nombrePromocionEjemplo') || 'Nombre Comercial de la Promoción'} *</label>
                            <input type="text" value={promoName} onChange={(e) => setPromoName(e.target.value)} placeholder="Ej. Buen Fin, Día de las Madres..." style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'10px', fontSize: '1rem'}} />
                        </div>

                        <div style={{background: 'rgba(2, 132, 199, 0.05)', padding: '20px', borderRadius: '12px', border: '1px dashed var(--accent)', marginBottom: '25px'}}>
                            <label style={{display: 'block', fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '10px', fontWeight: 'bold', textTransform: 'uppercase'}}><i className="fa-solid fa-percent"></i> {t('esquemaDescuento') || 'Esquema de Descuento'}</label>
                            <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'8px', marginBottom: '15px', fontSize: '1rem', outline: 'none'}}>
                                <option value="porcentaje">{t('porcentaje') || 'Porcentaje de Descuento (%)'}</option>
                                <option value="precio_fijo">{t('precioFijo') || 'Precio Fijo / Neto ($)'}</option>
                                <option value="volumen">{t('porVolumen') || 'Promoción por Volumen (N x M)'}</option>
                            </select>

                            {discountType === 'volumen' ? (
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                                    <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)', display: 'block', marginBottom: '5px'}}>{t('llevaTotal') || 'Pagas (Cant.)'}</label><input type="number" value={reqQty} onChange={(e) => setReqQty(e.target.value)} placeholder="Ej. 3" style={{width:'100%', padding:'12px', background:'var(--bg-panel)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'6px', textAlign: 'center'}} /></div>
                                    <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)', display: 'block', marginBottom: '5px'}}>{t('descuentaGratis') || 'Gratis (Cant.)'}</label><input type="number" value={freeQty} onChange={(e) => setFreeQty(e.target.value)} placeholder="Ej. 1" style={{width:'100%', padding:'12px', background:'var(--bg-panel)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'6px', textAlign: 'center'}} /></div>
                                </div>
                            ) : (
                                <div>
                                    <label style={{fontSize:'0.8rem', color:'var(--text-muted)', display: 'block', marginBottom: '5px'}}>{discountType === 'porcentaje' ? 'Porcentaje a descontar' : 'Precio final al público'}</label>
                                    <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('valorDescuento') || "0.00"} style={{width:'100%', padding:'12px', background:'var(--bg-panel)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'6px', fontSize: '1.1rem', fontWeight: 'bold'}} />
                                </div>
                            )}
                        </div>

                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'30px'}}>
                            <div>
                                <label style={{fontSize:'0.85rem', color:'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('inicio') || 'Fecha de Inicio'} *</label>
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'10px', outline: 'none', cursor: 'pointer'}} />
                            </div>
                            <div>
                                <label style={{fontSize:'0.85rem', color:'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('fin') || 'Fecha de Fin'} *</label>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'10px', outline: 'none', cursor: 'pointer'}} />
                            </div>
                        </div>

                        <div style={{display:'flex', gap:'15px'}}>
                            <button className="btn-action" style={{flex:1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold'}} onClick={() => setShowModal(false)}>{t('cancelar') || 'Cancelar'}</button>
                            <button className="btn-primary" style={{flex:2, padding: '16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}} onClick={handleCreatePromo}><i className="fa-solid fa-rocket"></i> {t('lanzarOferta') || 'Lanzar Campaña'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}