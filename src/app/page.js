'use client';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Ventas from '../components/Ventas';
import Inventario from '../components/Inventario';
import Promociones from '../components/Promociones';
import Clientes from '../components/Clientes';
import Reportes from '../components/Reportes';
import Configuracion from '../components/Configuracion';

export default function Home() {
    const [activeView, setActiveView] = useState('ventas');
    const [branch, setBranch] = useState('napoles');

    return (
        <div className="main-wrapper" style={{ flexDirection: 'row', padding: 0 }}>
            <Sidebar activeView={activeView} setActiveView={setActiveView} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', height: '100vh', overflow: 'hidden' }}>
                <Header branch={branch} setBranch={setBranch} />
                
                {activeView === 'ventas' && <Ventas branch={branch} />}
                {activeView === 'inventario' && <Inventario branch={branch} />}
                {activeView === 'promociones' && <Promociones />}
                {activeView === 'clientes' && <Clientes />}
                {activeView === 'reportes' && <Reportes />}
                {activeView === 'configuracion' && <Configuracion />}
                
            </div>
        </div>
    );
}