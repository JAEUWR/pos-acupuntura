'use client';

export default function Header({ branch, setBranch }) {
    return (
        <header className="header">
            <div className="logo-area">
                <i className="fa-solid fa-yin-yang"></i>
                <h1>Acupuntura China <span>HK</span></h1>
            </div>
            <div className="branch-selector">
                <i className="fa-solid fa-location-dot" style={{ color: 'var(--primary-red)', marginRight: '8px' }}></i>
                <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                    <option value="napoles">Sucursal Nápoles</option>
                    <option value="obrera">Sucursal Obrera</option>
                    <option value="pedregal">Sucursal Pedregal</option>
                </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}><i className="fa-solid fa-circle"></i> En línea</span>
                <div style={{ width: '45px', height: '45px', background: 'var(--bg-lighter)', border: '1px solid var(--border-color)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <i className="fa-solid fa-user-tie" style={{ color: 'var(--text-muted)' }}></i>
                </div>
            </div>
        </header>
    );
}