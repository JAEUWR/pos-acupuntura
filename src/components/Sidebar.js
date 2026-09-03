'use client';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext'; 

export default function Sidebar({ activeView, setActiveView, rol, perfil }) {
    const { t, language, setLanguage } = useLanguage();

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const permisos = perfil?.permisos || [];
    const isAdmin = rol === 'admin';
    const hasAccess = (view) => isAdmin || permisos.includes(view);

    const getBtnStyle = (viewName) => {
        const isActive = activeView === viewName;
        return {
            width: '100%',
            padding: '14px 20px',
            marginBottom: '8px',
            borderRadius: '8px',
            border: 'none',
            background: isActive ? 'var(--primary-red)' : 'transparent',
            color: isActive ? 'white' : 'var(--text-muted)',
            fontSize: '0.95rem',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.2s ease-in-out',
            fontWeight: isActive ? 'bold' : 'normal',
            boxShadow: isActive ? '0 4px 10px rgba(198, 40, 40, 0.3)' : 'none'
        };
    };

    return (
        <div style={{ width: '260px', background: 'var(--bg-panel)', padding: '25px 20px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', height: '100vh', boxShadow: '2px 0 10px rgba(0,0,0,0.2)'}}>
            
            <div style={{ textAlign: 'center', margin: '0 0 20px 0' }}>
                <h3 style={{ color: 'white', margin: '0 0 5px 0', fontSize: '1.2rem', letterSpacing: '0.5px' }}>{t('panelControl')}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-red)', fontWeight: 'bold', letterSpacing: '1px' }}>
                    {rol?.toUpperCase()}
                </span>
            </div>

            {/* SELECTOR DE IDIOMA */}
            <div style={{ marginBottom: '25px', display: 'flex', gap: '5px', justifyContent: 'center' }}>
                <button onClick={() => setLanguage('es')} style={{ background: language === 'es' ? 'var(--primary-red)' : 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>ES</button>
                <button onClick={() => setLanguage('en')} style={{ background: language === 'en' ? 'var(--primary-red)' : 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>EN</button>
                <button onClick={() => setLanguage('zh')} style={{ background: language === 'zh' ? 'var(--primary-red)' : 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>中文</button>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                
                {hasAccess('ventas') && (
                    <button style={getBtnStyle('ventas')} onClick={() => setActiveView('ventas')}>
                        <i className="fa-solid fa-cash-register" style={{ width: '20px', textAlign: 'center', fontSize: '1.1rem' }}></i> {t('puntoVenta')}
                    </button>
                )}
                
                {hasAccess('finanzas') && (
                    <button style={getBtnStyle('finanzas')} onClick={() => setActiveView('finanzas')}>
                        <i className="fa-solid fa-chart-pie" style={{ width: '20px', textAlign: 'center', fontSize: '1.1rem' }}></i> {t('movimientosFinanzas') || 'Movimientos y Finanzas'}
                    </button>
                )}
                
                {/* 🚀 EL BOTÓN DE AGENDA YA TIENE SU PROPIO ÍCONO Y TEXTO */}
                {hasAccess('calendar') && (
                    <button style={getBtnStyle('calendar')} onClick={() => setActiveView('calendar')}>
                        <i className="fa-regular fa-calendar-check" style={{ width: '20px', textAlign: 'center', fontSize: '1.1rem' }}></i> {t('agendaClinica') || 'Agenda Clínica'}
                    </button>
                )}

                {hasAccess('doctores') && (
                    <button style={getBtnStyle('doctores')} onClick={() => setActiveView('doctores')}>
                        <i className="fa-solid fa-briefcase-medical" style={{ width: '20px', textAlign: 'center', fontSize: '1.1rem' }}></i> {t('insumosMedicos')}
                    </button>
                )}
                
                {hasAccess('clientes') && (
                    <button style={getBtnStyle('clientes')} onClick={() => setActiveView('clientes')}>
                        <i className="fa-solid fa-users" style={{ width: '20px', textAlign: 'center', fontSize: '1.1rem' }}></i> {t('clientes')}
                    </button>
                )}
                
                {hasAccess('escritorioMedico') && (
                    <button style={getBtnStyle('escritorioMedico')} onClick={() => setActiveView('escritorioMedico')}>
                        <i className="fa-solid fa-user-doctor" style={{ width: '20px', textAlign: 'center', fontSize: '1.1rem' }}></i> {t('escritorioMedico')}
                    </button>
                )}
                
                {hasAccess('inventario') && (
                    <button style={getBtnStyle('inventario')} onClick={() => setActiveView('inventario')}>
                        <i className="fa-solid fa-boxes-stacked" style={{ width: '20px', textAlign: 'center', fontSize: '1.1rem' }}></i> {t('inventario')}
                    </button>
                )}
                
                {hasAccess('promociones') && (
                    <button style={getBtnStyle('promociones')} onClick={() => setActiveView('promociones')}>
                        <i className="fa-solid fa-tags" style={{ width: '20px', textAlign: 'center', fontSize: '1.1rem' }}></i> {t('promociones')}
                    </button>
                )}
                
                {hasAccess('configuracion') && (
                    <button style={getBtnStyle('configuracion')} onClick={() => setActiveView('configuracion')}>
                        <i className="fa-solid fa-gear" style={{ width: '20px', textAlign: 'center', fontSize: '1.1rem' }}></i> {t('configuracion')}
                    </button>
                )}

            </nav>

            <button 
                onClick={handleLogout} 
                style={{ marginTop: '20px', background: 'rgba(198, 40, 40, 0.05)', border: '1px solid rgba(198, 40, 40, 0.5)', color: 'var(--primary-red)', padding: '14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontWeight: 'bold', transition: 'all 0.2s ease' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--primary-red)'; e.currentTarget.style.color = 'white'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(198, 40, 40, 0.05)'; e.currentTarget.style.color = 'var(--primary-red)'; }}
            >
                <i className="fa-solid fa-right-from-bracket"></i> {t('cerrarSesion')}
            </button>
        </div>
    );
}