'use client';
import { useState } from 'react';

export default function Ventas() {
    const [barcode, setBarcode] = useState('');
    const [cart, setCart] = useState([]);
    
    // Base de datos simulada
    const productsDB = {
        '7502314482150': { code: '7502314482150', name: 'Consulta Acupuntura', price: 650.00 },
        '6920568400019': { code: '6920568400019', name: 'Parche Tigre', price: 80.00 },
        '6936508703225': { code: '6936508703225', name: 'Aceite Tigre', price: 80.00 },
        '1122334455667': { code: '1122334455667', name: 'Agujas (Caja)', price: 250.00 }
    };

    const handleSearch = () => {
        const code = barcode.trim();
        if (productsDB[code]) {
            addToCart(productsDB[code]);
            setBarcode('');
        } else {
            alert('Producto no encontrado. Intenta con los botones de Añadir Rápido.');
        }
    };

    const addToCart = (product) => {
        setCart(prevCart => {
            const existing = prevCart.find(item => item.code === product.code);
            if (existing) {
                return prevCart.map(item => 
                    item.code === product.code ? { ...item, qty: item.qty + 1 } : item
                );
            }
            return [...prevCart, { ...product, qty: 1 }];
        });
    };

    const updateQty = (code, delta) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.code === code) {
                    const newQty = item.qty + delta;
                    return newQty > 0 ? { ...item, qty: newQty } : item;
                }
                return item;
            });
        });
    };

    const removeItem = (code) => {
        setCart(prevCart => prevCart.filter(item => item.code !== code));
    };

    const handleCheckout = () => {
        if (cart.length === 0) return alert('El carrito está vacío.');
        
        // Simulación de latencia de red para que se vea real
        const btn = document.getElementById('btn-cobrar');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESANDO...';
        btn.disabled = true;
        
        setTimeout(() => {
            alert(`¡Venta procesada con éxito por $${subtotal.toFixed(2)}!\nLa base de datos multisede se ha actualizado.`);
            setCart([]);
            btn.innerHTML = '<i class="fa-solid fa-cash-register"></i> COBRAR [F12]';
            btn.disabled = false;
        }, 800);
    };

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

    return (
        <div className="view-section active">
            <div className="register-section">
                <div className="search-bar">
                    <input 
                        type="text" 
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Escanea o teclea el Código de Barras..." 
                        style={{ flex: 1, padding: '15px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '8px' }}
                    />
                    <button className="btn-action btn-primary" onClick={handleSearch}>
                        <i className="fa-solid fa-magnifying-glass"></i> BUSCAR
                    </button>
                </div>
                <div className="cart-table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th>Precio</th>
                                <th>Cant.</th>
                                <th>Importe</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>
                                        Carrito vacío. Escanea un producto.
                                    </td>
                                </tr>
                            ) : (
                                cart.map((item, idx) => (
                                    <tr key={idx}>
                                        <td><strong>{item.name}</strong><br/><small style={{color:'var(--text-muted)'}}>{item.code}</small></td>
                                        <td>${item.price.toFixed(2)}</td>
                                        <td>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-panel)', padding: '5px', borderRadius: '6px', width: 'max-content'}}>
                                                <button onClick={() => updateQty(item.code, -1)} style={{background: 'var(--bg-lighter)', color: 'white', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer'}}>-</button>
                                                <span style={{minWidth: '20px', textAlign: 'center'}}>{item.qty}</span>
                                                <button onClick={() => updateQty(item.code, 1)} style={{background: 'var(--bg-lighter)', color: 'white', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer'}}>+</button>
                                            </div>
                                        </td>
                                        <td>${(item.price * item.qty).toFixed(2)}</td>
                                        <td style={{textAlign: 'right'}}>
                                            <button onClick={() => removeItem(item.code)} style={{background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: '1.2rem'}}>
                                                <i className="fa-solid fa-trash-can"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="checkout-section">
                <div className="quick-products">
                    <h3 style={{marginBottom: '15px', color: 'var(--text-main)', fontSize: '1rem'}}>
                        <i className="fa-solid fa-bolt" style={{color: 'var(--accent)'}}></i> Añadir Rápido
                    </h3>
                    <div className="product-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px'}}>
                        {Object.values(productsDB).map((prod, idx) => (
                            <div key={idx} onClick={() => addToCart(prod)} className="product-card" style={{background: 'var(--bg-dark)', padding: '15px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', border: '1px solid var(--border-color)'}}>
                                <span style={{fontSize: '0.9rem'}}>{prod.name}</span>
                                <span style={{color: 'var(--success)', fontWeight: 'bold', display: 'block', marginTop: '5px'}}>${prod.price.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="totals-box">
                    <div className="totals-row grand-total">
                        <span>TOTAL:</span>
                        <span style={{color: 'var(--success)'}}>${subtotal.toFixed(2)}</span>
                    </div>
                    <button id="btn-cobrar" onClick={handleCheckout} className="pay-btn" style={{width: '100%', padding: '20px', background: 'var(--primary-red)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.3rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px'}}>
                        <i className="fa-solid fa-cash-register"></i> COBRAR [F12]
                    </button>
                </div>
            </div>
        </div>
    );
}