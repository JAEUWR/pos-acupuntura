'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Login from '../components/Login';

import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Ventas from '../components/Ventas';
import ConsumosMedicos from '../components/ConsumosMedicos';
import Inventario from '../components/Inventario';
import Promociones from '../components/Promociones';
import Reportes from '../components/Reportes';
import Clientes from '../components/Clientes';
import Configuracion from '../components/Configuracion';
import Caja from '../components/Caja';

// IMPORTAMOS EL PROVEEDOR DE IDIOMAS
import { LanguageProvider } from '../context/LanguageContext';

export default function Home() {
    const [session, setSession] = useState(null);
    const [perfil, setPerfil] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    const [activeView, setActiveView] = useState('ventas');
    const [branch, setBranch] = useState('napoles');

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchPerfil(session.user.id);
            else setLoadingAuth(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchPerfil(session.user.id);
            else { setPerfil(null); setLoadingAuth(false); }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchPerfil = async (userId) => {
        const { data, error } = await supabase.from('perfiles_usuarios').select('*').eq('id', userId).single();
        if (data) {
            setPerfil(data);
            if (data.sucursal_id) {
                const branchMapReverse = { 1: 'napoles', 2: 'obrera', 3: 'pedregal' };
                setBranch(branchMapReverse[data.sucursal_id]);
            }
        }
        setLoadingAuth(false);
    };

    if (loadingAuth) {
        return <div style={{height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-dark)', color: 'white'}}>Verificando credenciales...</div>;
    }

    if (!session) {
        return <Login />;
    }

    return (
        /* ENVOLVEMOS TODO EL SISTEMA EN EL PROVEEDOR DE IDIOMAS */
        <LanguageProvider>
            <div style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--bg-dark)', overflow: 'hidden' }}>
                <Sidebar activeView={activeView} setActiveView={setActiveView} rol={perfil?.rol} perfil={perfil} />
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                    <Header branch={branch} setBranch={setBranch} perfil={perfil} />
                    
                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                        {activeView === 'ventas' && <Ventas branch={branch} perfilActual={perfil} />}
                        {activeView === 'caja' && <Caja branch={branch} />}
                        {activeView === 'doctores' && <ConsumosMedicos branch={branch} />}
                        {activeView === 'inventario' && <Inventario branch={branch} />}
                        {activeView === 'promociones' && <Promociones />}
                        {activeView === 'reportes' && <Reportes branch={branch} perfilActual={perfil} />}
                        {activeView === 'clientes' && <Clientes />}
                        {activeView === 'configuracion' && <Configuracion perfilActual={perfil} />}
                    </div>
                </div>
            </div>
        </LanguageProvider>
    );
}