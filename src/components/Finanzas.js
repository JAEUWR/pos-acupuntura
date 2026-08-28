'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Finanzas({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage();
    
    const [isMounted, setIsMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Parche Zona Horaria
    const parseDBDate = (dateStr) => {
        if (!dateStr) return new Date();
        let s = dateStr;
        if (!s.includes('Z') && !s.includes('+') && s.includes('T')) s += 'Z';
        else if (!s.includes('T')) s = s.replace(' ', 'T') + 'Z';
        return new Date(s);
    };

    // Controles Globales
    const [dateMode, setDateMode] = useState('diario'); 
    const [singleDate, setSingleDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [fechaTurno, setFechaTurno] = useState(''); 
    
    const [viewMode, setViewMode] = useState('sucursal'); 
    const [activeTab, setActiveTab] = useState('clinica'); 

    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    const [listaConsultas, setListaConsultas] = useState([]);
    const [listaProductos, setListaProductos] = useState([]);

    const [saldoCaja, setSaldoCaja] = useState(0);
    const [historialCaja, setHistorialCaja] = useState([]);
    const [historialGlobal, setHistorialGlobal] = useState([]);
    
    const [showCajaModal, setShowCajaModal] = useState(false);
    const [tipoMovCaja, setTipoMovCaja] = useState('fondo'); 
    const [montoCaja, setMontoCaja] = useState('');
    const [motivoCaja, setMotivoCaja] = useState('');
    const [shiftToView, setShiftToView] = useState(null);

    const [filtersA, setFiltersA] = useState({ folio: '', fecha: '', sucursal: '', cliente: '', articulo: '', metodo_pago: '', importe: '' });
    const [filtersB, setFiltersB] = useState({ folio: '', fecha: '', sucursal: '', cliente: '', articulo: '', metodo_pago: '', importe: '' });
    const [filtersCaja, setFiltersCaja] = useState({ fecha: '', tipo: '', motivo: '', monto: '' });
    
    const [activeDropdown, setActiveDropdown] = useState(null);

    useEffect(() => {
        setIsMounted(true);
        const today = new Date().toISOString().split('T')[0];
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        setSingleDate(today); setStartDate(firstDay); setEndDate(today); setFechaTurno(today); 
    }, []);

    const extraerValoresMixtos = (pagoString, importeDetalle, totalVentaOriginal) => {
        let valores = { efectivo: 0, tarjeta: 0, transferencia: 0 };
        try {
            const proporcion = totalVentaOriginal > 0 ? (importeDetalle / totalVentaOriginal) : 1;
            const efeMatch = pagoString.match(/Efe:\s*\$?([\d.]+)/i);
            if (efeMatch) valores.efectivo = parseFloat(efeMatch[1]) * proporcion;
            const tarMatch = pagoString.match(/Tar(?:[^:]*):\s*\$?([\d.]+)/i);
            if (tarMatch) valores.tarjeta = parseFloat(tarMatch[1]) * proporcion;
            const traMatch = pagoString.match(/Tra:\s*\$?([\d.]+)/i);
            if (traMatch) valores.transferencia = parseFloat(traMatch[1]) * proporcion;
        } catch (e) { console.error(e); }
        return valores;
    };

    const fetchFinanzas = async () => {
        if (!singleDate || !fechaTurno) return; 
        setLoading(true);

        const isDiario = dateMode === 'diario';
        const start = isDiario ? `${singleDate}T00:00:00` : `${startDate}T00:00:00`;
        const end = isDiario ? `${singleDate}T23:59:59` : `${endDate}T23:59:59`;

        let queryVentas = supabase.from('ventas').select(`id, total, fecha, metodo_pago, sucursal_id, sucursales(nombre), clientes(nombre), venta_detalles(cantidad, precio_unitario, tipo_precio, productos(id, nombre, tipo, codigo_barras, es_consulta))`).gte('fecha', start).lte('fecha', end).order('fecha', { ascending: false });
        if (viewMode === 'sucursal') queryVentas = queryVentas.eq('sucursal_id', sucursalId);
        
        let queryCaja = supabase.from('movimientos_caja').select('*').gte('fecha', start).lte('fecha', end).order('fecha', { ascending: false });
        if (viewMode === 'sucursal') queryCaja = queryCaja.eq('sucursal_id', sucursalId);

        let queryGlobal = supabase.from('movimientos_caja').select('*').eq('sucursal_id', sucursalId).order('fecha', { ascending: false }).limit(800);

        const { data: estadoCaja } = await supabase.from('cajas_estado').select('saldo_actual').eq('sucursal_id', sucursalId).single();
        if (estadoCaja) setSaldoCaja(parseFloat(estadoCaja.saldo_actual));

        const [resVentas, resCaja, resGlobal] = await Promise.all([queryVentas, queryCaja, queryGlobal]);

        if (resGlobal.data) setHistorialGlobal(resGlobal.data);

        let arrConsultas = []; let arrProductos = [];
        if (resVentas.data) {
            resVentas.data.forEach(v => {
                const clienteNombre = v.clientes?.nombre || 'Público General';
                const sucursalNombre = v.sucursales?.nombre || 'General';
                const pago = v.metodo_pago || 'Efectivo';
                const totalVentaOriginal = parseFloat(v.total) || 0;
                const esMixto = pago.toLowerCase().includes('mixto');

                let consultaItems = [];
                let importeConsultas = 0;
                let numVisitasReales = 0; 
                let mixtosConsultas = { efectivo: 0, tarjeta: 0, transferencia: 0 };

                v.venta_detalles?.forEach(det => {
                    const cant = parseInt(det.cantidad);
                    const precio = parseFloat(det.precio_unitario);
                    const importeDetalle = cant * precio;
                    const nombreArticulo = det.productos?.nombre || 'Art. Eliminado';
                    const esConsultaOficial = det.productos?.es_consulta === true; 
                    
                    let valoresMixtos = { efectivo: 0, tarjeta: 0, transferencia: 0 };
                    if (esMixto) valoresMixtos = extraerValoresMixtos(pago, importeDetalle, totalVentaOriginal);

                    if (esConsultaOficial) {
                        consultaItems.push(`${nombreArticulo} (x${cant})`);
                        importeConsultas += importeDetalle;
                        mixtosConsultas.efectivo += valoresMixtos.efectivo;
                        mixtosConsultas.tarjeta += valoresMixtos.tarjeta;
                        mixtosConsultas.transferencia += valoresMixtos.transferencia;

                        if (nombreArticulo.toLowerCase().includes('consulta')) {
                            numVisitasReales += cant;
                        }

                    } else {
                        arrProductos.push({ folio: v.id, fecha: parseDBDate(v.fecha).toLocaleString(), sucursal: sucursalNombre, cliente: clienteNombre, articulo: nombreArticulo, cantidad: cant, precio: precio, importe: importeDetalle, metodo_pago: pago, esMixto, valoresMixtos });
                    }
                });

                if (consultaItems.length > 0) {
                    arrConsultas.push({
                        folio: v.id, 
                        fecha: parseDBDate(v.fecha).toLocaleString(), 
                        sucursal: sucursalNombre, 
                        cliente: clienteNombre, 
                        articulo: consultaItems.join(' + '), 
                        cantidad: numVisitasReales, 
                        importe: importeConsultas, 
                        metodo_pago: pago, 
                        esMixto, 
                        valoresMixtos: mixtosConsultas 
                    });
                }
            });
        }

        setListaConsultas(arrConsultas);
        setListaProductos(arrProductos);
        if (resCaja.data) setHistorialCaja(resCaja.data);
        
        setLoading(false);
    };

    useEffect(() => { fetchFinanzas(); }, [dateMode, singleDate, startDate, endDate, viewMode, branch, fechaTurno]);

    const applyFilters = (list, filters) => {
        return list.filter(item => {
            return Object.keys(filters).every(key => {
                if (!filters[key]) return true;
                const filterValue = String(filters[key]).toLowerCase();
                let itemValue = String(item[key] || '').toLowerCase();
                if (key === 'folio') itemValue = `#${item.folio.toString().padStart(5, '0')}`.toLowerCase();
                if (key === 'importe' || key === 'monto') itemValue = `$${Math.abs(parseFloat(item[key])).toFixed(2)}`.toLowerCase();
                if (key === 'tipo') {
                    if (item.tipo === 'venta_efectivo') itemValue = 'venta efectivo';
                    else if (item.tipo === 'ingreso_manual') itemValue = 'ingreso manual';
                    else if (item.tipo === 'retiro_manual') itemValue = 'retiro manual';
                    else if (item.tipo === 'corte_caja') itemValue = 'corte caja';
                    else itemValue = item.tipo?.toLowerCase();
                }
                return itemValue.includes(filterValue);
            });
        });
    };

    const clasificarPago = (metodoString) => {
        const str = metodoString.toLowerCase();
        if (str.includes('mixto')) return 'mixto';
        if (str.includes('efectivo') || str.includes('cash')) return 'efectivo';
        if (str.includes('tarjeta') || str.includes('card')) return 'tarjeta';
        if (str.includes('transferencia') || str.includes('folio') || str.includes('transf')) return 'transferencia';
        return 'otros';
    };

    const consultasFiltradas = applyFilters(listaConsultas, filtersA);
    const productosFiltrados = applyFilters(listaProductos, filtersB);
    const cajaFiltrada = applyFilters(historialCaja, filtersCaja);

    const totalCantidadConsultas = consultasFiltradas.reduce((acc, item) => acc + item.cantidad, 0);

    const desglosarVentas = (lista) => {
        const desglose = { total: 0, efectivo: 0, tarjeta: 0, transferencia: 0, otros: 0 };
        lista.forEach(item => {
            desglose.total += item.importe;
            const tipoPago = clasificarPago(item.metodo_pago);
            if (tipoPago === 'mixto') {
                desglose.efectivo += item.valoresMixtos?.efectivo || 0;
                desglose.tarjeta += item.valoresMixtos?.tarjeta || 0;
                desglose.transferencia += item.valoresMixtos?.transferencia || 0;
            } else {
                desglose[tipoPago] += item.importe;
            }
        });
        return desglose;
    };

    const breakdownA = desglosarVentas(consultasFiltradas);
    const breakdownB = desglosarVentas(productosFiltrados);
    const breakdownTotal = { total: breakdownA.total + breakdownB.total, efectivo: breakdownA.efectivo + breakdownB.efectivo, tarjeta: breakdownA.tarjeta + breakdownB.tarjeta, transferencia: breakdownA.transferencia + breakdownB.transferencia };

    let cFondo = 0, cVentas = 0, cEntradas = 0, cSalidas = 0, cCortes = 0;
    
    let movimientosTurnoVirtual = [];
    const idxLastCorte = cajaFiltrada.findIndex(m => m.tipo === 'corte_caja');
    if (idxLastCorte === -1) movimientosTurnoVirtual = cajaFiltrada;
    else movimientosTurnoVirtual = cajaFiltrada.slice(0, idxLastCorte);

    movimientosTurnoVirtual.forEach(m => {
        const amt = Math.abs(parseFloat(m.monto));
        if (m.tipo === 'venta_efectivo') cVentas += amt;
        else if (m.tipo === 'ingreso_manual') {
            if (m.motivo.toLowerCase().includes('fondo')) cFondo += amt;
            else cEntradas += amt;
        }
        else if (m.tipo === 'retiro_manual') cSalidas += amt;
    });
    
    const registrarMovimientoCaja = async () => {
        if (!montoCaja || isNaN(montoCaja) || parseFloat(montoCaja) <= 0) return alert(t('alertaMontoInvalido') || 'Monto inválido.');
        let motivoFinal = motivoCaja.trim();
        if (tipoMovCaja === 'fondo') motivoFinal = `${t('fondoInicial') || 'Fondo Inicial'} - ${motivoCaja.trim() || 'Apertura'}`;
        else if (!motivoFinal) return alert(t('alertaMotivoVacio') || 'Debes especificar un motivo.');

        const montoFormateado = (tipoMovCaja === 'ingreso' || tipoMovCaja === 'fondo') ? parseFloat(montoCaja) : -parseFloat(montoCaja);

        if (tipoMovCaja === 'retiro' && parseFloat(montoCaja) > saldoCaja) {
            return alert(t('alertaEfectivoInsuficiente') || 'No hay suficiente efectivo en caja para realizar este retiro.');
        }

        const { error } = await supabase.rpc('registrar_movimiento_caja', { p_sucursal_id: sucursalId, p_tipo: (tipoMovCaja === 'ingreso' || tipoMovCaja === 'fondo') ? 'ingreso_manual' : 'retiro_manual', p_monto: montoFormateado, p_motivo: motivoFinal });

        if (error) alert('Error: ' + error.message);
        else { setShowCajaModal(false); setMontoCaja(''); setMotivoCaja(''); fetchFinanzas(); }
    };

    const hacerCorteCaja = async () => {
        if (saldoCaja <= 0) return alert(t('alertaCajaCero') || 'La caja está en cero. No hay efectivo que cortar.');
        if (!window.confirm(t('confirmarCorteLargo') || '¿Realizar el Corte de Caja?\n\nEl sistema extraerá TODO el dinero dejándolo en $0.00 y se generará el ticket.')) return;

        const snapshotTicket = `Corte|Fondo:${cFondo.toFixed(2)}|Ventas:${cVentas.toFixed(2)}|Entradas:${cEntradas.toFixed(2)}|Salidas:${cSalidas.toFixed(2)}|Total:${saldoCaja.toFixed(2)}`;

        const { error } = await supabase.rpc('registrar_movimiento_caja', { p_sucursal_id: sucursalId, p_tipo: 'corte_caja', p_monto: -saldoCaja, p_motivo: snapshotTicket });

        if (error) alert('Error: ' + error.message);
        else {
            alert(t('corteExitoso') || 'Corte de caja exitoso. La caja está ahora en $0.00.');
            imprimirTicketCorte(cFondo, cVentas, cEntradas, cSalidas, saldoCaja, new Date().toISOString(), movimientosTurnoVirtual);
            fetchFinanzas(); 
        }
    };

    const imprimirTicketCorte = (fondo, ventas, entradas, salidas, total, fechaStr, listaMovimientos) => {
        const printWindow = window.open('', '_blank');
        let movsHtml = '';
        if (listaMovimientos && listaMovimientos.length > 0) {
            movsHtml += `<div class="line"></div><div class="center bold" style="margin: 10px 0;">--- ${t('detalleMovimientos') || 'DETALLE DE MOVIMIENTOS'} ---</div>`;
            [...listaMovimientos].reverse().forEach(m => {
                const time = parseDBDate(m.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const sign = (m.tipo === 'retiro_manual' || m.tipo === 'corte_caja') ? '-' : '+';
                movsHtml += `<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;"><span style="width:20%;">${time}</span><span style="width:55%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.motivo}</span><span style="width:25%; text-align:right;">${sign}$${Math.abs(parseFloat(m.monto)).toFixed(2)}</span></div>`;
            });
            movsHtml += `<div class="line"></div>`;
        }

        const html = `
            <html><head><title>${t('ticketCorteTitulo') || 'Ticket de Corte'}</title>
            <style>body { font-family: 'Courier New', Courier, monospace; width: 320px; margin: 0 auto; padding: 20px 10px; color: #000; font-size: 14px; } .center { text-align: center; } .bold { font-weight: bold; } .line { border-bottom: 1px dashed #000; margin: 12px 0; } .row { display: flex; justify-content: space-between; margin: 6px 0; } .title { font-size: 20px; margin-bottom: 5px; } .subtitle { font-size: 12px; margin-bottom: 15px; }</style>
            </head><body>
                <div class="center bold title">ACUPUNTURA H.K.</div>
                <div class="center subtitle">${t('sucursalEmisora') || 'Sucursal'} ${branch.toUpperCase()}</div>
                <div class="center bold" style="font-size: 16px;">${t('ticketCorteAuditoria') || 'CORTE DE CAJA Y AUDITORÍA'}</div>
                <div class="line"></div>
                <div class="row"><span>${t('fecha') || 'Fecha'}:</span><span>${parseDBDate(fechaStr).toLocaleDateString()}</span></div>
                <div class="row"><span>${t('hora') || 'Hora'}:</span><span>${parseDBDate(fechaStr).toLocaleTimeString()}</span></div>
                ${movsHtml}
                <div class="row"><span>${t('fondoInicial') || 'Fondo Inicial'}:</span><span>$${parseFloat(fondo).toFixed(2)}</span></div>
                <div class="row"><span>${t('ventasEfectivoAbrev') || 'Ventas Efectivo'}:</span><span>+$${parseFloat(ventas).toFixed(2)}</span></div>
                <div class="row"><span>${t('entradas') || 'Entradas'}:</span><span>+$${parseFloat(entradas).toFixed(2)}</span></div>
                <div class="row"><span>${t('salidas') || 'Salidas/Retiros'}:</span><span>-$${parseFloat(salidas).toFixed(2)}</span></div>
                <div class="line"></div>
                <div class="row bold" style="font-size: 18px;"><span>${t('totalAuditado') || 'TOTAL AUDITADO'}:</span><span>$${parseFloat(total).toFixed(2)}</span></div>
                <div class="center" style="font-size: 10px; margin-top: 5px;">(Efectivo retirado físicamente del cajón)</div>
                <div class="line"></div>
                <div class="center" style="margin-top: 50px;">________________________</div>
                <div class="center">${t('firmaConformidad') || 'Firma de Conformidad'}</div>
            </body></html>
        `;
        printWindow.document.write(html); printWindow.document.close(); printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 800);
    };

    const verTicketHistorico = (movCorte) => {
        try {
            const parts = movCorte.motivo.split('|');
            const data = { fondo: parts[1].split(':')[1], ventas: parts[2].split(':')[1], entradas: parts[3].split(':')[1], salidas: parts[4].split(':')[1], total: parts[5].split(':')[1], fecha: movCorte.fecha, movimientos: [] };
            
            const cutTime = new Date(movCorte.fecha).getTime();
            const previousCuts = historialGlobal.filter(m => m.tipo === 'corte_caja' && new Date(m.fecha).getTime() < cutTime);
            const lastCutTime = previousCuts.length > 0 ? new Date(previousCuts[0].fecha).getTime() : 0;
            
            const shiftMovs = historialGlobal.filter(m => {
                const t = new Date(m.fecha).getTime();
                return t > lastCutTime && t < cutTime && m.tipo !== 'corte_caja';
            });
            
            imprimirTicketCorte(data.fondo, data.ventas, data.entradas, data.salidas, data.total, data.fecha, shiftMovs);
        } catch (e) { alert("Ticket con formato antiguo no soportado."); }
    };

    const exportarExcelPremium = () => {
        if (consultasFiltradas.length === 0 && productosFiltrados.length === 0) return alert(t('noDatosExportar') || 'No hay datos para exportar.');
        
        let htmlTable = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="UTF-8"><style>table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; } th, td { border: 1px solid #dddddd; padding: 10px; text-align: left; } th { background-color: #f2f2f2; font-weight: bold; } .header { font-size: 20px; font-weight: bold; color: #ffffff; background-color: #1e293b; text-align: center; } .summary-title { font-weight: bold; background-color: #e0f7fa; color: #00695c; } .summary-val { font-weight: bold; color: #00695c; text-align: right; } </style></head>
            <body>
                <table>
                    <tr><td colspan="8" class="header">REPORTE FINANCIERO - ACUPUNTURA HK (${branch.toUpperCase()})</td></tr>
                    <tr><td colspan="8" style="text-align:center; font-weight: bold; background-color: #f8fafc;">Período: ${dateMode === 'diario' ? singleDate : startDate + ' al ' + endDate}</td></tr>
                    <tr><td colspan="8"></td></tr>
                    
                    <!-- RESUMEN GLOBAL -->
                    <tr><td colspan="8" style="font-weight:bold; background-color:#333; color:white; text-align:center; font-size: 16px;">RESUMEN GENERAL</td></tr>
                    <tr><td colspan="4" class="summary-title">TOTAL EFECTIVO</td><td colspan="4" class="summary-val">$${breakdownTotal.efectivo.toFixed(2)}</td></tr>
                    <tr><td colspan="4" class="summary-title">TOTAL TARJETAS</td><td colspan="4" class="summary-val">$${breakdownTotal.tarjeta.toFixed(2)}</td></tr>
                    <tr><td colspan="4" class="summary-title">TOTAL TRANSFERENCIAS</td><td colspan="4" class="summary-val">$${breakdownTotal.transferencia.toFixed(2)}</td></tr>
                    <tr><td colspan="4" style="font-weight:bold; background-color:#0f172a; color:white;">GRAN TOTAL VENTAS</td><td colspan="4" style="font-weight:bold; background-color:#0f172a; color:#10b981; text-align:right; font-size:16px;">$${breakdownTotal.total.toFixed(2)}</td></tr>
                    <tr><td colspan="8"></td></tr>

                    <!-- EMPRESA A: ACUPUNTURA -->
                    <tr><td colspan="8" style="font-weight:bold; background-color:#0288d1; color:white; text-align:center; font-size: 16px;">${(t('acupuntura') || 'ACUPUNTURA').toUpperCase()}</td></tr>
                    <tr><th>Folio</th><th>Fecha</th><th>Sucursal</th><th>Cliente</th><th>Servicio Clínico</th><th>Visitas</th><th>Pago</th><th>Importe</th></tr>
        `;
        consultasFiltradas.forEach(c => { htmlTable += `<tr><td>#${c.folio.toString().padStart(5, '0')}</td><td>${c.fecha}</td><td>${c.sucursal}</td><td>${c.cliente}</td><td>${c.articulo}</td><td style="text-align:center; font-weight:bold; color:#0288d1;">${c.cantidad}</td><td>${c.metodo_pago.toUpperCase()}</td><td>$${c.importe.toFixed(2)}</td></tr>`; });
        htmlTable += `
                    <tr><td colspan="6" style="text-align:right; color:#555;">${t('subtotalEfectivo') || 'Subtotal Efectivo'}:</td><td colspan="2" style="color:#555; text-align:right;">$${breakdownA.efectivo.toFixed(2)}</td></tr>
                    <tr><td colspan="6" style="text-align:right; color:#555;">${t('subtotalTarjeta') || 'Subtotal Tarjeta'}:</td><td colspan="2" style="color:#555; text-align:right;">$${breakdownA.tarjeta.toFixed(2)}</td></tr>
                    <tr><td colspan="6" style="text-align:right; color:#555;">${t('subtotalTransferencia') || 'Subtotal Transf.'}:</td><td colspan="2" style="color:#555; text-align:right;">$${breakdownA.transferencia.toFixed(2)}</td></tr>
                    <tr><td colspan="6" style="text-align:right; font-weight:bold; font-size:14px; color:#0288d1;">TOTAL ${(t('acupuntura') || 'ACUPUNTURA').toUpperCase()} (${totalCantidadConsultas} Visitas):</td><td colspan="2" style="font-weight:bold; font-size:14px; color:#0288d1; text-align:right;">$${breakdownA.total.toFixed(2)}</td></tr>
                    <tr><td colspan="8"></td></tr>
                    
                    <!-- EMPRESA B: HUANQIU -->
                    <tr><td colspan="8" style="font-weight:bold; background-color:#f57c00; color:white; text-align:center; font-size: 16px;">${(t('huanqiu') || 'HUANQIU').toUpperCase()}</td></tr>
                    <tr><th>Folio</th><th>Fecha</th><th>Sucursal</th><th>Cliente</th><th>Producto / Extra</th><th>Cant</th><th>Pago</th><th>Importe</th></tr>
        `;
        // 🚀 CORRECCIÓN EXACTA APLICADA AQUÍ: Se cambió c.cantidad por p.cantidad
        productosFiltrados.forEach(p => { htmlTable += `<tr><td>#${p.folio.toString().padStart(5, '0')}</td><td>${p.fecha}</td><td>${p.sucursal}</td><td>${p.cliente}</td><td>${p.articulo}</td><td style="text-align:center; font-weight:bold; color:#f57c00;">${p.cantidad}</td><td>${p.metodo_pago.toUpperCase()}</td><td>$${p.importe.toFixed(2)}</td></tr>`; });
        htmlTable += `
                    <tr><td colspan="6" style="text-align:right; color:#555;">${t('subtotalEfectivo') || 'Subtotal Efectivo'}:</td><td colspan="2" style="color:#555; text-align:right;">$${breakdownB.efectivo.toFixed(2)}</td></tr>
                    <tr><td colspan="6" style="text-align:right; color:#555;">${t('subtotalTarjeta') || 'Subtotal Tarjeta'}:</td><td colspan="2" style="color:#555; text-align:right;">$${breakdownB.tarjeta.toFixed(2)}</td></tr>
                    <tr><td colspan="6" style="text-align:right; color:#555;">${t('subtotalTransferencia') || 'Subtotal Transf.'}:</td><td colspan="2" style="color:#555; text-align:right;">$${breakdownB.transferencia.toFixed(2)}</td></tr>
                    <tr><td colspan="6" style="text-align:right; font-weight:bold; font-size:14px; color:#f57c00;">TOTAL ${(t('huanqiu') || 'HUANQIU').toUpperCase()}:</td><td colspan="2" style="font-weight:bold; font-size:14px; color:#f57c00; text-align:right;">$${breakdownB.total.toFixed(2)}</td></tr>
                </table></body></html>
        `;

        const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `Reporte_Financiero_AcupunturaHK_${dateMode === 'diario' ? singleDate : startDate}.xls`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const generarReportePDF = () => {
        const printWindow = window.open('', '_blank');
        const periodStr = dateMode === 'diario' ? singleDate : `${startDate} al ${endDate}`;
        const html = `
            <!DOCTYPE html>
            <html><head><title>${t('reporteFinancieroDoc') || 'Reporte Financiero'}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #d32f2f; padding-bottom: 10px; }
                .title { font-size: 24px; font-weight: bold; color: #d32f2f; margin: 0; }
                .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
                .summary-grid { display: flex; gap: 15px; margin-bottom: 30px; }
                .card { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 15px; background: #f9f9f9; }
                .card h3 { margin: 0 0 10px 0; font-size: 13px; color: #333; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                .card .val { font-size: 24px; font-weight: bold; color: #111; margin-bottom: 10px; }
                .card .detail { font-size: 11px; color: #555; display: flex; justify-content: space-between; margin-bottom: 3px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11px; }
                th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
                th { background-color: #e0e0e0; font-weight: bold; color: #111; }
                .section-title { font-size: 16px; color: #d32f2f; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; page-break-after: avoid; }
            </style>
            </head><body>
                <div class="header">
                    <h1 class="title">ACUPUNTURA H.K. - ${t('reporteFinancieroDoc') || 'Reporte Financiero'}</h1>
                    <div class="subtitle">Sucursal: ${branch.toUpperCase()} &nbsp;|&nbsp; Período: ${periodStr}</div>
                </div>

                <div class="summary-grid">
                    <div class="card" style="border-top: 4px solid #10b981; background: #f0fdf4;">
                        <h3>Caja Física (Flujo)</h3>
                        <div class="val" style="color:#10b981;">$${saldoCaja.toFixed(2)}</div>
                        <div class="detail"><span>Fondo:</span> <span>$${cFondo.toFixed(2)}</span></div>
                        <div class="detail"><span>Ventas(Efe):</span> <span>+$${cVentas.toFixed(2)}</span></div>
                        <div class="detail"><span>Entradas:</span> <span>+$${cEntradas.toFixed(2)}</span></div>
                        <div class="detail"><span>Salidas:</span> <span>-$${cSalidas.toFixed(2)}</span></div>
                    </div>
                    <div class="card" style="border-top: 4px solid #00b0ff; background: #f0f9ff;">
                        <h3>${t('acupuntura') || 'ACUPUNTURA'}</h3>
                        <div class="val">$${breakdownA.total.toFixed(2)}</div>
                        <div class="detail" style="color:#0288d1; font-weight:bold; margin-bottom:6px; border-bottom: 1px dashed #ccc; padding-bottom:4px;"><span>${t('totalConsultasRealizadas') || 'Visitas'}:</span> <span>${totalCantidadConsultas}</span></div>
                        <div class="detail"><span>Efectivo:</span> <span>$${breakdownA.efectivo.toFixed(2)}</span></div>
                        <div class="detail"><span>Tarjetas:</span> <span>$${breakdownA.tarjeta.toFixed(2)}</span></div>
                        <div class="detail"><span>Transf:</span> <span>$${breakdownA.transferencia.toFixed(2)}</span></div>
                    </div>
                    <div class="card" style="border-top: 4px solid #ffb300; background: #fffbf0;">
                        <h3>${t('huanqiu') || 'HUANQIU'}</h3>
                        <div class="val">$${breakdownB.total.toFixed(2)}</div>
                        <div class="detail" style="margin-bottom:6px; border-bottom: 1px dashed transparent; padding-bottom:4px;">&nbsp;</div>
                        <div class="detail"><span>Efectivo:</span> <span>$${breakdownB.efectivo.toFixed(2)}</span></div>
                        <div class="detail"><span>Tarjetas:</span> <span>$${breakdownB.tarjeta.toFixed(2)}</span></div>
                        <div class="detail"><span>Transf:</span> <span>$${breakdownB.transferencia.toFixed(2)}</span></div>
                    </div>
                    <div class="card" style="border-top: 4px solid #d32f2f; background: #fff5f5;">
                        <h3>Gran Total Ventas</h3>
                        <div class="val" style="color:#d32f2f;">$${breakdownTotal.total.toFixed(2)}</div>
                        <div class="detail" style="margin-bottom:6px; border-bottom: 1px dashed transparent; padding-bottom:4px;">&nbsp;</div>
                        <div class="detail"><span>Efectivo:</span> <span>$${breakdownTotal.efectivo.toFixed(2)}</span></div>
                        <div class="detail"><span>Tarjetas:</span> <span>$${breakdownTotal.tarjeta.toFixed(2)}</span></div>
                        <div class="detail"><span>Transf:</span> <span>$${breakdownTotal.transferencia.toFixed(2)}</span></div>
                    </div>
                </div>

                <h2 class="section-title">Detalle de Consultas (${t('acupuntura') || 'Acupuntura'})</h2>
                <table>
                    <thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Servicios Agrupados</th><th>Visitas</th><th>Pago</th><th>Importe</th></tr></thead>
                    <tbody>${consultasFiltradas.map(c => `<tr><td>#${c.folio.toString().padStart(5, '0')}</td><td>${c.fecha}</td><td>${c.cliente}</td><td>${c.articulo}</td><td style="text-align:center; font-weight:bold; color:#0288d1;">${c.cantidad}</td><td>${c.metodo_pago.toUpperCase()}</td><td>$${c.importe.toFixed(2)}</td></tr>`).join('')}</tbody>
                </table>

                <h2 class="section-title">Detalle de Productos y Extras (${t('huanqiu') || 'Huanqiu'})</h2>
                <table>
                    <thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Producto Extra</th><th>Cant</th><th>Pago</th><th>Importe</th></tr></thead>
                    <tbody>${productosFiltrados.map(p => `<tr><td>#${p.folio.toString().padStart(5, '0')}</td><td>${p.fecha}</td><td>${p.cliente}</td><td>${p.articulo}</td><td style="text-align:center; font-weight:bold; color:#f57c00;">${p.cantidad}</td><td>${p.metodo_pago.toUpperCase()}</td><td>$${p.importe.toFixed(2)}</td></tr>`).join('')}</tbody>
                </table>

                <h2 class="section-title">Auditoría de Movimientos de Caja</h2>
                <table>
                    <thead><tr><th colspan="2">Fecha y Hora</th><th colspan="2">Movimiento</th><th colspan="3">Motivo / Detalles</th><th>Importe</th></tr></thead>
                    <tbody>${cajaFiltrada.map(m => {
                        const isNegative = m.tipo === 'retiro_manual' || m.tipo === 'corte_caja';
                        const sign = isNegative ? '-' : '+';
                        const desc = m.tipo === 'corte_caja' ? 'Cierre de Turno y Auditoría' : m.motivo;
                        return `<tr><td colspan="2">${parseDBDate(m.fecha).toLocaleString()}</td><td colspan="2">${m.tipo.replace('_', ' ').toUpperCase()}</td><td colspan="3">${desc}</td><td>${sign}$${Math.abs(parseFloat(m.monto)).toFixed(2)}</td></tr>`;
                    }).join('')}</tbody>
                </table>
                <div style="text-align:center; font-size:10px; color:#999; margin-top:30px;">${t('generadoAuto') || 'Generado automáticamente por el sistema'}</div>
            </body></html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 800);
    };

    const getEtiquetaCaja = (tipo) => {
        if (tipo === 'venta_efectivo') return <span style={{background: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold'}}><i className="fa-solid fa-basket-shopping"></i> {t('ventaEfectivoAbrev') || 'Venta'}</span>;
        if (tipo === 'ingreso_manual') return <span style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold'}}><i className="fa-solid fa-arrow-down"></i> {t('entradaBtn') || 'Ingreso'}</span>;
        if (tipo === 'retiro_manual') return <span style={{background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold'}}><i className="fa-solid fa-arrow-up"></i> {t('salidaBtn') || 'Retiro'}</span>;
        if (tipo === 'corte_caja') return <span style={{background: 'var(--text-main)', color: 'var(--bg-panel)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '900'}}><i className="fa-solid fa-scissors"></i> {t('corteCajaBtn') || 'Corte'}</span>;
        return <span>{tipo}</span>;
    };

    const getUniqueValues = (list, column) => {
        const vals = list.map(item => {
            if (column === 'folio') return `#${item.folio.toString().padStart(5, '0')}`;
            if (column === 'importe' || column === 'monto') return `$${Math.abs(parseFloat(item[column])).toFixed(2)}`;
            if (column === 'metodo_pago') return item.metodo_pago.toUpperCase();
            if (column === 'fecha') return parseDBDate(item.fecha).toLocaleDateString();
            if (column === 'tipo') {
                if (item.tipo === 'venta_efectivo') return t('ventaEfectivoAbrev') || 'Venta Efectivo';
                if (item.tipo === 'ingreso_manual') return t('entradaBtn') || 'Ingreso Manual';
                if (item.tipo === 'retiro_manual') return t('salidaBtn') || 'Retiro Manual';
                if (item.tipo === 'corte_caja') return t('corteCajaBtn') || 'Corte Caja';
                return item.tipo;
            }
            return String(item[column] || '');
        });
        return [...new Set(vals)].sort();
    };

    const renderHeader = (title, column, list, filters, setFilters, isVisible = true) => {
        if (!isVisible) return null;
        const isActive = activeDropdown === column;
        const hasFilter = filters[column] && filters[column] !== '';
        const uniqueValues = getUniqueValues(list, column);
        const currentValue = filters[column];

        return (
            <th style={{ position: 'relative', padding: '15px', userSelect: 'none', transition: 'all 0.3s ease', cursor: 'pointer' }} onClick={() => setActiveDropdown(isActive ? null : column)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: hasFilter ? 'var(--accent)' : 'var(--text-muted)', fontWeight: hasFilter ? 'bold' : '600' }}>{title}</span>
                    <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7rem', color: hasFilter ? 'var(--accent)' : 'var(--text-muted)', transform: isActive ? 'rotate(180deg)' : 'rotate(0)' }}></i>
                </div>
                {isActive && (
                    <>
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} onClick={(e) => {e.stopPropagation(); setActiveDropdown(null);}}></div>
                        <div className="filter-popover" style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', zIndex: 11, width: '220px', boxShadow: 'var(--shadow-lg)', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                            <input type="text" placeholder="🔍 Buscar..." value={currentValue} onChange={(e) => setFilters(prev => ({...prev, [column]: e.target.value}))} style={{ width: '100%', padding: '10px', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '10px', fontSize: '0.85rem', outline: 'none' }} autoFocus />
                            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '5px' }}>
                                {uniqueValues.filter(v => v.toLowerCase().includes(currentValue.toLowerCase())).map((val, idx) => (
                                    <div key={idx} style={{ fontSize: '0.85rem', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)' }} onClick={() => { setFilters(prev => ({...prev, [column]: val})); setActiveDropdown(null); }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-dark)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{val}</div>
                                ))}
                            </div>
                            {hasFilter && <button onClick={() => { setFilters(prev => ({...prev, [column]: ''})); setActiveDropdown(null); }} style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'rgba(211, 47, 47, 0.1)', color: 'var(--primary-red)', border: '1px solid var(--primary-red)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('cancelar') || 'Borrar Filtro'}</button>}
                        </div>
                    </>
                )}
            </th>
        );
    };

    if (!isMounted) return <div className="view-section active" style={{minHeight: '100vh', background: 'var(--bg-main)'}}></div>;

    return (
        <div suppressHydrationWarning className="view-section active animate-fade-in" style={{flexDirection: 'column', gap: '25px', overflowY: 'auto', paddingRight: '5px'}}>
            
            {/* 🚀 PANEL DE NAVEGACIÓN Y FECHAS */}
            <div className="panel" style={{display: 'flex', flexDirection: 'column', gap: '20px', padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '20px'}}>
                    <div style={{display: 'flex', gap: '10px'}}>
                        <button className={`btn-action ${dateMode === 'diario' ? 'btn-primary' : ''}`} onClick={() => {setDateMode('diario'); setFechaTurno(singleDate);}} style={{padding: '10px 20px', borderRadius: '30px'}}><i className="fa-solid fa-calendar-day"></i> {t('reporteDiario') || 'Diario'}</button>
                        <button className={`btn-action ${dateMode === 'periodo' ? 'btn-primary' : ''}`} onClick={() => setDateMode('periodo')} style={{padding: '10px 20px', borderRadius: '30px'}}><i className="fa-solid fa-calendar-week"></i> {t('reportePeriodo') || 'Período'}</button>
                    </div>
                    <div style={{display: 'flex', gap: '10px'}}>
                        <button className={`btn-action ${viewMode === 'sucursal' ? 'btn-primary' : ''}`} onClick={() => setViewMode('sucursal')} style={{padding: '10px 20px', borderRadius: '30px'}}><i className="fa-solid fa-store"></i> {t('vistaSucursal') || 'Sucursal'} ({branch.toUpperCase()})</button>
                        {perfilActual?.rol === 'admin' && <button className={`btn-action ${viewMode === 'global' ? 'btn-primary' : ''}`} onClick={() => setViewMode('global')} style={{padding: '10px 20px', borderRadius: '30px'}}><i className="fa-solid fa-globe"></i> {t('vistaGlobal') || 'Global'}</button>}
                    </div>
                </div>

                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{display: 'flex', gap: '20px'}}>
                        {dateMode === 'diario' ? (
                            <div>
                                <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold'}}>{t('fechaGeneral') || 'Fecha General'}</label>
                                <input type="date" value={singleDate} onChange={(e) => {setSingleDate(e.target.value); setFechaTurno(e.target.value);}} style={{padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none'}} />
                            </div>
                        ) : (
                            <>
                                <div><label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold'}}>{t('desde') || 'Desde'}</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px'}} /></div>
                                <div><label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 'bold'}}>{t('hasta') || 'Hasta'}</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px'}} /></div>
                            </>
                        )}
                    </div>
                    <div style={{display: 'flex', gap: '15px'}}>
                        <button className="btn-action" onClick={exportarExcelPremium} style={{background: 'rgba(46, 125, 50, 0.1)', color: 'var(--success)', border: '1px solid var(--success)', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', transition: '0.3s'}} onMouseEnter={e => {e.currentTarget.style.background = 'var(--success)'; e.currentTarget.style.color = 'white';}} onMouseLeave={e => {e.currentTarget.style.background = 'rgba(46, 125, 50, 0.1)'; e.currentTarget.style.color = 'var(--success)';}}><i className="fa-solid fa-file-excel"></i> {t('exportarExcel') || 'Exportar Excel'}</button>
                        <button className="btn-action" onClick={generarReportePDF} style={{background: 'rgba(211, 47, 47, 0.1)', color: 'var(--primary-red)', border: '1px solid var(--primary-red)', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', transition: '0.3s'}} onMouseEnter={e => {e.currentTarget.style.background = 'var(--primary-red)'; e.currentTarget.style.color = 'white';}} onMouseLeave={e => {e.currentTarget.style.background = 'rgba(211, 47, 47, 0.1)'; e.currentTarget.style.color = 'var(--primary-red)';}}><i className="fa-solid fa-file-pdf"></i> {t('imprimirReporte') || 'Imprimir Reporte'}</button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{textAlign: 'center', padding: '80px', color: 'var(--accent)'}}><i className="fa-solid fa-circle-notch fa-spin fa-3x"></i><p style={{marginTop:'15px', fontWeight: 'bold'}}>{t('analizandoFinanzas') || 'Analizando finanzas...'}</p></div>
            ) : (
                <>
                    {/* 🚀 DASHBOARD DE 4 TARJETAS PREMIUM */}
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px'}}>
                        
                        {/* 1. CAJA FÍSICA (Emerald) */}
                        <div className="dash-card-premium animate-slide-up" style={{ '--card-color': '#10b981', position: 'relative', overflow: 'hidden', animationDelay: '0.1s' }}>
                            <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)', zIndex: 0}}></div>
                            <div style={{position: 'relative', zIndex: 1, color: 'white'}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                                    <span style={{fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.7)'}}><i className="fa-solid fa-cash-register" style={{marginRight: '8px'}}></i> {t('cajaFisica') || 'Caja Física'}</span>
                                    {viewMode === 'sucursal' && dateMode === 'diario' && singleDate === new Date().toISOString().split('T')[0] && (
                                        <span style={{background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', color: '#10b981', fontWeight: 'bold'}}><span className="live-dot"></span> {t('enVivo') || 'EN VIVO'}</span>
                                    )}
                                </div>
                                <span style={{fontSize: '2.5rem', fontWeight: '900', display:'block', marginBottom: '15px', fontFamily: 'monospace', textShadow: '0 4px 10px rgba(0,0,0,0.5)'}}>
                                    ${viewMode === 'global' ? '---' : saldoCaja.toFixed(2)}
                                </span>
                                
                                <div style={{background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', marginBottom: '15px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'6px'}}><span style={{color:'rgba(255,255,255,0.6)'}}>{t('fondoInicial') || 'Fondo Inicial'}:</span> <span>${cFondo.toFixed(2)}</span></div>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'6px'}}><span style={{color:'rgba(255,255,255,0.6)'}}>{t('ventasEfectivoAbrev') || 'Ventas (Efe)'}:</span> <span style={{color:'#10b981'}}>+${cVentas.toFixed(2)}</span></div>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'6px'}}><span style={{color:'rgba(255,255,255,0.6)'}}>{t('entradas') || 'Entradas'}:</span> <span style={{color:'#10b981'}}>+${cEntradas.toFixed(2)}</span></div>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'6px'}}><span style={{color:'rgba(255,255,255,0.6)'}}>{t('salidas') || 'Salidas'}:</span> <span style={{color:'#ef4444'}}>-${cSalidas.toFixed(2)}</span></div>
                                </div>

                                {viewMode === 'sucursal' && dateMode === 'diario' && singleDate === new Date().toISOString().split('T')[0] && (
                                    <div style={{display: 'flex', gap: '8px'}}>
                                        <button onClick={() => {setTipoMovCaja('fondo'); setShowCajaModal(true);}} style={{flex: 1, padding: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', transition: '0.2s'}} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}><i className="fa-solid fa-piggy-bank"></i> {t('fondoCajaBtn') || 'Fondo'}</button>
                                        <button onClick={() => {setTipoMovCaja('ingreso'); setShowCajaModal(true);}} style={{flex: 1, padding: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', transition: '0.2s'}} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}><i className="fa-solid fa-arrow-down"></i> {t('entradaBtn') || 'Ent.'}</button>
                                        <button onClick={() => {setTipoMovCaja('retiro'); setShowCajaModal(true);}} style={{flex: 1, padding: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', transition: '0.2s'}} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}><i className="fa-solid fa-arrow-up"></i> {t('salidaBtn') || 'Sal.'}</button>
                                        <button onClick={hacerCorteCaja} style={{flex: 1, padding: '8px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', boxShadow: '0 2px 10px rgba(239, 68, 68, 0.4)'}}><i className="fa-solid fa-scissors"></i> {t('corteCajaBtn') || 'Corte'}</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. ACUPUNTURA (Azul) */}
                        <div className="dash-card-premium animate-slide-up" style={{ '--card-color': '#0288d1', animationDelay: '0.2s' }}>
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                    <div style={{background: 'rgba(2, 136, 209, 0.1)', padding: '10px', borderRadius: '10px'}}><i className="fa-solid fa-user-doctor" style={{fontSize: '1.2rem', color: '#0288d1'}}></i></div>
                                    <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight: 'bold', textTransform: 'uppercase'}}>{t('acupuntura') || 'Acupuntura'}</span>
                                </div>
                                <div style={{background: 'rgba(2, 136, 209, 0.1)', border: '1px solid rgba(2, 136, 209, 0.3)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', color: '#0288d1', display: 'flex', alignItems: 'center'}} title="Total de visitas / pacientes">
                                    <i className="fa-solid fa-users" style={{marginRight: '6px'}}></i> {totalCantidadConsultas} {t('totalConsultasRealizadas') || 'Visitas'}
                                </div>
                            </div>
                            <span style={{fontSize: '2.2rem', fontWeight: '900', display:'block', color: 'var(--text-main)', marginBottom: '15px'}}>${breakdownA.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                            <div className="breakdown-section">
                                <div><span>{t('efectivoLabel') || 'Efectivo'}</span> <strong>${breakdownA.efectivo.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span>{t('tarjetaLabel') || 'Tarjetas'}</span> <strong>${breakdownA.tarjeta.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span>{t('transferenciaLabel') || 'Transfer.'}</span> <strong>${breakdownA.transferencia.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                            </div>
                        </div>

                        {/* 3. HUANQIU (Ambar) */}
                        <div className="dash-card-premium animate-slide-up" style={{ '--card-color': '#f57c00', animationDelay: '0.3s' }}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px'}}>
                                <div style={{background: 'rgba(245, 124, 0, 0.1)', padding: '10px', borderRadius: '10px'}}><i className="fa-solid fa-box-open" style={{fontSize: '1.2rem', color: '#f57c00'}}></i></div>
                                <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight: 'bold', textTransform: 'uppercase'}}>{t('huanqiu') || 'Huanqiu'}</span>
                            </div>
                            <span style={{fontSize: '2.2rem', fontWeight: '900', display:'block', color: 'var(--text-main)', marginBottom: '15px'}}>${breakdownB.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                            <div className="breakdown-section">
                                <div><span>{t('efectivoLabel') || 'Efectivo'}</span> <strong>${breakdownB.efectivo.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span>{t('tarjetaLabel') || 'Tarjetas'}</span> <strong>${breakdownB.tarjeta.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span>{t('transferenciaLabel') || 'Transfer.'}</span> <strong>${breakdownB.transferencia.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                            </div>
                        </div>

                        {/* 4. GRAN TOTAL (Verde) */}
                        <div className="dash-card-premium animate-slide-up" style={{ '--card-color': '#10b981', animationDelay: '0.4s' }}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px'}}>
                                <div style={{background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '10px'}}><i className="fa-solid fa-sack-dollar" style={{fontSize: '1.2rem', color: '#10b981'}}></i></div>
                                <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight: 'bold', textTransform: 'uppercase'}}>{t('granTotalVentas') || 'Gran Total Ventas'}</span>
                            </div>
                            <span style={{fontSize: '2.2rem', fontWeight: '900', display:'block', color: '#10b981', marginBottom: '15px'}}>${breakdownTotal.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                            <div className="breakdown-section">
                                <div><span style={{color: 'var(--text-main)'}}>{t('efectivoTotal') || 'Efectivo Total'}</span> <strong style={{color: 'var(--text-main)'}}>${breakdownTotal.efectivo.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span style={{color: 'var(--text-main)'}}>{t('tarjetaTotal') || 'Tarjetas Total'}</span> <strong style={{color: 'var(--text-main)'}}>${breakdownTotal.tarjeta.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                                <div><span style={{color: 'var(--text-main)'}}>{t('transfTotal') || 'Transf. Total'}</span> <strong style={{color: 'var(--text-main)'}}>${breakdownTotal.transferencia.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                            </div>
                        </div>
                    </div>

                    {/* 🚀 PESTAÑAS MODERNAS (TABS) */}
                    <div style={{display: 'flex', gap: '30px', borderBottom: '2px solid var(--border-color)', marginTop: '10px'}}>
                        <button onClick={() => setActiveTab('clinica')} style={{padding: '15px 10px', background: 'transparent', border: 'none', borderBottom: activeTab === 'clinica' ? '3px solid #0288d1' : '3px solid transparent', color: activeTab === 'clinica' ? '#0288d1' : 'var(--text-muted)', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.3s'}}><i className="fa-solid fa-user-doctor" style={{marginRight: '8px'}}></i> {t('consultasAcupuntura') || 'Consultas (Acupuntura)'} ({consultasFiltradas.length})</button>
                        <button onClick={() => setActiveTab('extras')} style={{padding: '15px 10px', background: 'transparent', border: 'none', borderBottom: activeTab === 'extras' ? '3px solid #f57c00' : '3px solid transparent', color: activeTab === 'extras' ? '#f57c00' : 'var(--text-muted)', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.3s'}}><i className="fa-solid fa-box-open" style={{marginRight: '8px'}}></i> {t('prodHuanqiu') || 'Prod. y Extras (Huanqiu)'} ({productosFiltrados.length})</button>
                        <button onClick={() => setActiveTab('caja')} style={{padding: '15px 10px', background: 'transparent', border: 'none', borderBottom: activeTab === 'caja' ? '3px solid #10b981' : '3px solid transparent', color: activeTab === 'caja' ? '#10b981' : 'var(--text-muted)', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.3s'}}><i className="fa-solid fa-cash-register" style={{marginRight: '8px'}}></i> {t('tabAuditoria') || 'Auditoría de Caja'} ({cajaFiltrada.length})</button>
                    </div>

                    {/* CONTENIDO DE LAS PESTAÑAS */}
                    <div className="panel" style={{padding: '0', overflow: 'hidden', borderRadius: '0 0 16px 16px', borderTop: 'none', boxShadow: 'var(--shadow-sm)'}}>
                        
                        {/* TAB 1: CLÍNICA (ACUPUNTURA) */}
                        {activeTab === 'clinica' && (
                            <div className="animate-fade-in" style={{maxHeight: '500px', overflowY: 'auto'}}>
                                <table className="data-table">
                                    <thead style={{position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                                        <tr>
                                            {renderHeader(t('folio') || 'Folio', 'folio', listaConsultas, filtersA, setFiltersA)}
                                            {renderHeader(t('fecha') || 'Fecha', 'fecha', listaConsultas, filtersA, setFiltersA)}
                                            {renderHeader(t('sucursalEmisora') || 'Sucursal', 'sucursal', listaConsultas, filtersA, setFiltersA, viewMode === 'global')}
                                            {renderHeader(t('clientes') || 'Cliente', 'cliente', listaConsultas, filtersA, setFiltersA)}
                                            {renderHeader(t('servicioClinico') || 'Servicios Agrupados', 'articulo', listaConsultas, filtersA, setFiltersA)}
                                            {renderHeader(t('cantidadAbrev') || 'Visitas', 'cantidad', listaConsultas, filtersA, setFiltersA)}
                                            {renderHeader(t('metPago') || 'Pago', 'metodo_pago', listaConsultas, filtersA, setFiltersA)}
                                            {renderHeader(t('importe') || 'Importe', 'importe', listaConsultas, filtersA, setFiltersA)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {consultasFiltradas.map((item, idx) => (
                                            <tr key={`c-${idx}`} className="animate-slide-up-row" style={{animationDelay: `${idx * 0.02}s`}}>
                                                <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{item.folio.toString().padStart(5, '0')}</td>
                                                <td style={{fontSize: '0.85rem', color: 'var(--text-main)'}}>{item.fecha}</td>
                                                {viewMode === 'global' && <td style={{color: 'var(--text-main)'}}>{item.sucursal}</td>}
                                                <td><strong style={{color: 'var(--text-main)'}}>{item.cliente}</strong></td>
                                                <td style={{color: '#0288d1', fontWeight: 'bold', fontSize: '0.85rem'}}>{item.articulo}</td>
                                                <td style={{textAlign: 'center'}}><span style={{background: 'rgba(2, 136, 209, 0.1)', color: '#0288d1', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold'}}>{item.cantidad}</span></td>
                                                <td><span style={{fontSize: '0.75rem', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '5px 10px', borderRadius: '20px', fontWeight: '600'}}>{item.metodo_pago.toUpperCase()}</span></td>
                                                <td style={{fontWeight: '900', color: 'var(--text-main)', fontSize: '1.1rem'}}>${item.importe.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {consultasFiltradas.length === 0 && <tr><td colSpan={viewMode === 'global' ? 8 : 7} style={{textAlign: 'center', padding: '60px', color: 'var(--text-muted)'}}><i className="fa-solid fa-folder-open fa-3x" style={{marginBottom: '15px', opacity: 0.3, display: 'block'}}></i> {t('sinDatosClinica') || 'No se encontraron ventas de clínica.'}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* TAB 2: EXTRAS (HUANQIU) */}
                        {activeTab === 'extras' && (
                            <div className="animate-fade-in" style={{maxHeight: '500px', overflowY: 'auto'}}>
                                <table className="data-table">
                                    <thead style={{position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                                        <tr>
                                            {renderHeader(t('folio') || 'Folio', 'folio', listaProductos, filtersB, setFiltersB)}
                                            {renderHeader(t('fecha') || 'Fecha', 'fecha', listaProductos, filtersB, setFiltersB)}
                                            {renderHeader(t('sucursalEmisora') || 'Sucursal', 'sucursal', listaProductos, filtersB, setFiltersB, viewMode === 'global')}
                                            {renderHeader(t('clientes') || 'Cliente', 'cliente', listaProductos, filtersB, setFiltersB)}
                                            {renderHeader(t('productoExtra') || 'Producto / Extra', 'articulo', listaProductos, filtersB, setFiltersB)}
                                            {renderHeader(t('cantidadAbrev') || 'Cant.', 'cantidad', listaProductos, filtersB, setFiltersB)}
                                            {renderHeader(t('metPago') || 'Pago', 'metodo_pago', listaProductos, filtersB, setFiltersB)}
                                            {renderHeader(t('importe') || 'Importe', 'importe', listaProductos, filtersB, setFiltersB)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productosFiltrados.map((item, idx) => (
                                            <tr key={`p-${idx}`} className="animate-slide-up-row" style={{animationDelay: `${idx * 0.02}s`}}>
                                                <td style={{fontFamily: 'monospace', color: 'var(--text-muted)'}}>#{item.folio.toString().padStart(5, '0')}</td>
                                                <td style={{fontSize: '0.85rem', color: 'var(--text-main)'}}>{item.fecha}</td>
                                                {viewMode === 'global' && <td style={{color: 'var(--text-main)'}}>{item.sucursal}</td>}
                                                <td><strong style={{color: 'var(--text-main)'}}>{item.cliente}</strong></td>
                                                <td style={{color: '#f57c00', fontWeight: 'bold'}}>{item.articulo}</td>
                                                <td style={{textAlign: 'center'}}><span style={{background: 'rgba(245, 124, 0, 0.1)', color: '#f57c00', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold'}}>{item.cantidad}</span></td>
                                                <td><span style={{fontSize: '0.75rem', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '5px 10px', borderRadius: '20px', fontWeight: '600'}}>{item.metodo_pago.toUpperCase()}</span></td>
                                                <td style={{fontWeight: '900', color: 'var(--text-main)', fontSize: '1.1rem'}}>${item.importe.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {productosFiltrados.length === 0 && <tr><td colSpan={viewMode === 'global' ? 8 : 7} style={{textAlign: 'center', padding: '60px', color: 'var(--text-muted)'}}><i className="fa-solid fa-box-open fa-3x" style={{marginBottom: '15px', opacity: 0.3, display: 'block'}}></i> {t('sinDatosExtras') || 'No se encontraron ventas extra.'}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* TAB 3: AUDITORÍA CAJA */}
                        {activeTab === 'caja' && (
                            <div className="animate-fade-in" style={{maxHeight: '500px', overflowY: 'auto'}}>
                                <table className="data-table">
                                    <thead style={{position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-main)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                                        <tr>
                                            {renderHeader(t('fechaHoraCompleta') || 'Fecha y Hora', 'fecha', historialCaja, filtersCaja, setFiltersCaja)}
                                            {renderHeader(t('tipoMovimiento') || 'Movimiento', 'tipo', historialCaja, filtersCaja, setFiltersCaja)}
                                            {renderHeader(t('motivoDetalles') || 'Motivo / Descripción', 'motivo', historialCaja, filtersCaja, setFiltersCaja)}
                                            {renderHeader(t('importe') || 'Importe', 'monto', historialCaja, filtersCaja, setFiltersCaja)}
                                            <th style={{textAlign: 'center'}}><i className="fa-solid fa-print"></i> {t('ticketBtn') || 'Ticket'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cajaFiltrada.map((mov, index) => (
                                            <tr key={`caja-${mov.id}`} className="animate-slide-up-row" style={{background: mov.tipo === 'corte_caja' ? 'rgba(2, 132, 199, 0.03)' : 'transparent', animationDelay: `${index * 0.02}s`}}>
                                                <td style={{fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600'}}>{parseDBDate(mov.fecha).toLocaleString()}</td>
                                                <td>{getEtiquetaCaja(mov.tipo)}</td>
                                                <td style={{color: 'var(--text-main)', fontSize: '0.95rem'}}>
                                                    {mov.tipo === 'corte_caja' ? <strong style={{color: 'var(--text-main)'}}><i className="fa-solid fa-check-double" style={{color: 'var(--accent)', marginRight: '5px'}}></i> {t('cierreTurnoAuditoria') || 'Cierre de Turno y Auditoría'}</strong> : mov.motivo}
                                                </td>
                                                <td style={{textAlign: 'right', fontWeight: '900', fontSize: '1.2rem', color: mov.tipo === 'corte_caja' ? 'var(--text-main)' : (mov.monto > 0 ? 'var(--success)' : 'var(--primary-red)'), fontFamily: 'monospace'}}>
                                                    {mov.tipo === 'corte_caja' ? '--' : (mov.monto > 0 ? '+' : '') + parseFloat(mov.monto).toFixed(2)}
                                                </td>
                                                <td style={{textAlign: 'center'}}>
                                                    {mov.tipo === 'corte_caja' && (
                                                        <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                                                            <button onClick={() => {setShiftToView(visualizarTurnoPasado(mov, index));}} className="btn-action" style={{background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold'}} title={t('detalleBtn') || 'Ver Detalles'}>
                                                                <i className="fa-solid fa-eye"></i> {t('detalleBtn') || 'Detalle'}
                                                            </button>
                                                            <button onClick={() => verTicketHistorico(mov)} className="btn-action" style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold'}} title={t('reimprimirBtn') || 'Reimprimir'}>
                                                                <i className="fa-solid fa-print"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {cajaFiltrada.length === 0 && <tr><td colSpan="5" style={{textAlign: 'center', padding: '60px', color: 'var(--text-muted)'}}><i className="fa-solid fa-cash-register fa-3x" style={{marginBottom: '15px', opacity: 0.3, display: 'block'}}></i> {t('sinDatosCaja') || 'No hay movimientos de caja registrados.'}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 🚀 MODAL DE VISUALIZACIÓN DE TURNOS PASADOS */}
            {shiftToView && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box animate-scale-in" style={{background: 'var(--bg-panel)', padding: '0', borderRadius: '24px', width: '600px', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden'}}>
                        <div style={{background: 'var(--bg-main)', padding: '25px 30px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h3 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: '900'}}><i className="fa-solid fa-box-archive" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('detallesTurnoPasado') || 'Detalles del Turno Pasado'}</h3>
                            <button onClick={() => setShiftToView(null)} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer'}}>&times;</button>
                        </div>
                        <div style={{padding: '30px'}}>
                            <div style={{background: 'var(--bg-main)', padding: '20px', borderRadius: '12px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border-color)'}}>
                                <div><span style={{color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '5px'}}>{t('fechaHoraCierre') || 'Fecha y Hora de Cierre'}</span><strong style={{fontSize: '1.1rem', color: 'var(--text-main)'}}>{parseDBDate(shiftToView.fecha).toLocaleString()}</strong></div>
                                <div style={{textAlign: 'right'}}><span style={{color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '5px'}}>{t('totalAuditado') || 'Total Auditado'}</span><strong style={{fontSize: '1.3rem', color: 'var(--success)', fontFamily: 'monospace'}}>${parseFloat(shiftToView.total).toFixed(2)}</strong></div>
                            </div>
                            <div style={{background: 'rgba(2, 132, 199, 0.03)', padding: '20px', borderRadius: '12px', border: '1px dashed var(--accent)', marginBottom: '25px'}}>
                                <div className="receipt-row"><span className="r-label">{t('fondoCaja') || 'Fondo de caja'}</span><span className="r-value neutral">${parseFloat(shiftToView.fondo).toFixed(2)}</span></div>
                                <div className="receipt-row"><span className="r-label">{t('ventasEfectivoAbrev') || 'Ventas en Efectivo'}</span><span className="r-value positive">+ ${parseFloat(shiftToView.ventas).toFixed(2)}</span></div>
                                <div className="receipt-row"><span className="r-label">{t('entradas') || 'Entradas Manuales'}</span><span className="r-value positive">+ ${parseFloat(shiftToView.entradas).toFixed(2)}</span></div>
                                <div className="receipt-row"><span className="r-label">{t('salidasRetiros') || 'Salidas / Retiros'}</span><span className="r-value negative">- ${parseFloat(shiftToView.salidas).toFixed(2)}</span></div>
                            </div>
                            <h4 style={{color: 'var(--text-main)', marginBottom: '15px', fontSize: '1.1rem'}}><i className="fa-solid fa-list-ol" style={{color: 'var(--text-muted)', marginRight: '8px'}}></i> {t('transaccionesTurno') || 'Transacciones del Turno'} ({shiftToView.movimientos.length})</h4>
                            <div style={{maxHeight: '200px', overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                {shiftToView.movimientos.map((m, i) => (
                                    <div key={i} style={{display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center'}}>
                                        <div><strong style={{display: 'block', color: 'var(--text-main)', fontSize: '0.95rem'}}>{m.motivo}</strong><span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{parseDBDate(m.fecha).toLocaleTimeString()} • {m.tipo.replace('_', ' ').toUpperCase()}</span></div>
                                        <div style={{fontWeight: 'bold', fontFamily: 'monospace', color: m.monto > 0 ? 'var(--success)' : 'var(--primary-red)'}}>{m.monto > 0 ? '+' : ''}${Math.abs(parseFloat(m.monto)).toFixed(2)}</div>
                                    </div>
                                ))}
                                {shiftToView.movimientos.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: '20px'}}>{t('noTransaccionesTurno') || 'No hubo transacciones registradas en este turno.'}</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL INGRESOS Y RETIROS MANUALES CAJA */}
            {showCajaModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box animate-scale-in" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '24px', width: '450px', border: `1px solid ${tipoMovCaja === 'retiro' ? '#ea580c' : (tipoMovCaja === 'fondo' ? '#10b981' : 'var(--accent)')}`, boxShadow: '0 20px 50px rgba(0,0,0,0.3)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '20px', color: tipoMovCaja === 'retiro' ? '#ea580c' : (tipoMovCaja === 'fondo' ? '#10b981' : 'var(--accent)'), fontSize: '1.6rem', textAlign: 'center', fontWeight: '900'}}>
                            {tipoMovCaja === 'fondo' && <><i className="fa-solid fa-piggy-bank"></i> {t('establecerFondoCaja') || 'Establecer Fondo de Caja'}</>}
                            {tipoMovCaja === 'ingreso' && <><i className="fa-solid fa-arrow-down-to-line"></i> {t('ingresoCajaTitulo') || 'Ingreso de Efectivo'}</>}
                            {tipoMovCaja === 'retiro' && <><i className="fa-solid fa-arrow-up-from-bracket"></i> {t('retiroCajaTitulo') || 'Retiro de Efectivo'}</>}
                        </h3>
                        
                        {tipoMovCaja === 'ingreso' && <p style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '25px'}}>💡 {t('tipFondoCaja') || "Tip: Si es para arrancar el turno, incluye la palabra 'Fondo' en el motivo."}</p>}
                        
                        <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>{t('montoEfectivoDesc') || 'Monto en Efectivo ($)'}</label>
                        <input type="number" value={montoCaja} onChange={(e) => setMontoCaja(e.target.value)} placeholder="0.00" autoFocus style={{width:'100%', padding:'20px', marginBottom:'25px', background:'var(--bg-main)', color:'var(--text-main)', border: `2px solid ${tipoMovCaja === 'retiro' ? '#ea580c' : (tipoMovCaja === 'fondo' ? '#10b981' : 'var(--accent)')}`, borderRadius: '12px', fontSize: '2rem', fontWeight: '900', textAlign: 'center', outline: 'none'}} />
                        
                        {tipoMovCaja !== 'fondo' && (
                            <>
                                <label style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>{t('motivoDescripcion') || 'Motivo / Descripción'}</label>
                                <input type="text" value={motivoCaja} onChange={(e) => setMotivoCaja(e.target.value)} placeholder={tipoMovCaja === 'ingreso' ? 'Ej. Abono, etc.' : 'Ej. Pago de garrafones...'} style={{width:'100%', padding:'16px', marginBottom:'35px', background:'var(--bg-main)', color:'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '1.05rem', outline: 'none'}} />
                            </>
                        )}
                        
                        <div style={{display:'flex', gap:'15px', marginTop: tipoMovCaja === 'fondo' ? '20px' : '0'}}>
                            <button className="btn-action" style={{flex:1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.05rem'}} onClick={() => setShowCajaModal(false)}>{t('cancelar') || 'Cancelar'}</button>
                            <button className="btn-primary" style={{flex:2, padding: '16px', background: tipoMovCaja === 'retiro' ? '#ea580c' : (tipoMovCaja === 'fondo' ? '#10b981' : 'var(--accent)'), color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.2)'}} onClick={registrarMovimientoCaja}><i className="fa-solid fa-bolt"></i> {t('procesar') || 'Procesar'}</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .dash-card-premium { background: var(--bg-panel); padding: 25px; border-radius: 16px; border: 1px solid var(--border-color); border-left: 6px solid var(--card-color); display: flex; flex-direction: column; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: var(--shadow-sm); position: relative; overflow: hidden; }
                .dash-card-premium::before { content: ''; position: absolute; top: 0; right: 0; width: 150px; height: 150px; background: radial-gradient(circle, var(--card-color) 0%, transparent 70%); opacity: 0.05; transition: opacity 0.4s ease; border-radius: 50%; transform: translate(30%, -30%); pointer-events: none; }
                .dash-card-premium:hover { transform: translateY(-5px); box-shadow: 0 15px 30px -5px rgba(0,0,0,0.1), 0 0 20px 0 var(--card-color) inset; border-color: var(--card-color); }
                .dash-card-premium:hover::before { opacity: 0.15; }
                .breakdown-section { margin-top: auto; padding-top: 20px; border-top: 1px dashed var(--border-color); font-size: 0.85rem; display: flex; flex-direction: column; gap: 8px; }
                .breakdown-section div { display: flex; justify-content: space-between; color: var(--text-muted); }
                
                .receipt-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.95rem; }
                .r-label { color: rgba(255,255,255,0.7); font-weight: 600; }
                .r-value { font-family: monospace; font-weight: bold; font-size: 1.1rem; }
                .r-value.neutral { color: #ffffff; }
                .r-value.positive { color: #10b981; }
                .r-value.negative { color: #ef4444; }

                .live-dot { display: inline-block; width: 6px; height: 6px; background: #10b981; border-radius: 50%; margin-right: 4px; animation: blink 1.5s infinite; }

                .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
                .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .pulse-glow { animation: pulseGlow 3s ease-in-out infinite alternate; }
                
                .animate-slide-up-row { opacity: 0; animation: slideUpRow 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }

                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes slideUpRow { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
                @keyframes pulseGlow { 0% { text-shadow: 0 4px 20px rgba(0,0,0,0.2); } 100% { text-shadow: 0 4px 30px rgba(16, 185, 129, 0.5); } }
            `}</style>
        </div>
    );
}