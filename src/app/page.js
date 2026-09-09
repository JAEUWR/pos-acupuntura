'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic'; 
import { supabase } from '../lib/supabase';
import Login from '../components/Login';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';

const Ventas = dynamic(() => import('../components/Ventas'), { ssr: false });
const ConsumosMedicos = dynamic(() => import('../components/ConsumosMedicos'), { ssr: false });
const Inventario = dynamic(() => import('../components/Inventario'), { ssr: false });
const Finanzas = dynamic(() => import('../components/Finanzas'), { ssr: false });
const Promociones = dynamic(() => import('../components/Promociones'), { ssr: false });
const Clientes = dynamic(() => import('../components/Clientes'), { ssr: false });
const Configuracion = dynamic(() => import('../components/Configuracion'), { ssr: false });
const EscritorioMedico = dynamic(() => import('../components/EscritorioMedico'), { ssr: false });
const Calendar = dynamic(() => import('../components/Agenda'), { ssr: false });

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
    
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

    // 🚀 ESTADOS PARA LA ALERTA INTELIGENTE DE FONDO
    const [faltaFondo, setFaltaFondo] = useState(false);
    const [autoOpenFondo, setAutoOpenFondo] = useState(false);

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

    // 🚀 VERIFICADOR SILENCIOSO DEL FONDO DE CAJA
    useEffect(() => {
        const checkFondoDia = async () => {
            const branchMapReverse = { napoles: 1, obrera: 2, pedregal: 3 };
            const sucId = branchMapReverse[branch] || 1;
            const hoy = new Date().toISOString().split('T')[0];
            
            const { data } = await supabase
                .from('movimientos_caja')
                .select('tipo, motivo')
                .eq('sucursal_id', sucId)
                .gte('fecha', `${hoy}T00:00:00`)
                .order('fecha', { ascending: false });

            if (data) {
                const idxLastCorte = data.findIndex(m => m.tipo === 'corte_caja');
                const movsTurno = idxLastCorte === -1 ? data : data.slice(0, idxLastCorte);
                const tieneFondo = movsTurno.some(m => m.tipo === 'ingreso_manual' && m.motivo.toLowerCase().includes('fondo'));
                setFaltaFondo(!tieneFondo);
            }
        };
        // Se ejecuta al cargar y cada vez que cambian de pestaña (para ocultarse sola si ya lo pusieron)
        checkFondoDia();
    }, [branch, activeView]);

    return (
        <div className="app-container oriental-theme" suppressHydrationWarning>
            
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

                    <div style={{ flex: 1, padding: isSidebarOpen ? '20px 15px' : '20px 10px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', overflowX: 'hidden', transition: 'padding 0.4s' }}>
                        <button onClick={() => setActiveView('ventas')} className={`nav-btn ${activeView === 'ventas' ? 'active' : ''}`} title={!isSidebarOpen ? (t('puntoVenta') || 'Punto de Venta') : ''}>
                            <i className="fa-solid fa-cash-register"></i> <span className="nav-label">{t('puntoVenta') || 'Punto de Venta'}</span>
                        </button>
                        <button onClick={() => setActiveView('finanzas')} className={`nav-btn ${activeView === 'finanzas' ? 'active' : ''}`} title={!isSidebarOpen ? (t('movimientosFinanzas') || 'Movimientos y Finanzas') : ''}>
                            <i className="fa-solid fa-chart-pie"></i> <span className="nav-label">{t('movimientosFinanzas') || 'Movimientos y Finanzas'}</span>
                        </button>
                        <button onClick={() => setActiveView('calendar')} className={`nav-btn ${activeView === 'calendar' ? 'active' : ''}`} title={!isSidebarOpen ? (t('agendaClinica') || 'Agenda Clínica') : ''}>
                            <i className="fa-regular fa-calendar-check"></i> <span className="nav-label">{t('agendaClinica') || 'Agenda Clínica'}</span>
                        </button>
                        <button onClick={() => setActiveView('doctores')} className={`nav-btn ${activeView === 'doctores' ? 'active' : ''}`} title={!isSidebarOpen ? (t('consumosMedicos') || 'Consumos Médicos') : ''}>
                            <i className="fa-solid fa-syringe"></i> <span className="nav-label">{t('consumosMedicos') || 'Consumos Médicos'}</span>
                        </button>
                        <button onClick={() => setActiveView('clientes')} className={`nav-btn ${activeView === 'clientes' ? 'active' : ''}`} title={!isSidebarOpen ? (t('clientes') || 'Recepción') : ''}>
                            <i className="fa-solid fa-users"></i> <span className="nav-label">{t('clientes') || 'Recepción'}</span>
                        </button>
                        <button onClick={() => setActiveView('escritorioMedico')} className={`nav-btn ${activeView === 'escritorioMedico' ? 'active' : ''}`} title={!isSidebarOpen ? (t('escritorioMedico') || 'Escritorio Médico') : ''}>
                            <i className="fa-solid fa-user-doctor"></i> <span className="nav-label">{t('escritorioMedico') || 'Escritorio Médico'}</span>
                        </button>
                        <button onClick={() => setActiveView('inventario')} className={`nav-btn ${activeView === 'inventario' ? 'active' : ''}`} title={!isSidebarOpen ? (t('inventario') || 'Inventario y Promos') : ''}>
                            <i className="fa-solid fa-boxes-stacked"></i> <span className="nav-label">{t('inventario') || 'Inventario y Promos'}</span>
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

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
                
                {/* 🚀 ALERTA FLOTANTE INTELIGENTE */}
                {faltaFondo && activeView !== 'finanzas' && (
                    <div 
                        className="floating-alert animate-bounce-drop"
                        onClick={() => { setActiveView('finanzas'); setAutoOpenFondo(true); }}
                    >
                        <div className="alert-icon pulse-warning"><i className="fa-solid fa-triangle-exclamation"></i></div>
                        <div className="alert-content">
                            <strong>¡Fondo de Caja Pendiente!</strong>
                            <span>Haz clic aquí para declararlo y abrir el turno.</span>
                        </div>
                        <i className="fa-solid fa-chevron-right alert-arrow"></i>
                    </div>
                )}

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

                <div className="content-on-top" style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                    {activeView === 'ventas' && <Ventas branch={branch} perfilActual={perfil} />}
                    {/* 🚀 AQUÍ LE PASAMOS EL TRIGGER A FINANZAS */}
                    {activeView === 'finanzas' && <Finanzas branch={branch} perfilActual={perfil} autoOpenFondo={autoOpenFondo} setAutoOpenFondo={setAutoOpenFondo} />}
                    {activeView === 'calendar' && <Calendar branch={branch} perfilActual={perfil} />}
                    {activeView === 'doctores' && <ConsumosMedicos branch={branch} />}
                    {activeView === 'inventario' && <Inventario branch={branch} perfilActual={perfil} />}
                    {activeView === 'clientes' && <Clientes branch={branch} perfilActual={perfil}/>}
                    {activeView === 'escritorioMedico' && <EscritorioMedico branch={branch} perfilActual={perfil} />}
                    {activeView === 'configuracion' && <Configuracion perfilActual={perfil} />}
                </div>
            </div>

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

                /* 🚀 ESTILOS DE LA ALERTA FLOTANTE */
                .floating-alert { position: absolute; top: 30px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 12px 25px; border-radius: 50px; display: flex; align-items: center; gap: 15px; box-shadow: 0 10px 25px rgba(239, 68, 68, 0.4); cursor: pointer; z-index: 1000; transition: all 0.3s ease; }
                .floating-alert:hover { box-shadow: 0 15px 35px rgba(239, 68, 68, 0.6); transform: translateX(-50%) scale(1.03); }
                .alert-icon { background: rgba(255,255,255,0.2); width: 35px; height: 35px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; }
                .pulse-warning { animation: pulseWarning 1.5s infinite; }
                .alert-content { display: flex; flex-direction: column; }
                .alert-content strong { font-size: 0.95rem; letter-spacing: 0.5px; }
                .alert-content span { font-size: 0.75rem; opacity: 0.9; }
                .alert-arrow { margin-left: 10px; font-size: 1.2rem; opacity: 0.7; }
                
                @keyframes pulseWarning { 0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); } }
                .animate-bounce-drop { animation: bounceDrop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                @keyframes bounceDrop { 0% { top: -100px; opacity: 0; } 100% { top: 30px; opacity: 1; } }
            `}</style>
        </div>
    );
}

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
            
            // 🚀 LÓGICA DE MEMORIA INTELIGENTE
            // 1. Buscamos si la computadora ya se acordaba de la sucursal
            const savedBranch = localStorage.getItem('hk_branch_memory');
            
            if (savedBranch) {
                setBranch(savedBranch);
            } else if (data.sucursal_id) {
                // 2. Si es computadora nueva, jalamos la sucursal asignada a su perfil en Supabase
                const branchMapReverse = { 1: 'napoles', 2: 'obrera', 3: 'pedregal' };
                const defaultBranch = branchMapReverse[data.sucursal_id] || 'napoles';
                setBranch(defaultBranch);
                localStorage.setItem('hk_branch_memory', defaultBranch);
            }
        }
        setLoadingAuth(false);
    };

    // 🚀 INTERCEPTOR: Cada vez que cambian de sucursal en el menú, lo guardamos en la memoria
    const handleSetBranch = (newBranch) => {
        setBranch(newBranch);
        localStorage.setItem('hk_branch_memory', newBranch);
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
            {/* 🚀 Pasamos nuestro interceptor en lugar del setBranch original */}
            <DashboardApp session={session} perfil={perfil} branch={branch} setBranch={handleSetBranch} />
        </LanguageProvider>
    );
}