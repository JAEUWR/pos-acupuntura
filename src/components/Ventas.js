'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Asegúrate de tener exportado supabase aquí

export default function Ventas({ branch }) {
    const [barcode, setBarcode] = useState('');
    const [cart, setCart] = useState([]);
    const [productosDB, setProductosDB] = useState([]);

    // 1. Cargar productos desde Supabase al iniciar
    useEffect(() => {
        const fetchProductos = async () => {
            const { data } = await supabase.from('productos').select('*');
            if (data) setProductosDB(data);
        };
        fetchProductos();
    }, []);

    // Mapear el nombre de la sede al ID numérico de la DB
    const branchIdMap = { napoles: 1, roma: 2, centro: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const handleSearch = () => {
        const product = productosDB.find(p => p.codigo_barras === barcode.trim());
        if (product) {
            addToCart(product);
            setBarcode('');
        } else {
            alert('Producto no encontrado.');
        }
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            // Por defecto entra con precio general
            return [...prev, { 
                id: product.id, 
                code: product.codigo_barras, 
                name: product.nombre, 
                qty: 1, 
                tipo_precio: 'general',
                precio_aplicado: product.precio,
                opciones_precio: { general: product.precio, mayoreo: product.precio_mayoreo, distribuidor: product.precio_distribuidor }
            }];
        });
    };

    const updatePriceType = (id, tipo) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, tipo_precio: tipo, precio_aplicado: item.opciones_precio[tipo] };
            }
            return item;
        }));
    };

    const subtotal = cart.reduce((acc, item) => acc + (item.precio_aplicado * item.qty), 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return alert('Carrito vacío.');
        const btn = document.getElementById('btn-cobrar');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESANDO...';
        btn.disabled = true;

        // Preparamos el JSON para Supabase
        const payloadItems = cart.map(item => ({
            producto_id: item.id,
            qty: item.qty,
            precio: item.precio_aplicado,
            tipo_precio: item.tipo_precio
        }));

        // Llamamos a la función SQL que creamos
        const { error } = await supabase.rpc('procesar_venta', {
            p_sucursal_id: sucursalId,
            p_cliente_id: null, // Aquí podrías pasar el ID de un cliente seleccionado
            p_total: subtotal,
            p_items: payloadItems
        });

        if (error) {
            alert('Error al cobrar: ' + error.message);
        } else {
            alert('Venta procesada. El stock ha sido actualizado.');
            setCart([]);
        }
        btn.innerHTML = '<i class="fa-solid fa-cash-register"></i> COBRAR';
        btn.disabled = false;
    };

    return (
        <div className="view-section active">
            <div className="register-section">
                {/* Buscador igual que antes */}
                <div className="search-bar">
                    <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Código de Barras..." style={{flex:1, padding:'15px', background:'var(--bg-dark)', color:'white'}}/>
                    <button className="btn-action btn-primary" onClick={handleSearch}>BUSCAR</button>
                </div>
                
                <table className="data-table">
                    <thead>
                        <tr><th>Producto</th><th>Tipo Precio</th><th>Precio Unit.</th><th>Cant.</th><th>Importe</th></tr>
                    </thead>
                    <tbody>
                        {cart.map((item, idx) => (
                            <tr key={idx}>
                                <td>{item.name}</td>
                                <td>
                                    <select value={item.tipo_precio} onChange={(e) => updatePriceType(item.id, e.target.value)} style={{background:'var(--bg-dark)', color:'white', padding:'5px'}}>
                                        <option value="general">General</option>
                                        <option value="mayoreo">Mayoreo</option>
                                        <option value="distribuidor">Distribuidor</option>
                                    </select>
                                </td>
                                <td>${item.precio_aplicado.toFixed(2)}</td>
                                <td>{item.qty}</td>
                                <td>${(item.precio_aplicado * item.qty).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="checkout-section">
                <div className="totals-box">
                    <div className="totals-row grand-total"><span>TOTAL:</span><span style={{color: 'var(--success)'}}>${subtotal.toFixed(2)}</span></div>
                    <button id="btn-cobrar" onClick={handleCheckout} className="pay-btn"><i className="fa-solid fa-cash-register"></i> COBRAR</button>
                </div>
            </div>
        </div>
    );
}