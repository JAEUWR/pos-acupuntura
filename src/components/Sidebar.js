'use client';

export default function Sidebar({ activeView, setActiveView }) {
    const navItems = [
        { id: 'ventas', icon: 'fa-cart-shopping', title: 'Ventas' },
        { id: 'inventario', icon: 'fa-boxes-stacked', title: 'Inventario' },
        { id: 'clientes', icon: 'fa-users', title: 'Clientes' },
        { id: 'reportes', icon: 'fa-chart-line', title: 'Reportes' },
        { id: 'configuracion', icon: 'fa-gear', title: 'Configuración' }
    ];

    return (
        <div className="sidebar">
            {navItems.map(item => (
                <div 
                    key={item.id}
                    className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                    onClick={() => setActiveView(item.id)}
                    title={item.title}
                >
                    <i className={`fa-solid ${item.icon}`}></i>
                </div>
            ))}
        </div>
    );
}