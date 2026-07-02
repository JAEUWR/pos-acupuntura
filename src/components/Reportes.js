'use client';
import { useState, useEffect } from 'react';

export default function Reportes() {
    const [heights, setHeights] = useState({ napoles: 60, roma: 90, centro: 40 });

    // Efecto para animar las gráficas al cargar
    useEffect(() => {
        setHeights({ napoles: 75, roma: 85, centro: 55 });
    }, []);

    return (
        <div className="view-section active" style={{flexDirection: 'column'}}>
            <div className="dashboard-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px'}}>
                <div className="dash-card" style={{background: 'var(--bg-dark)', padding: '25px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                    <i className="fa-solid fa-money-bill-trend-up" style={{fontSize: '2rem', color: 'var(--primary-red)'}}></i>
                    <span style={{color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase'}}>Ventas del Día (Global)</span>
                    <span style={{fontSize: '2.5rem', fontWeight: 'bold'}}>$14,520.00</span>
                </div>
                <div className="dash-card" style={{background: 'var(--bg-dark)', padding: '25px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                    <i className="fa-solid fa-user-check" style={{fontSize: '2rem', color: 'var(--primary-red)'}}></i>
                    <span style={{color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase'}}>Consultas Atendidas</span>
                    <span style={{fontSize: '2.5rem', fontWeight: 'bold'}}>24</span>
                </div>
                <div className="dash-card" style={{background: 'var(--bg-dark)', padding: '25px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                    <i className="fa-solid fa-box-open" style={{fontSize: '2rem', color: 'var(--primary-red)'}}></i>
                    <span style={{color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase'}}>Productos Vendidos</span>
                    <span style={{fontSize: '2.5rem', fontWeight: 'bold'}}>87</span>
                </div>
            </div>
            <div className="panel">
                <h2><i className="fa-solid fa-chart-bar"></i> Rendimiento por Sucursal</h2>
                <div style={{height: '200px', display: 'flex', alignItems: 'flex-end', gap: '40px', padding: '20px 0', borderBottom: '1px solid var(--border-color)'}}>
                    <div style={{width: '100px', height: `${heights.napoles}%`, background: 'var(--primary-red)', borderRadius: '4px 4px 0 0', position:'relative', textAlign:'center', transition: 'height 1s ease-out'}}>
                        <span style={{position:'absolute', top:'-25px', left:'0', width:'100%', color:'var(--text-muted)'}}>Nápoles</span>
                    </div>
                    <div style={{width: '100px', height: `${heights.roma}%`, background: 'var(--primary-red)', borderRadius: '4px 4px 0 0', position:'relative', textAlign:'center', transition: 'height 1s ease-out'}}>
                        <span style={{position:'absolute', top:'-25px', left:'0', width:'100%', color:'var(--text-muted)'}}>Roma</span>
                    </div>
                    <div style={{width: '100px', height: `${heights.centro}%`, background: 'var(--primary-red)', borderRadius: '4px 4px 0 0', position:'relative', textAlign:'center', transition: 'height 1s ease-out'}}>
                        <span style={{position:'absolute', top:'-25px', left:'0', width:'100%', color:'var(--text-muted)'}}>Centro</span>
                    </div>
                </div>
            </div>
        </div>
    );
}