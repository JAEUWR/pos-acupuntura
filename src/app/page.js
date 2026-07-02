'use client';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Ventas from '../components/Ventas';

export default function Home() {
    const [activeView, setActiveView] = useState('ventas');
    const [branch, setBranch] = useState('napoles');

    return (
        <div className="main-wrapper" style={{ flexDirection: 'row', padding: 0 }}>
            <Sidebar activeView={activeView} setActiveView={setActiveView} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', height: '100vh', overflow: 'hidden' }}>
                <Header branch={branch} setBranch={setBranch} />
                
                {activeView === 'ventas' && <Ventas />}
                
                {activeView !== 'ventas' && (
                    <div className="view-section active">
                        <div className="panel">
                            <h2>Vista en construcción</h2>
                            <p style={{color: 'var(--text-muted)'}}>
                                En esta fase estamos conectando este módulo a la base de datos.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}