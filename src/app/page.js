'use client';
import { useState, useEffect } from 'react';
// IMPORTACIÓN DINÁMICA DE NEXT.JS
import dynamic from 'next/dynamic'; 
import { supabase } from '../lib/supabase';
import Login from '../components/Login';

// Mantenemos static el LanguageContext y LanguageProvider porque suelen necesitar SSR para el idioma base.
import { LanguageProvider, useLanguage } from '../context/LanguageContext';

// 🚀 IMPORTAMOS TODOS LOS MÓDULOS DEL CLIENTE CON SSR DESACTIVADO
const Ventas = dynamic(() => import('../components/Ventas'), { ssr: false });
const ConsumosMedicos = dynamic(() => import('../components/ConsumosMedicos'), { ssr: false });
const Inventario = dynamic(() => import('../components/Inventario'), { ssr: false });
const Finanzas = dynamic(() => import('../components/Finanzas'), { ssr: false });
const Promociones = dynamic(() => import('../components/Promociones'), { ssr: false });
const Clientes = dynamic(() => import('../components/Clientes'), { ssr: false });
const Configuracion = dynamic(() => import('../components/Configuracion'), { ssr: false });
const EscritorioMedico = dynamic(() => import('../components/EscritorioMedico'), { ssr: false });
const Calendar = dynamic(() => import('../components/Agenda'), { ssr: false }); // 🚀 Aquí está tu importación

// COMPONENTE INTERNO DEL DASHBOARD
function DashboardApp({ session, perfil, branch, setBranch }) {
    const contextoIdioma = useLanguage() || {};
    const t = contextoIdioma.t || ((key) => key);
    const idiomaActual = contextoIdioma.language || contextoIdioma.idioma || 'es';
    
    const handleCambiarIdioma = (nuevoIdioma) => {
        if (contextoIdioma.changeLanguage) contextoIdioma.changeLanguage(nuevoIdioma);
        else if (contextoIdioma.setLanguage) contextoIdioma.setLanguage(nuevoIdioma);
        else if (contextoIdioma.cambiarIdioma) contextoIdioma.cambiarIdioma(nuevoIdioma);
    };
    
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [activeView, setActiveView] = useState('ventas');
    
    // ESTADO: Menú Deslizable
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

    const branchesOptions = {
        napoles: 'Sucursal Nápoles',
        obrera: 'Sucursal Obrera',
        pedregal: 'Sucursal Pedregal'
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div className="app-container oriental-theme" suppressHydrationWarning>
            
            {/* 🚀 SLIDEBAR (MENÚ LATERAL COLAPSABLE) */}
            <div className={`sidebar-premium ${isSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
                
                <button 
                    className="toggle-sidebar-btn"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    title={isSidebarOpen ? "Contraer menú" : "Expandir menú"}
                >
                    <i className="fa-solid fa-chevron-left"></i>
                </button>

                <div className="content-on-top" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    
                    <div className="logo-container">
                        {isDarkMode ? (
                            <div className="logo-capsule-dark">
                                <img src="/Logo.jpeg" alt="Logo" />
                            </div>
                        ) : (
                            <div className="logo-capsule-light">
                                <img src="/Logo.jpeg" alt="Logo" />
                            </div>
                        )}
                        <h2 className="logo-text">Acupuntura HK</h2>
                    </div>

                    {/* MÓDULOS DE NAVEGACIÓN */}
                    <div style={{ flex: 1, padding: isSidebarOpen ? '20px 15px' : '20px 10px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', overflowX: 'hidden', transition: 'padding 0.4s' }}>
                        <button onClick={() => setActiveView('ventas')} className={`nav-btn ${activeView === 'ventas' ? 'active' : ''}`} title={!isSidebarOpen ? (t('puntoVenta') || 'Punto de Venta') : ''}>
                            <i className="fa-solid fa-cash-register"></i> <span className="nav-label">{t('puntoVenta') || 'Punto de Venta'}</span>
                        </button>
                        <button onClick={() => setActiveView('finanzas')} className={`nav-btn ${activeView === 'finanzas' ? 'active' : ''}`} title={!isSidebarOpen ? (t('movimientosFinanzas') || 'Movimientos y Finanzas') : ''}>
                            <i className="fa-solid fa-chart-pie"></i> <span className="nav-label">{t('movimientosFinanzas') || 'Movimientos y Finanzas'}</span>
                        </button>
                        <button onClick={() => setActiveView('doctores')} className={`nav-btn ${activeView === 'doctores' ? 'active' : ''}`} title={!isSidebarOpen ? (t('consumosMedicos') || 'Consumos Médicos') : ''}>
                            <i className="fa-solid fa-syringe"></i> <span className="nav-label">{t('consumosMedicos') || 'Consumos Médicos'}</span>
                        </button>
                        <button onClick={() => setActiveView('clientes')} className={`nav-btn ${activeView === 'clientes' ? 'active' : ''}`} title={!isSidebarOpen ? (t('clientes') || 'Recepción') : ''}>
                            <i className="fa-solid fa-users"></i> <span className="nav-label">{t('clientes') || 'Recepción'}</span>
                        </button>
                        
                        {/* 🚀 AQUÍ ESTÁ EL BOTÓN DE LA AGENDA QUE FALTABA */}
                        <button onClick={() => setActiveView('calendar')} className={`nav-btn ${activeView === 'calendar' ? 'active' : ''}`} title={!isSidebarOpen ? (t('agenda') || 'Agenda') : ''}>
                            <i className="fa-regular fa-calendar-check"></i> <span className="nav-label">{t('agenda') || 'Agenda Clínica'}</span>
                        </button>

                        <button onClick={() => setActiveView('escritorioMedico')} className={`nav-btn ${activeView === 'escritorioMedico' ? 'active' : ''}`} title={!isSidebarOpen ? (t('escritorioMedico') || 'Escritorio Médico') : ''}>
                            <i className="fa-solid fa-user-doctor"></i> <span className="nav-label">{t('escritorioMedico') || 'Escritorio Médico'}</span>
                        </button>
                        <button onClick={() => setActiveView('inventario')} className={`nav-btn ${activeView === 'inventario' ? 'active' : ''}`} title={!isSidebarOpen ? (t('inventario') || 'Inventario') : ''}>
                            <i className="fa-solid fa-boxes-stacked"></i> <span className="nav-label">{t('inventario') || 'Inventario'}</span>
                        </button>
                        <button onClick={() => setActiveView('promociones')} className={`nav-btn ${activeView === 'promociones' ? 'active' : ''}`} title={!isSidebarOpen ? (t('promociones') || 'Promociones') : ''}>
                            <i className="fa-solid fa-tags"></i> <span className="nav-label">{t('promociones') || 'Promociones'}</span>
                        </button>
                    </div>

                    <div style={{ padding: isSidebarOpen ? '20px 15px' : '20px 10px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'padding 0.4s' }}>
                        <button onClick={() => setActiveView('configuracion')} className={`nav-btn ${activeView === 'configuracion' ? 'active' : ''}`} title={!isSidebarOpen ? (t('configuracion') || 'Configuración') : ''}>
                            <i className="fa-solid fa-gear"></i> <span className="nav-label">{t('configuracion') || 'Configuración'}</span>
                        </button>
                        <button onClick={handleLogout} className="nav-btn" style={{color: 'var(--primary-red)'}} title={!isSidebarOpen ? (t('cerrarSesion') || 'Cerrar Sesión') : ''}>
                            <i className="fa-solid fa-arrow-right-from-bracket"></i> <span className="nav-label">{t('cerrarSesion') || 'Cerrar Sesión'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ÁREA PRINCIPAL DERECHA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
                
                <div style={{ 
                    padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', 
                    borderTop: '3px solid var(--primary-red)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', zIndex: 5 
                }}>
                    
                    <div className="content-on-top" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ position: 'relative' }}>
                            <div 
                                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                                style={{ 
                                    background: 'var(--bg-dark)', padding: '10px 20px', borderRadius: '30px', 
                                    border: isBranchDropdownOpen ? '1px solid var(--primary-red)' : '1px solid var(--border-color)', 
                                    display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', 
                                    boxShadow: isBranchDropdownOpen ? '0 0 0 3px rgba(211, 47, 47, 0.15)' : 'var(--shadow-sm)', 
                                    transition: 'all 0.3s ease', minWidth: '220px', justifyContent: 'space-between'
                                }}
                            >
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                    <i className="fa-solid fa-location-dot" style={{ color: 'var(--primary-red)', fontSize: '1.1rem' }}></i>
                                    <span style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 'bold' }}>
                                        {branchesOptions[branch]}
                                    </span>
                                </div>
                                <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', transition: 'transform 0.3s ease', transform: isBranchDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }}></i>
                            </div>

                            {isBranchDropdownOpen && (
                                <>
                                    <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20}} onClick={() => setIsBranchDropdownOpen(false)}></div>
                                    <div style={{ 
                                        position: 'absolute', top: '120%', left: 0, background: 'var(--bg-panel)', 
                                        border: '1px solid var(--border-color)', borderRadius: '12px', zIndex: 21, 
                                        width: '100%', boxShadow: 'var(--shadow-lg)', padding: '8px',
                                        animation: 'fadeInSlide 0.2s ease-out'
                                    }}>
                                        {Object.entries(branchesOptions).map(([key, name]) => (
                                            <div 
                                                key={key}
                                                onClick={() => { setBranch(key); setIsBranchDropdownOpen(false); }}
                                                style={{
                                                    padding: '12px 15px', borderRadius: '8px', cursor: 'pointer',
                                                    color: branch === key ? 'white' : 'var(--text-main)',
                                                    background: branch === key ? 'var(--primary-red)' : 'transparent',
                                                    fontWeight: branch === key ? 'bold' : 'normal',
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    transition: 'all 0.2s ease', marginBottom: '2px'
                                                }}
                                                onMouseEnter={e => { if (branch !== key) e.currentTarget.style.background = 'var(--bg-lighter)'; }}
                                                onMouseLeave={e => { if (branch !== key) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <i className="fa-solid fa-store" style={{ opacity: branch === key ? 1 : 0.5, fontSize: '0.9rem' }}></i> 
                                                <span style={{fontSize: '0.9rem'}}>{name}</span>
                                                {branch === key && <i className="fa-solid fa-check" style={{marginLeft: 'auto', fontSize: '0.9rem'}}></i>}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="content-on-top" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: isDarkMode ? '#ffb300' : '#475569', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem', transition: 'all 0.3s ease' }}>
                            <i className={isDarkMode ? "fa-solid fa-sun" : "fa-solid fa-moon"}></i>
                        </button>

                        <div style={{ background: 'var(--bg-dark)', padding: '5px', borderRadius: '8px', display: 'flex', gap: '5px', border: '1px solid var(--border-color)' }}>
                            <button onClick={() => handleCambiarIdioma('es')} style={{ padding: '5px 10px', background: idiomaActual === 'es' ? 'var(--primary-red)' : 'transparent', color: idiomaActual === 'es' ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>ES</button>
                            <button onClick={() => handleCambiarIdioma('en')} style={{ padding: '5px 10px', background: idiomaActual === 'en' ? 'var(--primary-red)' : 'transparent', color: idiomaActual === 'en' ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>EN</button>
                            <button onClick={() => handleCambiarIdioma('zh')} style={{ padding: '5px 10px', background: idiomaActual === 'zh' ? 'var(--primary-red)' : 'transparent', color: idiomaActual === 'zh' ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>中文</button>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px' }}>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{perfil?.nombre || 'Usuario'}</span>
                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--primary-red)', textTransform: 'uppercase' }}>{perfil?.rol || 'Staff'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CONTENEDOR DE LAS VISTAS */}
                <div className="content-on-top" style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                    {activeView === 'ventas' && <Ventas branch={branch} perfilActual={perfil} />}
                    {activeView === 'finanzas' && <Finanzas branch={branch} perfilActual={perfil} />}
                    
                    {/* 🚀 AQUÍ ESTÁ TU RENDERIZADO */}
                    {activeView === 'calendar' && <Calendar branch={branch} perfilActual={perfil} />}
                    
                    {activeView === 'doctores' && <ConsumosMedicos branch={branch} />}
                    {activeView === 'inventario' && <Inventario branch={branch} />}
                    {activeView === 'promociones' && <Promociones />}
                    {activeView === 'clientes' && <Clientes branch={branch} perfilActual={perfil}/>}
                    {activeView === 'escritorioMedico' && <EscritorioMedico branch={branch} perfilActual={perfil} />}
                    {activeView === 'configuracion' && <Configuracion perfilActual={perfil} />}
                </div>
            </div>

            {/* ESTILOS MAESTROS GLOBAL */}
            <style jsx global>{`
                .app-container { display: flex; height: 100vh; width: 100vw; overflow: hidden; background-color: var(--bg-main); }
                .oriental-theme { position: relative; }
                .oriental-theme::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at 30% 30%, rgba(211, 47, 47, 0.05), transparent 40%), radial-gradient(circle at 70% 60%, rgba(183, 28, 28, 0.03), transparent 50%), radial-gradient(circle at 40% 80%, rgba(255, 82, 82, 0.04), transparent 40%); animation: silkBreathe 20s ease-in-out infinite alternate; z-index: 0; pointer-events: none; }
                .oriental-theme::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20c0-11.046 8.954-20 20-20v2c-9.941 0-18 8.059-18 18 0 9.941 8.059 18 18 18v2c-11.046 0-20-8.954-20-20zM0 20c0-11.046 8.954-20 20-20v2C10.059 2 2 10.059 2 20c0 9.941 8.059 18 18 18v2C8.954 40 0 31.046 0 20z' fill='%23d32f2f' fill-opacity='0.03' fill-rule='evenodd'/%3E%3C/svg%3E"); animation: panPattern 90s linear infinite; z-index: 0; pointer-events: none; }
                .content-on-top { position: relative; z-index: 1; }
                @keyframes silkBreathe { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(2deg) scale(1.02); } 100% { transform: rotate(-2deg) scale(1.05); } }
                @keyframes panPattern { 0% { background-position: 0px 0px; } 100% { background-position: 400px 400px; } }
                
                .sidebar-premium { background-color: var(--bg-panel); border-right: 1px solid var(--border-color); transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); position: relative; z-index: 10; }
                .sidebar-expanded { width: 280px; }
                .sidebar-collapsed { width: 88px; }
                .toggle-sidebar-btn { position: absolute; top: 25px; right: -16px; width: 32px; height: 32px; border-radius: 50%; background: var(--bg-panel); border: 1px solid var(--border-color); color: var(--text-muted); cursor: pointer; z-index: 100; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); transition: all 0.4s ease; }
                .sidebar-collapsed .toggle-sidebar-btn { transform: rotate(180deg); right: -16px; }
                .toggle-sidebar-btn:hover { color: var(--primary-red); border-color: var(--primary-red); }
                
                .logo-container { padding: 30px 20px; display: flex; flex-direction: column; align-items: center; border-bottom: 1px solid var(--border-color); transition: padding 0.4s ease; }
                .sidebar-collapsed .logo-container { padding: 30px 5px; }
                .logo-capsule-dark { background: white; padding: 10px 25px; border-radius: 20px; box-shadow: 0 8px 25px rgba(211, 47, 47, 0.25); margin-bottom: 15px; transition: all 0.4s ease; display: flex; justify-content: center; align-items: center; overflow: hidden; }
                .sidebar-collapsed .logo-capsule-dark { padding: 4px; border-radius: 12px; width: 54px; height: 54px; }
                .logo-capsule-dark img { height: 70px; object-fit: contain; transition: height 0.4s ease; }
                .sidebar-collapsed .logo-capsule-dark img { height: 46px; }
                
                .logo-capsule-light { margin-bottom: 15px; transition: all 0.4s ease; display: flex; justify-content: center; align-items: center; overflow: hidden;}
                .sidebar-collapsed .logo-capsule-light { padding: 0px; border-radius: 12px; width: 52px; height: 52px; }
                .logo-capsule-light img { height: 90px; object-fit: contain; mix-blend-mode: multiply; transition: height 0.4s ease; }
                .sidebar-collapsed .logo-capsule-light img { height: 52px; }
                
                .logo-text { font-size: 1rem; color: var(--text-main); text-align: center; margin: 0; font-weight: 700; white-space: nowrap; overflow: hidden; transition: all 0.3s ease; opacity: 1; max-height: 30px; }
                .sidebar-collapsed .logo-text { opacity: 0; max-height: 0; }
                
                .nav-btn { padding: 14px 20px; background: transparent; color: var(--text-muted); border: 1px solid transparent; border-radius: 12px; cursor: pointer; text-align: left; font-size: 0.95rem; font-weight: 500; display: flex; align-items: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); white-space: nowrap; width: 100%; overflow: hidden; }
                .nav-btn i { min-width: 24px; text-align: center; font-size: 1.15rem; transition: transform 0.3s; }
                .nav-label { margin-left: 15px; transition: opacity 0.3s, transform 0.3s; opacity: 1; }
                .nav-btn:hover { background: rgba(211, 47, 47, 0.05); color: var(--text-main); }
                .sidebar-expanded .nav-btn:hover { transform: translateX(4px); }
                .sidebar-collapsed .nav-btn:hover { transform: translateY(-2px); }
                .nav-btn.active { background: linear-gradient(135deg, var(--primary-red), #b71c1c); color: white; box-shadow: 0 4px 15px rgba(211, 47, 47, 0.3); }
                .sidebar-collapsed .nav-btn { padding: 14px 0; justify-content: center; }
                .sidebar-collapsed .nav-btn i { font-size: 1.3rem; margin: 0; }
                .sidebar-collapsed .nav-label { opacity: 0; width: 0; margin-left: 0; transform: translateX(-10px); display: none; }
            `}</style>
        </div>
    );
}

// COMPONENTE PRINCIPAL BLINDADO
export default function Home() {
    const [isMounted, setIsMounted] = useState(false);
    const [session, setSession] = useState(null);
    const [perfil, setPerfil] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [branch, setBranch] = useState('napoles');

    useEffect(() => {
        setIsMounted(true);
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
        const { data } = await supabase.from('perfiles_usuarios').select('*').eq('id', userId).single();
        if (data) {
            setPerfil(data);
            if (data.sucursal_id) {
                const branchMapReverse = { 1: 'napoles', 2: 'obrera', 3: 'pedregal' };
                setBranch(branchMapReverse[data.sucursal_id]);
            }
        }
        setLoadingAuth(false);
    };

    if (!isMounted) return null; 

    if (loadingAuth) {
        return <div suppressHydrationWarning style={{height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f111a', color: 'white'}}>Verificando credenciales...</div>;
    }

    if (!session) {
        return <Login />;
    }

    return (
        <LanguageProvider>
            <DashboardApp session={session} perfil={perfil} branch={branch} setBranch={setBranch} />
        </LanguageProvider>
    );
}