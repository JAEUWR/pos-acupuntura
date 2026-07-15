'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Promociones() {
    const [promos, setPromos] = useState([]);
    const [productos, setProductos] = useState([]);
    const [showModal, setShowModal] = useState(false);

    const [selectedProd, setSelectedProd] = useState('');
    const [promoName, setPromoName] = useState('');
    const [discountType, setDiscountType] = useState('porcentaje');
    const [value, setValue] = useState('');
    const [reqQty, setReqQty] = useState('');
    const [freeQty, setFreeQty] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchData = async () => {
        const { data: pData } = await supabase.from('promociones').select('*, productos(nombre)').order('fecha_fin', { ascending: true });
        if (pData) setPromos(pData);

        const { data: prodData } = await supabase.from('productos').select('id, nombre');
        if (prodData) setProductos(prodData);
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreatePromo = async () => {
        if (!selectedProd || !promoName || !startDate || !endDate) return alert('Llena los campos obligatorios.');

        const payload = {
            producto_id: parseInt(selectedProd),
            nombre_promo: promoName.trim(),
            tipo_descuento: discountType,
            valor: discountType === 'volumen' ? 0 : parseFloat(value),
            cantidad_requerida: discountType === 'volumen' ? parseInt(reqQty) : 0,
            cantidad_regalo: discountType === 'volumen' ? parseInt(freeQty) : 0,
            fecha_inicio: startDate,
            fecha_fin: endDate
        };

        const { error } = await supabase.from('promociones').insert([payload]);
        if (error) return alert('Error al crear: ' + error.message);

        alert('Promoción programada exitosamente.');
        setShowModal(false);
        setSelectedProd(''); setPromoName(''); setValue(''); setReqQty(''); setFreeQty(''); setStartDate(''); setEndDate('');
        fetchData();
    };

    const deletePromo = async (id) => {
        if (!window.confirm('¿Deseas dar de baja esta campaña?')) return;
        await supabase.from('promociones').delete().eq('id', id);
        fetchData();
    };

    return (
        <div className="view-section active">
            <div className="panel" style={{overflowY: 'auto'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                    <h2><i className="fa-solid fa-tags"></i> Panel de Promociones</h2>
                    <button className="btn-action btn-primary" onClick={() => setShowModal(true)}>+ Crear Campaña</button>
                </div>

                <table className="data-table">
                    <thead>
                        <tr><th>Campaña</th><th>Artículo</th><th>Mecánica</th><th>Vigencia</th><th>Estado</th><th></th></tr>
                    </thead>
                    <tbody>
                        {promos.map(promo => {
                            const hoy = new Date();
                            const activa = promo.activa && hoy >= new Date(promo.fecha_inicio) && hoy <= new Date(promo.fecha_fin);
                            let mecanica = '';
                            if (promo.tipo_descuento === 'porcentaje') mecanica = `${promo.valor}% Off`;
                            if (promo.tipo_descuento === 'precio_fijo') mecanica = `$${promo.valor} Precio Fijo`;
                            if (promo.tipo_descuento === 'volumen') mecanica = `Lleva ${promo.cantidad_requerida}, Gratis ${promo.cantidad_regalo}`;

                            return (
                                <tr key={promo.id}>
                                    <td><strong>{promo.nombre_promo}</strong></td>
                                    <td>{promo.productos?.nombre}</td>
                                    <td style={{color:'var(--accent)', fontWeight:'bold'}}>{mecanica}</td>
                                    <td style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>{new Date(promo.fecha_inicio).toLocaleDateString()} - {new Date(promo.fecha_fin).toLocaleDateString()}</td>
                                    <td>
                                        <span style={{padding:'4px 8px', borderRadius:'4px', fontSize:'0.75rem', background: activa ? '#0f3a1c' : '#222'}}>
                                            {activa ? 'VIGENTE' : 'INACTIVA'}
                                        </span>
                                    </td>
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
                        <h3>Nueva Promoción</h3>
                        <select value={selectedProd} onChange={(e) => setSelectedProd(e.target.value)} style={{width:'100%', padding:'10px', marginTop:'15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)'}}>
                            <option value="">-- Selecciona el Producto --</option>
                            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                        <input type="text" value={promoName} onChange={(e) => setPromoName(e.target.value)} placeholder="Nombre (Ej. 3x2 en Parches)" style={{width:'100%', padding:'10px', margin:'10px 0', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)'}} />

                        <div style={{margin:'10px 0'}}>
                            <label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Esquema de Descuento:</label>
                            <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)'}}>
                                <option value="porcentaje">Porcentaje (%)</option>
                                <option value="precio_fijo">Precio Fijo ($)</option>
                                <option value="volumen">Por Volumen (Ej. 3x2)</option>
                            </select>
                        </div>

                        {discountType === 'volumen' ? (
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                                <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Lleva (Cantidad):</label><input type="number" value={reqQty} onChange={(e) => setReqQty(e.target.value)} placeholder="Ej. 3" style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)'}} /></div>
                                <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Gratis (Regalo):</label><input type="number" value={freeQty} onChange={(e) => setFreeQty(e.target.value)} placeholder="Ej. 1" style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)'}} /></div>
                            </div>
                        ) : (
                            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valor del descuento" style={{width:'100%', padding:'10px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)'}} />
                        )}

                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'20px'}}>
                            <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Inicio:</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)'}} /></div>
                            <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Fin:</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{width:'100%', padding:'10px', background:'var(--bg-dark)', color:'white', border:'1px solid var(--border-color)'}} /></div>
                        </div>

                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1}} onClick={handleCreatePromo}>Lanzar Oferta</button>
                            <button className="btn-action" style={{flex:1}} onClick={() => setShowModal(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}