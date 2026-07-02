'use client';
import { useState } from 'react';

export default function Inventario() {
    const [productos, setProductos] = useState([
        { id: '7502314482150', name: 'Consulta Acupuntura', price: 650.00, stockNapoles: 999, stockRoma: 999, stockCentro: 999 },
        { id: '6920568400019', name: 'Parche Tigre Sobre', price: 80.00, stockNapoles: 24, stockRoma: 50, stockCentro: 12 },
        { id: '6936508703225', name: 'Aceite Tigre', price: 80.00, stockNapoles: 49, stockRoma: 20, stockCentro: 5 },
        { id: '1122334455667', name: 'Agujas Acupuntura (Caja)', price: 250.00, stockNapoles: 8, stockRoma: 10, stockCentro: 8 }
    ]);

    const promptAddProduct = () => {
        const name = prompt("Ingrese el nombre del nuevo producto:");
        if (!name) return;
        const price = prompt("Ingrese el precio unitario:");
        if (!price || isNaN(price)) return alert("Precio inválido");
        
        const newCode = '88800' + Math.floor(Math.random() * 10000);
        setProductos([...productos, {
            id: newCode, name, price: parseFloat(price),
            stockNapoles: 10, stockRoma: 10, stockCentro: 10
        }]);
    };

    return (
        <div className="view-section active">
            <div className="panel">
                <h2><i className="fa-solid fa-boxes-stacked"></i> Inventario Global Multisede</h2>
                <div style={{marginBottom: '15px'}}>
                    <button className="btn-action btn-primary" onClick={promptAddProduct} style={{marginRight: '10px'}}>
                        <i className="fa-solid fa-plus"></i> Nuevo Producto
                    </button>
                    <button className="btn-action" onClick={() => alert('Generando Excel...')}>
                        <i className="fa-solid fa-file-arrow-down"></i> Exportar a Excel
                    </button>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Código Barras</th>
                            <th>Producto</th>
                            <th>Precio Unit.</th>
                            <th>Stock Nápoles</th>
                            <th>Stock Roma</th>
                            <th>Stock Centro</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.map(prod => {
                            const isLow = (prod.stockNapoles + prod.stockRoma + prod.stockCentro) < 30 && prod.stockNapoles < 900;
                            return (
                                <tr key={prod.id}>
                                    <td style={{color: 'var(--text-muted)', fontFamily: 'monospace'}}>{prod.id}</td>
                                    <td><strong>{prod.name}</strong></td>
                                    <td>${prod.price.toFixed(2)}</td>
                                    <td>{prod.stockNapoles > 900 ? 'Ilimitado' : prod.stockNapoles}</td>
                                    <td>{prod.stockRoma > 900 ? 'Ilimitado' : prod.stockRoma}</td>
                                    <td>{prod.stockCentro > 900 ? 'Ilimitado' : prod.stockCentro}</td>
                                    <td>
                                        {isLow 
                                            ? <span style={{color:'var(--primary-red)'}}><i className="fa-solid fa-triangle-exclamation"></i> Bajo Stock</span>
                                            : <span style={{color:'var(--success)'}}><i className="fa-solid fa-circle-check"></i> Óptimo</span>
                                        }
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}