'use client';
import { supabase } from '../lib/supabase';
// IMPORTAMOS EL IDIOMA
import { useLanguage } from '../context/LanguageContext';

export default function Header({ branch, setBranch, perfil }) {
    // EXTRAEMOS LA FUNCIÓN DE TRADUCCIÓN
    const { t } = useLanguage();

    return (
        <header className="header">
            <div className="logo-area">
                <i className="fa-solid fa-yin-yang"></i>
                <h1>Acupuntura Tradicional China <span>HK</span></h1>
            </div>
            
            <div className="branch-selector">
                <i className="fa-solid fa-location-dot" style={{ color: 'var(--primary-red)', marginRight: '8px' }}></i>
                <select 
                    value={branch} 
                    onChange={(e) => setBranch(e.target.value)}
                    disabled={perfil?.sucursal_id !== null} // Bloquea si el empleado pertenece a una sola sucursal
                    style={{ opacity: perfil?.sucursal_id !== null ? 0.7 : 1, cursor: perfil?.sucursal_id !== null ? 'not-allowed' : 'pointer' }}
                >
                    <option value="napoles">{t('sucursal')} {t('napoles')}</option>
                    <option value="obrera">{t('sucursal')} {t('obrera')}</option>
                    <option value="pedregal">{t('sucursal')} {t('pedregal')}</option>
                </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'white' }}>{perfil?.nombre || t('empleado')}</span>
                    <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}><i className="fa-solid fa-circle"></i> {t('enLinea')}</span>
                </div>
                <div style={{ width: '45px', height: '45px', background: 'var(--bg-lighter)', border: '1px solid var(--border-color)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <i className="fa-solid fa-user-tie" style={{ color: 'var(--text-muted)' }}></i>
                </div>
            </div>
        </header>
    );
}