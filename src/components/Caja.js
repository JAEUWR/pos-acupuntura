'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Caja({ branch = 'napoles' }) {
    const { t } = useLanguage();
    const [saldo, setSaldo] = useState(0);
    const [movimientos, setMovimientos] = useState([]);
    
    // Historial Global de Movimientos
    const [historialGlobal, setHistorialGlobal] = useState([]);
    
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

        // 3. Obtener el historial global (limitado a 500)
        const { data: histGlobal } = await supabase.from('movimientos_caja')
            .select('*')
            .eq('sucursal_id', sucursalId)
            .order('fecha', { ascending: false })
            .limit(500);
        if (histGlobal) setHistorialGlobal(histGlobal);
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
        if (!window.confirm(t('confirmarCorte') || '¿Estás seguro de realizar el corte de caja? Se retirará todo el efectivo.')) return;

        const { error } = await supabase.rpc('registrar_movimiento_caja', {
            p_sucursal_id: sucursalId,
            p_tipo: 'corte_caja',
            p_monto: -saldo, // Retira todo el dinero
            p_motivo: 'Corte de Caja Diario'
        });

        if (error) alert('Error: ' + error.message);
        else {
            alert(t('corteExitoso') || 'Corte de caja realizado exitosamente.');
            fetchCaja();
            // Opcional: Imprimir un ticket en PDF
            window.print();
        }
    };

    // Píldoras estéticas para los tipos de movimiento
    const getEtiqueta = (tipo) => {
        if (tipo === 'venta_efectivo') return <span style={{background: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(22, 163, 74, 0.3)'}}>{t('ventaEfectivo') || 'Venta Efectivo'}</span>;
        if (tipo === 'ingreso_manual') return <span style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(2, 132, 199, 0.3)'}}>{t('ingresoManual') || 'Ingreso Manual'}</span>;
        if (tipo === 'retiro_manual') return <span style={{background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(234, 88, 12, 0.3)'}}>{t('retiroManual') || 'Retiro Manual'}</span>;
        if (tipo === 'corte_caja') return <span style={{background: 'rgba(220, 38, 38, 0.1)', color: 'var(--primary-red)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '900', border: '1px solid rgba(220, 38, 38, 0.3)'}}>{t('corteDeCaja') || 'Corte Caja'}</span>;
        return <span style={{background: 'var(--bg-lighter)', color: 'var(--text-muted)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid var(--border-color)'}}>{tipo}</span>;
    };

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '25px', overflowY: 'auto', paddingRight: '5px'}}>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px'}}>
                
                {/* PANEL IZQUIERDO: SALDO Y ACCIONES */}
                <div className="panel" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 30px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)'}}>
                    <div style={{background: 'rgba(22, 163, 74, 0.1)', padding: '20px', borderRadius: '50%', marginBottom: '20px'}}>
                        <i className="fa-solid fa-cash-register" style={{fontSize: '3rem', color: 'var(--success)'}}></i>
                    </div>
                    
                    <h3 style={{color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem'}}>{t('saldoActual') || 'Efectivo en Caja'}</h3>
                    <h1 style={{fontSize: '3.8rem', margin: '10px 0', color: 'var(--text-main)', fontWeight: '900'}}>${saldo.toFixed(2)}</h1>
                    <span style={{color: 'var(--accent)', fontSize: '0.9rem', marginBottom: '35px', fontWeight: 'bold', background: 'rgba(2, 132, 199, 0.1)', padding: '4px 10px', borderRadius: '6px'}}>{branch.toUpperCase()}</span>

                    <div style={{display: 'flex', width: '100%', gap: '15px', marginBottom: '20px'}}>
                        <button className="btn-action" onClick={() => {setTipoMovimiento('ingreso'); setShowModal(true);}} style={{flex: 1, background: 'rgba(2, 132, 199, 0.05)', color: 'var(--accent)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '15px 10px', borderRadius: '10px', fontWeight: 'bold', transition: 'all 0.2s'}} onMouseEnter={e => {e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'white';}} onMouseLeave={e => {e.currentTarget.style.background = 'rgba(2, 132, 199, 0.05)'; e.currentTarget.style.color = 'var(--accent)';}}>
                            <i className="fa-solid fa-arrow-down-to-line" style={{marginBottom: '5px', display: 'block', fontSize: '1.2rem'}}></i> Ingresar
                        </button>
                        <button className="btn-action" onClick={() => {setTipoMovimiento('retiro'); setShowModal(true);}} style={{flex: 1, background: 'rgba(234, 88, 12, 0.05)', color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.3)', padding: '15px 10px', borderRadius: '10px', fontWeight: 'bold', transition: 'all 0.2s'}} onMouseEnter={e => {e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = 'white';}} onMouseLeave={e => {e.currentTarget.style.background = 'rgba(234, 88, 12, 0.05)'; e.currentTarget.style.color = '#ea580c';}}>
                            <i className="fa-solid fa-arrow-up-from-bracket" style={{marginBottom: '5px', display: 'block', fontSize: '1.2rem'}}></i> Retirar
                        </button>
                    </div>

                    <button className="btn-primary" onClick={hacerCorteCaja} style={{width: '100%', padding: '18px', background: 'var(--primary-red)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(220, 38, 38, 0.3)'}}>
                        <i className="fa-solid fa-scissors"></i> {t('hacerCorte') || 'Hacer Corte de Caja'}
                    </button>
                </div>

                {/* PANEL DERECHO: HISTORIAL DEL DÍA */}
                <div className="panel" style={{background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '0', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-sm)'}}>
                    <div style={{padding: '25px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)'}}>
                        <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.3rem'}}><i className="fa-solid fa-list-check" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('movimientosHoy') || 'Movimientos de Hoy'}</h2>
                    </div>
                    
                    <div style={{flex: 1, overflowY: 'auto', maxHeight: '420px'}}>
                        <table className="data-table">
                            <thead style={{position: 'sticky', top: 0, background: 'var(--bg-panel)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', zIndex: 1}}>
                                <tr>
                                    <th style={{padding: '15px 25px'}}>{t('fechaHora') || 'Hora'}</th>
                                    <th>{t('tipoMovimiento') || 'Movimiento'}</th>
                                    <th>{t('motivo') || 'Motivo'}</th>
                                    <th style={{textAlign:'right', padding: '15px 25px'}}>{t('importe') || 'Importe'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movimientos.map(mov => (
                                    <tr key={`hoy-${mov.id}`}>
                                        <td style={{fontSize: '0.85rem', color: 'var(--text-muted)', padding: '15px 25px'}}>{new Date(mov.fecha).toLocaleTimeString()}</td>
                                        <td>{getEtiqueta(mov.tipo)}</td>
                                        <td style={{color: 'var(--text-main)', fontSize: '0.9rem'}}>{mov.motivo}</td>
                                        <td style={{textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: mov.monto > 0 ? 'var(--success)' : 'var(--primary-red)', padding: '15px 25px'}}>
                                            {mov.monto > 0 ? '+' : ''}{parseFloat(mov.monto).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                                {movimientos.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-wind fa-2x" style={{marginBottom: '10px', display: 'block', opacity: 0.5}}></i> La caja está sin movimientos hoy.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* NUEVO PANEL: HISTORIAL GLOBAL DE CAJA (TODOS LOS TIEMPOS) */}
            <div className="panel" style={{background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '0', boxShadow: 'var(--shadow-sm)'}}>
                <div style={{padding: '25px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)'}}>
                    <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.3rem'}}><i className="fa-solid fa-clock-rotate-left" style={{color: 'var(--text-muted)', marginRight: '10px'}}></i> Historial Global (Auditoría)</h2>
                </div>
                <div style={{overflowY: 'auto', maxHeight: '400px'}}>
                    <table className="data-table">
                        <thead style={{position: 'sticky', top: 0, background: 'var(--bg-panel)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', zIndex: 1}}>
                            <tr>
                                <th style={{padding: '15px 25px'}}>Fecha Completa</th>
                                <th>{t('tipoMovimiento') || 'Movimiento'}</th>
                                <th>{t('motivo') || 'Motivo'}</th>
                                <th style={{textAlign:'right', padding: '15px 25px'}}>{t('importe') || 'Importe'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historialGlobal.map(mov => (
                                <tr key={`glob-${mov.id}`}>
                                    <td style={{fontSize: '0.85rem', color: 'var(--text-muted)', padding: '15px 25px'}}>{new Date(mov.fecha).toLocaleString()}</td>
                                    <td>{getEtiqueta(mov.tipo)}</td>
                                    <td style={{color: 'var(--text-main)', fontSize: '0.9rem'}}>{mov.motivo}</td>
                                    <td style={{textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: mov.monto > 0 ? 'var(--success)' : 'var(--primary-red)', padding: '15px 25px'}}>
                                        {mov.monto > 0 ? '+' : ''}{parseFloat(mov.monto).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            {historialGlobal.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>No hay datos históricos.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL INGRESOS Y RETIROS MANUALES (GLASSMORPHISM) */}
            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '450px', border: `1px solid ${tipoMovimiento === 'ingreso' ? 'var(--accent)' : '#ea580c'}`, boxShadow: `0 10px 40px ${tipoMovimiento === 'ingreso' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(234, 88, 12, 0.15)'}`, textAlign: 'left'}}>
                        <h3 style={{marginBottom: '25px', color: tipoMovimiento === 'ingreso' ? 'var(--accent)' : '#ea580c', fontSize: '1.5rem', textAlign: 'center'}}>
                            {tipoMovimiento === 'ingreso' ? <><i className="fa-solid fa-arrow-down-to-line"></i> {t('ingresoManual') || 'Ingreso de Efectivo'}</> : <><i className="fa-solid fa-arrow-up-from-bracket"></i> {t('retiroManual') || 'Retiro de Efectivo'}</>}
                        </h3>
                        
                        <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('monto') || 'Monto'} ($)</label>
                        <input 
                            type="number" 
                            value={montoManual} 
                            onChange={(e) => setMontoManual(e.target.value)} 
                            placeholder="0.00" 
                            autoFocus
                            style={{width:'100%', padding:'16px', marginBottom:'20px', background:'var(--bg-main)', color:'var(--text-main)', border: `1px solid ${tipoMovimiento === 'ingreso' ? 'var(--accent)' : '#ea580c'}`, borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center'}} 
                        />
                        
                        <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('motivo') || 'Motivo'}</label>
                        <input 
                            type="text" 
                            value={motivoManual} 
                            onChange={(e) => setMotivoManual(e.target.value)} 
                            placeholder={tipoMovimiento === 'ingreso' ? 'Ej. Fondo para dar cambio' : 'Ej. Pago de garrafones de agua'} 
                            style={{width:'100%', padding:'14px', marginBottom:'30px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '1rem'}} 
                        />
                        
                        <div style={{display:'flex', gap:'15px'}}>
                            <button className="btn-action" style={{flex:1, padding: '15px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold'}} onClick={() => setShowModal(false)}>{t('cancelar') || 'Cancelar'}</button>
                            <button className="btn-primary" style={{flex:1, padding: '15px', background: tipoMovimiento === 'ingreso' ? 'var(--accent)' : '#ea580c', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: `0 4px 12px ${tipoMovimiento === 'ingreso' ? 'rgba(2, 132, 199, 0.3)' : 'rgba(234, 88, 12, 0.3)'}`}} onClick={registrarMovimiento}><i className="fa-solid fa-save"></i> Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}