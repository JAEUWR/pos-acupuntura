'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
// IMPORTAMOS EL IDIOMA
import { useLanguage } from '../context/LanguageContext';

export default function Promociones() {
    const { t } = useLanguage(); // Función de traducción

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
        if (!promoName || !startDate || !endDate) return alert(t('llenaCampos'));
        if (targetType === 'producto' && !selectedProd) return alert(t('seleccionaProductoAlert'));
        if (targetType === 'grupo' && !selectedGrupo) return alert(t('seleccionaFamiliaAlert'));

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
        if (error) return alert(`${t('errorCrear')}${error.message}`);

        alert(t('campanaLanzada'));
        setShowModal(false);
        setSelectedProd(''); setSelectedGrupo(''); setPromoName(''); setValue(''); setReqQty(''); setFreeQty(''); setStartDate(''); setEndDate('');
        fetchData();
    };

    const deletePromo = async (id) => {
        if (!window.confirm(t('confirmarBajaCampana'))) return;
        await supabase.from('promociones').delete().eq('id', id);
        fetchData();
    };

    return (
        <div className="view-section active">
            <div className="panel" style={{overflowY: 'auto'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                    <h2><i className="fa-solid fa-tags"></i> {t('panelPromociones')}</h2>
                    <button className="btn-action btn-primary" onClick={() => setShowModal(true)}>+ {t('crearCampana')}</button>
                </div>

                <table className="data-table">
                    <thead><tr><th>{t('campana')}</th><th>{t('aplicaA')}</th><th>{t('mecanica')}</th><th>{t('vigencia')}</th><th>{t('estado')}</th><th></th></tr></thead>
                    <tbody>
                        {promos.map(promo => {
                            const hoy = new Date();
                            const activa = promo.activa && hoy >= new Date(promo.fecha_inicio) && hoy <= new Date(promo.fecha_fin);
                            let mecanica = '';
                            if (promo.tipo_descuento === 'porcentaje') mecanica = `${promo.valor}% Off`;
                            if (promo.tipo_descuento === 'precio_fijo') mecanica = `$${promo.valor} ${t('precioFijo')}`;
                            if (promo.tipo_descuento === 'volumen') mecanica = `${t('lleva')} ${promo.cantidad_requerida}, ${t('gratis')} ${promo.cantidad_regalo}`;
                            
                            const aplicaA = promo.grupo_id ? `${t('familiaDosPuntos')} ${promo.grupos_productos?.nombre}` : `${t('productoDosPuntos')} ${promo.productos?.nombre}`;

                            return (
                                <tr key={promo.id}>
                                    <td><strong>{promo.nombre_promo}</strong></td>
                                    <td><span style={{fontSize:'0.8rem', background:'var(--bg-dark)', padding:'4px 8px', borderRadius:'4px', color: promo.grupo_id ? 'var(--accent)' : 'white'}}>{aplicaA}</span></td>
                                    <td style={{color:'var(--accent)', fontWeight:'bold'}}>{mecanica}</td>
                                    <td style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>{new Date(promo.fecha_inicio).toLocaleDateString()} - {new Date(promo.fecha_fin).toLocaleDateString()}</td>
                                    <td><span style={{padding:'4px 8px', borderRadius:'4px', fontSize:'0.75rem', background: activa ? '#0f3a1c' : '#222'}}>{activa ? t('vigente') : t('inactiva')}</span></td>
                                    <td><button className="btn-action" onClick={() => deletePromo(promo.id)}><i className="fa-solid fa-trash" style={{color:'var(--primary-red)'}}></i></button></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '450px'}}>
                        <h3>{t('nuevaPromocion')}</h3>
                        
                        <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                            <button className={`btn-action ${targetType === 'producto' ? 'btn-primary' : ''}`} style={{flex: 1}} onClick={() => setTargetType('producto')}>{t('porProducto')}</button>
                            <button className={`btn-action ${targetType === 'grupo' ? 'btn-primary' : ''}`} style={{flex: 1}} onClick={() => setTargetType('grupo')}>{t('porFamilia')}</button>
                        </div>

                        {targetType === 'producto' ? (
                            <select value={selectedProd} onChange={(e) => setSelectedProd(e.target.value)} style={{width:'100%', padding:'10px', marginTop:'15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}}>
                                <option value="">{t('seleccionaProducto')}</option>
                                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        ) : (
                            <select value={selectedGrupo} onChange={(e) => setSelectedGrupo(e.target.value)} style={{width:'100%', padding:'10px', marginTop:'15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}}>
                                <option value="">{t('seleccionaFamilia')}</option>
                                {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                            </select>
                        )}
                        
                        <input type="text" value={promoName} onChange={(e) => setPromoName(e.target.value)} placeholder={t('nombrePromocionEjemplo')} style={{width:'100%', padding:'10px', margin:'10px 0', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} />

                        <div style={{margin:'10px 0'}}>
                            <label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{t('esquemaDescuento')}</label>
                            <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}}>
                                <option value="porcentaje">{t('porcentaje')}</option>
                                <option value="precio_fijo">{t('precioFijo')}</option>
                                <option value="volumen">{t('porVolumen')}</option>
                            </select>
                        </div>

                        {discountType === 'volumen' ? (
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                                <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{t('llevaTotal')}</label><input type="number" value={reqQty} onChange={(e) => setReqQty(e.target.value)} placeholder={t('ej3')} style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} /></div>
                                <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{t('descuentaGratis')}</label><input type="number" value={freeQty} onChange={(e) => setFreeQty(e.target.value)} placeholder={t('ej1')} style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} /></div>
                            </div>
                        ) : (
                            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('valorDescuento')} style={{width:'100%', padding:'10px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} />
                        )}

                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'20px'}}>
                            <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{t('inicio')}</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} /></div>
                            <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{t('fin')}</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)', borderRadius:'6px'}} /></div>
                        </div>

                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1}} onClick={handleCreatePromo}>{t('lanzarOferta')}</button>
                            <button className="btn-action" style={{flex:1}} onClick={() => setShowModal(false)}>{t('cancelar')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}