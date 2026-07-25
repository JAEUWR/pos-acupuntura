'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert('Error al iniciar sesión: ' + error.message);
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-dark)', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: 'var(--bg-panel)', padding: '40px', borderRadius: '12px', width: '400px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <i className="fa-solid fa-yin-yang" style={{ fontSize: '3rem', color: 'var(--primary-red)', marginBottom: '15px' }}></i>
                    <h2>Acupuntura China <span>HK</span></h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>Acceso al Sistema POS</p>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Correo Electrónico</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '5px' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contraseña</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '5px' }} />
                    </div>
                    
                    <button type="submit" className="btn-action btn-primary" disabled={loading} style={{ padding: '15px', fontSize: '1.1rem', marginTop: '10px' }}>
                        {loading ? 'Entrando...' : 'Iniciar Sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
}