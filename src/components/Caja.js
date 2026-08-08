'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Caja({ branch = 'napoles' }) {
    const { t } = useLanguage();
    const [saldo, setSaldo] = useState(0);
    const [movimientos, setMovimientos] = useState([]);
    
    // Estados para Movimiento Manual
    const [showModal, setShowModal] = useState(false);
    const [tipoMovimiento, setTipoMovimiento] = useState('ingreso'); // 'ingreso' | 'retiro'
    const [montoManual, setMontoManual] = useState('');
    const [motivoManual, setMotivoManual] = useState('');

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const fetchCaja = async () => {
        // 1. Obtener Saldo Actual
        const { data: caja } = await supabase.from('cajas_estado').select('saldo_actual').eq('sucursal_id', sucursalId).single();
        if (caja) setSaldo(parseFloat(caja.saldo_actual));

        // 2. Obtener movimientos de hoy
        const hoy = new Date().toISOString().split('T')[0];
        const { data: movs } = await supabase.from('movimientos_caja')
            .select('*')
            .eq('sucursal_id', sucursalId)
            .gte('fecha', `${hoy}T00:00:00`)
            .order('fecha', { ascending: false });
        if (movs) setMovimientos(movs);
    };

    useEffect(() => { fetchCaja(); }, [branch]);

    const registrarMovimiento = async () => {
        if (!montoManual || isNaN(montoManual) || parseFloat(montoManual) <= 0) return alert('Monto inválido.');
        if (!motivoManual) return alert('Debes especificar un motivo.');

        const montoFormateado = tipoMovimiento === 'ingreso' ? parseFloat(montoManual) : -parseFloat(montoManual);

        if (tipoMovimiento === 'retiro' && parseFloat(montoManual) > saldo) {
            return alert('No hay suficiente efectivo en caja para este retiro.');
        }

        const { error } = await supabase.rpc('registrar_movimiento_caja', {
            p_sucursal_id: sucursalId,
            p_tipo: tipoMovimiento === 'ingreso' ? 'ingreso_manual' : 'retiro_manual',
            p_monto: montoFormateado,
            p_motivo: motivoManual.trim()
        });

        if (error) alert('Error: ' + error.message);
        else {
            setShowModal(false); setMontoManual(''); setMotivoManual('');
            fetchCaja();
        }
    };

    const hacerCorteCaja = async () => {
        if (saldo <= 0) return alert('La caja ya está vacía.');
        if (!window.confirm(t('confirmarCorte'))) return;

        const { error } = await supabase.rpc('registrar_movimiento_caja', {
            p_sucursal_id: sucursalId,
            p_tipo: 'corte_caja',
            p_monto: -saldo, // Retira todo el dinero
            p_motivo: 'Corte de Caja Diario'
        });

        if (error) alert('Error: ' + error.message);
        else {
            alert(t('corteExitoso'));
            fetchCaja();
            // Opcional: Imprimir un ticket en PDF
            window.print();
        }
    };

    const getEtiqueta = (tipo) => {
        if (tipo === 'venta_efectivo') return <span style={{color: 'var(--success)'}}>{t('ventaEfectivo')}</span>;
        if (tipo === 'ingreso_manual') return <span style={{color: '#00b0ff'}}>{t('ingresoManual')}</span>;
        if (tipo === 'retiro_manual') return <span style={{color: '#ffb300'}}>{t('retiroManual')}</span>;
        if (tipo === 'corte_caja') return <span style={{color: 'var(--primary-red)', fontWeight: 'bold'}}>{t('corteDeCaja')}</span>;
        return tipo;
    };

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '20px'}}>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px'}}>
                {/* PANEL IZQUIERDO: SALDO Y ACCIONES */}
                <div className="panel" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '12px'}}>
                    <i className="fa-solid fa-cash-register" style={{fontSize: '3rem', color: 'var(--success)', marginBottom: '15px'}}></i>
                    <h3 style={{color: 'var(--text-muted)', margin: 0}}>{t('saldoActual')}</h3>
                    <h1 style={{fontSize: '3.5rem', margin: '10px 0', color: 'white'}}>${saldo.toFixed(2)}</h1>
                    <span style={{color: 'var(--accent)', fontSize: '0.9rem', marginBottom: '30px'}}>{branch.toUpperCase()}</span>

                    <div style={{display: 'flex', width: '100%', gap: '10px', marginBottom: '15px'}}>
                        <button className="btn-action" onClick={() => {setTipoMovimiento('ingreso'); setShowModal(true);}} style={{flex: 1, background: '#00b0ff11', color: '#00b0ff', border: '1px solid #00b0ff'}}><i className="fa-solid fa-arrow-down-to-line"></i> {t('ingresarEfectivo')}</button>
                        <button className="btn-action" onClick={() => {setTipoMovimiento('retiro'); setShowModal(true);}} style={{flex: 1, background: '#ffb30011', color: '#ffb300', border: '1px solid #ffb300'}}><i className="fa-solid fa-arrow-up-from-bracket"></i> {t('retirarEfectivo')}</button>
                    </div>

                    <button className="pay-btn" onClick={hacerCorteCaja} style={{width: '100%', padding: '15px', background: 'var(--primary-red)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer'}}>
                        <i className="fa-solid fa-scissors"></i> {t('hacerCorte')}
                    </button>
                </div>

                {/* PANEL DERECHO: HISTORIAL DEL DÍA */}
                <div className="panel" style={{background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '25px', display: 'flex', flexDirection: 'column'}}>
                    <h2 style={{marginBottom: '15px'}}><i className="fa-solid fa-list-check" style={{color: 'var(--accent)'}}></i> {t('movimientosHoy')}</h2>
                    <div style={{flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px'}}>
                        <table className="data-table">
                            <thead style={{position: 'sticky', top: 0, background: 'var(--bg-dark)'}}>
                                <tr><th>{t('fechaHora')}</th><th>{t('tipoMovimiento')}</th><th>{t('motivo')}</th><th style={{textAlign:'right'}}>{t('importe')}</th></tr>
                            </thead>
                            <tbody>
                                {movimientos.map(mov => (
                                    <tr key={mov.id}>
                                        <td style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>{new Date(mov.fecha).toLocaleTimeString()}</td>
                                        <td>{getEtiqueta(mov.tipo)}</td>
                                        <td>{mov.motivo}</td>
                                        <td style={{textAlign: 'right', fontWeight: 'bold', color: mov.monto > 0 ? 'var(--success)' : 'var(--primary-red)'}}>
                                            {mov.monto > 0 ? '+' : ''}{parseFloat(mov.monto).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                                {movimientos.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>{t('sinDatos')}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL INGRESOS Y RETIROS MANUALES */}
            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', width: '400px'}}>
                        <h3 style={{marginBottom: '20px', color: tipoMovimiento === 'ingreso' ? '#00b0ff' : '#ffb300'}}>
                            {tipoMovimiento === 'ingreso' ? <><i className="fa-solid fa-arrow-down-to-line"></i> {t('ingresoManual')}</> : <><i className="fa-solid fa-arrow-up-from-bracket"></i> {t('retiroManual')}</>}
                        </h3>
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('monto')} ($)</label>
                        <input type="number" value={montoManual} onChange={(e) => setMontoManual(e.target.value)} placeholder="0.00" style={{width:'100%', padding:'12px', marginBottom:'15px', background:'var(--bg-dark)', color:'white', border: `1px solid ${tipoMovimiento === 'ingreso' ? '#00b0ff' : '#ffb300'}`, borderRadius: '6px', fontSize: '1.2rem', fontWeight: 'bold'}} />
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t('motivo')}</label>
                        <input type="text" value={motivoManual} onChange={(e) => setMotivoManual(e.target.value)} placeholder={tipoMovimiento === 'ingreso' ? 'Ej. Fondo para dar cambio' : 'Ej. Pago de garrafones de agua'} style={{width:'100%', padding:'10px', marginBottom:'20px', background:'var(--bg-dark)', color:'white', border: '1px solid var(--border-color)', borderRadius: '6px'}} />
                        
                        <div style={{display:'flex', gap:'10px'}}>
                            <button className="btn-action btn-primary" style={{flex:1, padding: '12px'}} onClick={registrarMovimiento}>Guardar Movimiento</button>
                            <button className="btn-action" style={{flex:1, padding: '12px'}} onClick={() => setShowModal(false)}>{t('cancelar')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}