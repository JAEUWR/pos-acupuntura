'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function Inventario({ branch = 'napoles', perfilActual }) {
    const { t } = useLanguage(); 
    
    const [subVista, setSubVista] = useState('catalogo'); // catalogo, global, grupos, historial, promociones
    
    const [inventario, setInventario] = useState([]);
    const [inventarioGlobal, setInventarioGlobal] = useState([]);
    const [logs, setLogs] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    // ESTADOS: Buscadores
    const [searchTermLocal, setSearchTermLocal] = useState('');
    const [searchTermGlobal, setSearchTermGlobal] = useState('');
    const [searchFamiliaProd, setSearchFamiliaProd] = useState('');

    // Estados Modal Producto
    const [editingProductId, setEditingProductId] = useState(null);
    const [newTipo, setNewTipo] = useState('producto'); 
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newPriceMayoreo, setNewPriceMayoreo] = useState('');
    const [newPriceDistribuidor, setNewPriceDistribuidor] = useState('');
    const [newPriceMedico, setNewPriceMedico] = useState(''); 
    const [selectedGroup, setSelectedGroup] = useState('');
    const [usaPrecioSucursal, setUsaPrecioSucursal] = useState(false);
    const [esConsulta, setEsConsulta] = useState(false);

    // Estados Familias
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [selectedProductsForGroup, setSelectedProductsForGroup] = useState([]);

    // Estados Transferencia
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferData, setTransferData] = useState({ id: null, nombre: '', maxStock: 0 });
    const [transferDestino, setTransferDestino] = useState('');
    const [transferQty, setTransferQty] = useState('');
    const [transferMotivo, setTransferMotivo] = useState('');

    // ESTADOS PROMOCIONES
    const [promos, setPromos] = useState([]);
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [editingPromoId, setEditingPromoId] = useState(null);
    
    const [promoTargetType, setPromoTargetType] = useState('producto'); 
    const [promoSelectedProd, setPromoSelectedProd] = useState('');
    const [promoSelectedGrupo, setPromoSelectedGrupo] = useState('');
    const [promoName, setPromoName] = useState('');
    const [promoDiscountType, setPromoDiscountType] = useState('porcentaje');
    const [promoValue, setPromoValue] = useState('');
    const [promoReqQty, setPromoReqQty] = useState('');
    const [promoFreeQty, setPromoFreeQty] = useState('');
    const [promoStartDate, setPromoStartDate] = useState('');
    const [promoEndDate, setPromoEndDate] = useState('');
    
    const branchIdMap = { napoles: 1, obrera: 2, pedregal: 3 };
    const sucursalId = branchIdMap[branch] || 1;

    // 🚀 FUNCIÓN MAESTRA DE AUDITORÍA (SISTEMA FREEDOM HK)
    const logAuditoria = async (motivo, producto_id = null, cantidad = 0, tipo_movimiento = 'sistema') => {
        try {
            await supabase.from('historial_inventario').insert([{
                producto_id: producto_id,
                sucursal_id: sucursalId,
                cantidad: cantidad,
                tipo_movimiento: tipo_movimiento,
                motivo: motivo,
                usuario_nombre: perfilActual?.nombre || 'Usuario Desconocido' 
            }]);
        } catch (error) {
            console.error("Error al registrar auditoría:", error);
        }
    };

    const fetchDatos = async () => {
        const { data: gData } = await supabase.from('grupos_productos').select('*').order('nombre');
        if (gData) setGrupos(gData);

        if (subVista === 'catalogo' || subVista === 'grupos' || subVista === 'promociones') {
            const { data, error } = await supabase
                .from('inventario')
                .select('stock, precio, precio_mayoreo, precio_distribuidor, precio_medico, productos(id, codigo_barras, nombre, precio, precio_mayoreo, precio_distribuidor, precio_medico, grupo_id, tipo, activo, usa_precio_sucursal, es_consulta, grupos_productos(nombre))')
                .eq('sucursal_id', sucursalId);
            
            if (error) console.error("Error cargando catálogo local:", error.message);
            if (data) {
                const activos = data.filter(inv => inv.productos && inv.productos.activo !== false);
                setInventario(activos.sort((a,b) => (a.productos.nombre || '').localeCompare(b.productos.nombre || '')));
            }
        }
        
        if (subVista === 'historial') {
            const { data } = await supabase.from('historial_inventario').select('cantidad, tipo_movimiento, motivo, fecha, usuario_nombre, productos(nombre)').eq('sucursal_id', sucursalId).order('fecha', { ascending: false });
            if (data) setLogs(data);
        }

        if (subVista === 'global') {
            const { data, error } = await supabase.from('inventario').select('stock, sucursal_id, productos(id, codigo_barras, nombre, tipo, activo, es_consulta, grupos_productos(nombre))');
            if (error) console.error("Error cargando inventario global:", error.message);
            if (data) {
                const activos = data.filter(inv => inv.productos && inv.productos.activo !== false);
                const agrupado = {};
                activos.forEach(inv => {
                    const p = inv.productos;
                    if (!agrupado[p.id]) {
                        agrupado[p.id] = { id: p.id, code: p.codigo_barras, name: p.nombre, tipo: p.tipo, es_consulta: p.es_consulta, familia: p.grupos_productos?.nombre || t('suelto') || 'Suelto', napoles: 0, obrera: 0, pedregal: 0, total: 0 };
                    }
                    if (inv.sucursal_id === 1) agrupado[p.id].napoles += inv.stock;
                    if (inv.sucursal_id === 2) agrupado[p.id].obrera += inv.stock;
                    if (inv.sucursal_id === 3) agrupado[p.id].pedregal += inv.stock;
                    if (p.tipo !== 'servicio') agrupado[p.id].total += inv.stock;
                });
                setInventarioGlobal(Object.values(agrupado).sort((a,b) => (a.name || '').localeCompare(b.name || '')));
            }
        }

        if (subVista === 'promociones') {
            const { data: pData } = await supabase.from('promociones').select('*, productos(nombre), grupos_productos(nombre)').order('fecha_fin', { ascending: true });
            if (pData) setPromos(pData);
        }
    };

    useEffect(() => { fetchDatos(); }, [branch, subVista]);

    // ==========================================
    // LÓGICA DE INVENTARIO Y CATÁLOGO AUDITADA
    // ==========================================
    const guardarCambiosFila = async (producto_id, currentStock, isLocal, oldPrices) => {
        const valGen = document.getElementById(`precio-${producto_id}`).value;
        const valMay = document.getElementById(`mayoreo-${producto_id}`).value;
        const valDist = document.getElementById(`distribuidor-${producto_id}`).value;
        const valMed = document.getElementById(`medico-${producto_id}`).value;
        const ajusteInput = document.getElementById(`ajuste-${producto_id}`);
        const ajusteVal = ajusteInput ? parseInt(ajusteInput.value) : 0;

        if (!valGen || !valMay || !valDist || !valMed) return alert(t('preciosInvalidos'));

        // 🚀 COMPROBACIÓN PRECISA DE QUÉ PRECIO CAMBIÓ
        let cambiosPrecio = [];
        if (oldPrices.pGen !== parseFloat(valGen)) cambiosPrecio.push(`Gral: $${oldPrices.pGen} -> $${valGen}`);
        if (oldPrices.pMay !== parseFloat(valMay)) cambiosPrecio.push(`May: $${oldPrices.pMay} -> $${valMay}`);
        if (oldPrices.pDis !== parseFloat(valDist)) cambiosPrecio.push(`Dist: $${oldPrices.pDis} -> $${valDist}`);
        if (oldPrices.pMed !== parseFloat(valMed)) cambiosPrecio.push(`Méd: $${oldPrices.pMed} -> $${valMed}`);

        if (isLocal) {
            const { error } = await supabase.from('inventario').update({ precio: parseFloat(valGen), precio_mayoreo: parseFloat(valMay), precio_distribuidor: parseFloat(valDist), precio_medico: parseFloat(valMed) }).match({ producto_id: producto_id, sucursal_id: sucursalId });
            if (error) return alert(`Error: ${error.message}`);
        } else {
            const { error } = await supabase.from('productos').update({ precio: parseFloat(valGen), precio_mayoreo: parseFloat(valMay), precio_distribuidor: parseFloat(valDist), precio_medico: parseFloat(valMed) }).eq('id', producto_id);
            if (error) return alert(`Error: ${error.message}`);
        }

        if (cambiosPrecio.length > 0) {
            const alcance = isLocal ? 'Local (Solo esta sucursal)' : 'Global (Todas las sucursales)';
            await logAuditoria(`Actualizó precios ${alcance}: ${cambiosPrecio.join(' | ')}`, producto_id, 0, 'sistema');
        }

        if (ajusteVal && !isNaN(ajusteVal) && ajusteVal !== 0) {
            const nuevoStock = currentStock + ajusteVal;
            if (nuevoStock < 0) return alert(t('errorStockNegativo'));
            const { error } = await supabase.from('inventario').update({ stock: nuevoStock }).match({ producto_id: producto_id, sucursal_id: sucursalId });
            if (!error) {
                await logAuditoria(`Ajuste de inventario manual desde panel`, producto_id, ajusteVal, ajusteVal > 0 ? 'entrada' : 'salida');
                if(ajusteInput) ajusteInput.value = ''; 
            } else { return alert(`Error: ${error.message}`); }
        }
        
        alert(t('cambiosGuardados')); fetchDatos();
    };

    const actualizarPrecioGrupo = async (grupo_id, nombreGrupo) => {
        const nuevoPrecio = prompt(`${t('promptPrecioMasivo1')} "${nombreGrupo}".\n${t('promptPrecioMasivo2')} ${t('aplicaGlobal')}`);
        if (!nuevoPrecio || isNaN(nuevoPrecio)) return;
        const { error } = await supabase.from('productos').update({ precio: parseFloat(nuevoPrecio), precio_mayoreo: parseFloat(nuevoPrecio), precio_distribuidor: parseFloat(nuevoPrecio), precio_medico: parseFloat(nuevoPrecio) }).eq('grupo_id', grupo_id);
        if (error) return alert(`Error: ${error.message}`);
        
        await logAuditoria(`Fijó precio masivo ($${parseFloat(nuevoPrecio).toFixed(2)}) a la familia: ${nombreGrupo} (Aplica Global)`, null, 0, 'sistema');
        
        alert(t('preciosMasivosAplicados')); fetchDatos();
    };

    const openNewArticleModal = () => {
        setEditingProductId(null); setNewTipo('producto'); setNewCode(''); setNewName(''); setNewPrice(''); setNewPriceMayoreo(''); setNewPriceDistribuidor(''); setNewPriceMedico(''); setSelectedGroup(''); setUsaPrecioSucursal(false); setEsConsulta(false); setShowModal(true);
    };

    const openEditArticleModal = (inv) => {
        const p = inv.productos;
        const isLocal = p.usa_precio_sucursal;
        setEditingProductId(p.id); setNewTipo(p.tipo || 'producto'); setNewCode(p.codigo_barras || ''); setNewName(p.nombre);
        setNewPrice(isLocal ? (inv.precio ?? p.precio) : p.precio);
        setNewPriceMayoreo(isLocal ? (inv.precio_mayoreo ?? p.precio_mayoreo) : p.precio_mayoreo);
        setNewPriceDistribuidor(isLocal ? (inv.precio_distribuidor ?? p.precio_distribuidor) : p.precio_distribuidor);
        setNewPriceMedico(isLocal ? (inv.precio_medico ?? p.precio_medico) : p.precio_medico);
        setSelectedGroup(p.grupo_id || ''); setUsaPrecioSucursal(p.usa_precio_sucursal || false); setEsConsulta(p.es_consulta || false); setShowModal(true);
    };

    const eliminarArticulo = async (producto_id, nombre_prod) => {
        if (!window.confirm(t('confirmarEliminarProducto'))) return;
        const codigoLiberado = `ELIMINADO-${Date.now()}`;
        const { error } = await supabase.from('productos').update({ activo: false, codigo_barras: codigoLiberado }).eq('id', producto_id);
        if (error) {
            alert(`Error: ${error.message}`); 
        } else { 
            await logAuditoria(`Eliminó del catálogo el artículo: "${nombre_prod}" (Soft Delete)`, producto_id, 0, 'sistema');
            alert(t('productoEliminadoExito')); 
            fetchDatos(); 
        }
    };

    const guardarProductoIndividual = async () => {
        if (!newName || !newPrice) return alert(t('faltanCampos'));
        const pGeneral = parseFloat(newPrice);
        const pMayoreo = newPriceMayoreo ? parseFloat(newPriceMayoreo) : pGeneral;
        const pDist = newPriceDistribuidor ? parseFloat(newPriceDistribuidor) : pGeneral;
        const pMed = newPriceMedico ? parseFloat(newPriceMedico) : pGeneral;

        const payload = {
            codigo_barras: newCode.trim() || `GEN-${Date.now()}`, 
            nombre: newName.trim(), tipo: newTipo, precio: pGeneral, precio_mayoreo: pMayoreo, precio_distribuidor: pDist, precio_medico: pMed,
            grupo_id: selectedGroup ? parseInt(selectedGroup) : null, activo: true, usa_precio_sucursal: usaPrecioSucursal,
            es_consulta: newTipo === 'servicio' ? esConsulta : false 
        };

        if (editingProductId) {
            const { error } = await supabase.from('productos').update(payload).eq('id', editingProductId);
            if (error) return alert(`Error: ${error.message}`);
            if (usaPrecioSucursal) await supabase.from('inventario').update({ precio: pGeneral, precio_mayoreo: pMayoreo, precio_distribuidor: pDist, precio_medico: pMed }).match({ producto_id: editingProductId, sucursal_id: sucursalId });
            
            await logAuditoria(`Editó configuración/nombre del artículo: "${payload.nombre}" (Código: ${payload.codigo_barras})`, editingProductId, 0, 'sistema');
            alert(t('productoActualizadoExito') || 'Artículo actualizado exitosamente.');
        } else {
            const { data: prodData, error: prodError } = await supabase.from('productos').insert([payload]).select();
            if (prodError) return alert(`Error: ${prodError.message}`);
            const newProdId = prodData[0].id;
            await supabase.from('inventario').insert([
                { producto_id: newProdId, sucursal_id: 1, stock: 0, precio: pGeneral, precio_mayoreo: pMayoreo, precio_distribuidor: pDist, precio_medico: pMed },
                { producto_id: newProdId, sucursal_id: 2, stock: 0, precio: pGeneral, precio_mayoreo: pMayoreo, precio_distribuidor: pDist, precio_medico: pMed },
                { producto_id: newProdId, sucursal_id: 3, stock: 0, precio: pGeneral, precio_mayoreo: pMayoreo, precio_distribuidor: pDist, precio_medico: pMed }
            ]);
            
            await logAuditoria(`Dio de alta un nuevo artículo: "${payload.nombre}" (Código: ${payload.codigo_barras}, Precio Base: $${payload.precio})`, newProdId, 0, 'entrada');
        }
        setShowModal(false); fetchDatos();
    };

    const toggleAccesoRapido = async (prod) => {
        const newState = !prod.acceso_rapido;
        const { error } = await supabase.from('productos').update({ acceso_rapido: newState }).eq('id', prod.id);
        if (!error) { 
            await logAuditoria(`${newState ? 'Ancló' : 'Desancló'} el artículo "${prod.nombre}" de Accesos Rápidos`, prod.id, 0, 'sistema');
            fetchDatos(); 
        }
    };

    // ==========================================
    // LÓGICA DE GRUPOS (FAMILIAS) AUDITADA
    // ==========================================
    const openNewGroupModal = () => { setEditingGroupId(null); setGroupName(''); setSelectedProductsForGroup([]); setSearchFamiliaProd(''); setShowGroupModal(true); };
    const openEditGroupModal = (grupo) => {
        setEditingGroupId(grupo.id); setGroupName(grupo.nombre);
        const prodsEnGrupo = inventario.filter(inv => inv.productos && inv.productos.grupo_id === grupo.id).map(inv => inv.productos.id);
        setSelectedProductsForGroup(prodsEnGrupo); setSearchFamiliaProd(''); setShowGroupModal(true);
    };
    const toggleProductSelection = (prodId) => {
        if (selectedProductsForGroup.includes(prodId)) setSelectedProductsForGroup(selectedProductsForGroup.filter(id => id !== prodId));
        else setSelectedProductsForGroup([...selectedProductsForGroup, prodId]);
    };
    
    const guardarFamilia = async () => {
        if (!groupName.trim()) return alert(t('nombreFamiliaObligatorio'));
        let targetGroupId = editingGroupId;
        let esNueva = false;

        if (!targetGroupId) {
            const { data, error } = await supabase.from('grupos_productos').insert([{ nombre: groupName.trim() }]).select();
            if (error) return alert(`Error: ${error.message}`); 
            targetGroupId = data[0].id;
            esNueva = true;
        } else {
            const { error } = await supabase.from('grupos_productos').update({ nombre: groupName.trim() }).eq('id', targetGroupId);
            if (error) return alert(`Error: ${error.message}`);
            await supabase.from('productos').update({ grupo_id: null }).eq('grupo_id', targetGroupId);
        }

        if (selectedProductsForGroup.length > 0) {
            const { error: assignError } = await supabase.from('productos').update({ grupo_id: targetGroupId }).in('id', selectedProductsForGroup);
            if (assignError) alert(`Error: ${assignError.message}`);
        }

        await logAuditoria(esNueva ? `Creó familia "${groupName.trim()}" y le asignó ${selectedProductsForGroup.length} artículos` : `Editó familia "${groupName.trim()}" (Integrantes finales: ${selectedProductsForGroup.length} artículos)`, null, 0, 'sistema');

        setShowGroupModal(false); alert(`"${groupName}" ${t('familiaGuardadaExito')}`); fetchDatos();
    };

    // ==========================================
    // LÓGICA DE TRANSFERENCIAS AUDITADA
    // ==========================================
    const openTransferModal = (inv) => { setTransferData({ id: inv.productos.id, nombre: inv.productos.nombre, maxStock: inv.stock }); setTransferDestino(''); setTransferQty(''); setTransferMotivo(''); setShowTransferModal(true); };
    
    const ejecutarTransferencia = async () => {
        if (!transferDestino) return alert(t('seleccionaDestino'));
        const qty = parseInt(transferQty);
        if (!qty || qty <= 0 || qty > transferData.maxStock) return alert(t('cantidadInvalida'));

        const motivoAuditado = `${transferMotivo.trim()} | Autoriza: ${perfilActual?.nombre || 'Admin'}`;

        const { error } = await supabase.rpc('transferir_inventario', { p_producto_id: transferData.id, p_origen_id: sucursalId, p_destino_id: parseInt(transferDestino), p_cantidad: qty, p_motivo_base: motivoAuditado });
        if (error) alert(`${t('errorTransferencia')}${error.message}`); else { alert(t('transferenciaExitosa')); setShowTransferModal(false); fetchDatos(); }
    };

    const exportKardexToCSV = () => {
        if (logs.length === 0) return alert(t('noDatosExportar'));
        const headers = [t('fecha'), 'Usuario / Resp.', t('producto'), t('movimiento'), t('cantidad'), t('motivo')];
        const rows = logs.map(l => [ 
            new Date(l.fecha).toLocaleString(), 
            `"${l.usuario_nombre || 'Sistema'}"`, 
            `"${l.productos?.nombre || 'GLOBAL / SISTEMA'}"`, 
            l.tipo_movimiento.toUpperCase(), 
            l.cantidad, 
            `"${l.motivo}"` 
        ]);
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `Kardex_Auditoria_${branch}_${new Date().toLocaleDateString()}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const triggerPDFPrint = () => { window.print(); };

    // ==========================================
    // LÓGICA DE PROMOCIONES AUDITADA
    // ==========================================
    const openNewPromoModal = () => {
        setEditingPromoId(null);
        setPromoTargetType('producto'); setPromoSelectedProd(''); setPromoSelectedGrupo('');
        setPromoName(''); setPromoDiscountType('porcentaje'); setPromoValue('');
        setPromoReqQty(''); setPromoFreeQty(''); setPromoStartDate(''); setPromoEndDate('');
        setShowPromoModal(true);
    };

    const openEditPromoModal = (promo) => {
        setEditingPromoId(promo.id);
        setPromoTargetType(promo.producto_id ? 'producto' : 'grupo');
        setPromoSelectedProd(promo.producto_id || '');
        setPromoSelectedGrupo(promo.grupo_id || '');
        setPromoName(promo.nombre_promo);
        setPromoDiscountType(promo.tipo_descuento);
        setPromoValue(promo.valor || '');
        setPromoReqQty(promo.cantidad_requerida || '');
        setPromoFreeQty(promo.cantidad_regalo || '');
        setPromoStartDate(promo.fecha_inicio.split('T')[0]);
        setPromoEndDate(promo.fecha_fin.split('T')[0]);
        setShowPromoModal(true);
    };

    const savePromocion = async () => {
        if (!promoName || !promoStartDate || !promoEndDate) return alert(t('llenaCampos') || 'Llena todos los campos requeridos.');
        if (promoTargetType === 'producto' && !promoSelectedProd) return alert(t('seleccionaProductoAlert') || 'Selecciona un producto.');
        if (promoTargetType === 'grupo' && !promoSelectedGrupo) return alert(t('seleccionaFamiliaAlert') || 'Selecciona una familia.');

        const payload = {
            nombre_promo: promoName.trim(),
            producto_id: promoTargetType === 'producto' ? parseInt(promoSelectedProd) : null,
            grupo_id: promoTargetType === 'grupo' ? parseInt(promoSelectedGrupo) : null,
            tipo_descuento: promoDiscountType,
            valor: promoDiscountType === 'volumen' ? 0 : parseFloat(promoValue),
            cantidad_requerida: promoDiscountType === 'volumen' ? parseInt(promoReqQty) : 0,
            cantidad_regalo: promoDiscountType === 'volumen' ? parseInt(promoFreeQty) : 0,
            fecha_inicio: promoStartDate,
            fecha_fin: promoEndDate,
            activa: true
        };

        // Preparar detalles para auditoría
        let targetLabel = '';
        if (promoTargetType === 'producto') {
            const prodObj = inventario.find(i => i.productos?.id == promoSelectedProd);
            targetLabel = prodObj ? `Producto: ${prodObj.productos.nombre}` : `Producto ID ${promoSelectedProd}`;
        } else {
            const grpObj = grupos.find(g => g.id == promoSelectedGrupo);
            targetLabel = grpObj ? `Familia: ${grpObj.nombre}` : `Familia ID ${promoSelectedGrupo}`;
        }
        let mecanicaStr = promoDiscountType === 'volumen' ? `Lleva ${promoReqQty}, Gratis ${promoFreeQty}` : (promoDiscountType === 'porcentaje' ? `${promoValue}% OFF` : `Precio Fijo $${promoValue}`);

        if (editingPromoId) {
            const { error } = await supabase.from('promociones').update(payload).eq('id', editingPromoId);
            if (error) return alert(`${t('errorCrear') || 'Error al actualizar:'} ${error.message}`);
            await logAuditoria(`Editó campaña "${payload.nombre_promo}" | Mecánica: ${mecanicaStr} | Aplica a: ${targetLabel} | Del ${promoStartDate} al ${promoEndDate}`, null, 0, 'sistema');
            alert('Campaña actualizada exitosamente.');
        } else {
            const { error } = await supabase.from('promociones').insert([payload]);
            if (error) return alert(`${t('errorCrear') || 'Error al crear:'} ${error.message}`);
            await logAuditoria(`Lanzó campaña "${payload.nombre_promo}" | Mecánica: ${mecanicaStr} | Aplica a: ${targetLabel} | Del ${promoStartDate} al ${promoEndDate}`, null, 0, 'sistema');
            alert(t('campanaLanzada') || 'Campaña lanzada exitosamente.');
        }

        setShowPromoModal(false); fetchDatos();
    };

    const togglePromoStatus = async (id, currentStatus, promoNameStr) => {
        const { error } = await supabase.from('promociones').update({ activa: !currentStatus }).eq('id', id);
        if (error) { alert(`Error: ${error.message}`); } 
        else {
            await logAuditoria(`Cambió estatus de campaña "${promoNameStr}" a ${!currentStatus ? 'ACTIVA' : 'PAUSADA'}`, null, 0, 'sistema');
            fetchDatos();
        }
    };

    const deletePromo = async (id, promoNameStr) => {
        if (!window.confirm(t('confirmarBajaCampana') || '¿Confirmas eliminar permanentemente esta campaña?')) return;
        await supabase.from('promociones').delete().eq('id', id);
        await logAuditoria(`Eliminó definitivamente la campaña promocional: ${promoNameStr}`, null, 0, 'sistema');
        fetchDatos();
    };

    // ==========================================
    // FILTROS VISUALES
    // ==========================================
    const inventarioFiltrado = inventario.filter(inv => {
        if (!inv.productos) return false;
        const term = (searchTermLocal || '').toLowerCase();
        return (inv.productos.nombre || '').toLowerCase().includes(term) || 
               (inv.productos.codigo_barras || '').toLowerCase().includes(term) ||
               (inv.productos.grupos_productos?.nombre || '').toLowerCase().includes(term);
    });

    const globalFiltrado = inventarioGlobal.filter(inv => {
        const term = (searchTermGlobal || '').toLowerCase();
        return (inv.name || '').toLowerCase().includes(term) || 
               (inv.code || '').toLowerCase().includes(term) ||
               (inv.familia || '').toLowerCase().includes(term);
    });

    const productosFamiliaFiltrados = inventario.filter(inv => {
        if (!inv.productos) return false;
        const term = (searchFamiliaProd || '').toLowerCase();
        return (inv.productos.nombre || '').toLowerCase().includes(term) || 
               (inv.productos.codigo_barras || '').toLowerCase().includes(term);
    });

    return (
        <div className="view-section active" style={{flexDirection: 'column', gap: '20px', paddingRight: '5px'}}>
            
            {/* BARRA SUPERIOR DE NAVEGACIÓN */}
            <div style={{display: 'flex', gap: '15px', background: 'var(--bg-panel)', padding: '15px 25px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'}}>
                <button className={`btn-action ${subVista === 'catalogo' ? 'btn-primary' : ''}`} onClick={() => setSubVista('catalogo')} style={{padding: '12px 20px', borderRadius: '30px', fontWeight: 'bold'}}><i className="fa-solid fa-boxes-stacked"></i> {t('catalogo')}</button>
                <button className={`btn-action ${subVista === 'global' ? 'btn-primary' : ''}`} onClick={() => setSubVista('global')} style={{padding: '12px 20px', borderRadius: '30px', fontWeight: 'bold'}}><i className="fa-solid fa-earth-americas"></i> {t('inventarioGlobal')}</button>
                <button className={`btn-action ${subVista === 'grupos' ? 'btn-primary' : ''}`} onClick={() => setSubVista('grupos')} style={{padding: '12px 20px', borderRadius: '30px', fontWeight: 'bold'}}><i className="fa-solid fa-layer-group"></i> {t('familiasGrupos')}</button>
                <button className={`btn-action ${subVista === 'promociones' ? 'btn-primary' : ''}`} onClick={() => setSubVista('promociones')} style={{padding: '12px 20px', borderRadius: '30px', fontWeight: 'bold'}}><i className="fa-solid fa-tags"></i> Promociones</button>
                <button className={`btn-action ${subVista === 'historial' ? 'btn-primary' : ''}`} onClick={() => setSubVista('historial')} style={{padding: '12px 20px', borderRadius: '30px', fontWeight: 'bold', marginLeft: 'auto'}}><i className="fa-solid fa-shield-halved"></i> Bitácora Audit.</button>
            </div>

            {/* VISTA 1: CATÁLOGO LOCAL */}
            {subVista === 'catalogo' && (
                <div className="panel" style={{ overflowX: 'auto', padding: '0', borderRadius: '12px' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 25px', borderBottom: '1px solid var(--border-color)'}}>
                        <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem', whiteSpace: 'nowrap'}}><i className="fa-solid fa-store" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('inventario')} - {branch.toUpperCase()}</h2>
                        
                        <div style={{position: 'relative', flex: 1, maxWidth: '400px', margin: '0 20px'}}>
                            <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}}></i>
                            <input 
                                type="text" 
                                placeholder={t('buscarArticulo') || 'Buscar por nombre, código o familia...'} 
                                value={searchTermLocal} 
                                onChange={(e) => setSearchTermLocal(e.target.value)} 
                                style={{width: '100%', padding: '10px 10px 10px 35px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.9rem'}}
                            />
                        </div>

                        <button className="btn-action btn-primary" onClick={openNewArticleModal} style={{borderRadius: '8px', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.2)', flexShrink: 0}}><i className="fa-solid fa-plus"></i> {t('nuevoProducto')}</button>
                    </div>
                    <table className="data-table" style={{ minWidth: '1200px' }}>
                        <thead style={{background: 'var(--bg-main)'}}>
                            <tr>
                                <th>{t('codigo')}</th>
                                <th>{t('familia')}</th>
                                <th>{t('producto')}</th>
                                <th>{t('general')}</th>
                                <th>{t('mayoreo')}</th>
                                <th>{t('distribuidor')}</th>
                                <th>{t('precioMedico')}</th>
                                <th style={{textAlign: 'center'}}>{t('stock')}</th>
                                <th style={{textAlign: 'center'}}>{t('ajusteStock')}</th>
                                <th style={{textAlign: 'center'}}><i className="fa-solid fa-floppy-disk"></i></th>
                                <th style={{textAlign: 'center'}}><i className="fa-solid fa-gear"></i></th>
                            </tr>
                        </thead>
                        <tbody>
                            {inventarioFiltrado.map(inv => {
                                if (!inv.productos) return null;
                                const p = inv.productos;
                                const isLocal = p.usa_precio_sucursal;
                                
                                const pGen = isLocal ? (inv.precio ?? p.precio) : p.precio;
                                const pMay = isLocal ? (inv.precio_mayoreo ?? p.precio_mayoreo) : p.precio_mayoreo;
                                const pDis = isLocal ? (inv.precio_distribuidor ?? p.precio_distribuidor) : p.precio_distribuidor;
                                const pMed = isLocal ? (inv.precio_medico ?? p.precio_medico) : p.precio_medico;

                                return (
                                <tr key={`${p.id}-${branch}`}>
                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.codigo_barras || 'N/A'}</td>
                                    <td><span style={{fontSize:'0.75rem', background:'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding:'4px 8px', borderRadius:'12px', fontWeight: 'bold'}}>{p.grupos_productos?.nombre || t('suelto') || 'Suelto'}</span></td>
                                    <td>
                                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: isLocal ? '#ffb300' : '#00b0ff'}}>
                                            <i className={isLocal ? "fa-solid fa-store" : "fa-solid fa-globe"} title={isLocal ? t('tooltipPrecioSucursal') : t('tooltipPrecioGlobal')}></i>
                                            <strong style={{color: 'var(--text-main)', fontSize: '0.95rem'}}>{p.nombre}</strong>
                                        </div>
                                        <div style={{display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap'}}>
                                            {p.tipo === 'servicio' && <span style={{display: 'inline-block', fontSize: '0.7rem', color: '#00b0ff', background: 'rgba(0, 176, 255, 0.1)', padding: '2px 8px', borderRadius: '4px'}}><i className="fa-solid fa-hand-sparkles"></i> {t('servicioInfinito')}</span>}
                                            {p.es_consulta && <span style={{display: 'inline-block', fontSize: '0.7rem', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid rgba(59, 130, 246, 0.3)'}}><i className="fa-solid fa-user-doctor"></i> {t('consultaMedicaBadge') || 'Consulta Médica'}</span>}
                                        </div>
                                    </td>
                                    <td><input id={`precio-${p.id}`} type="number" defaultValue={pGen} style={{width:'70px', background:'var(--bg-main)', color:'var(--text-main)', border: isLocal ? '1px solid #ffb300' : '1px solid var(--border-color)', padding:'6px', borderRadius: '6px'}} /></td>
                                    <td><input id={`mayoreo-${p.id}`} type="number" defaultValue={pMay} style={{width:'70px', background:'var(--bg-main)', color:'var(--text-main)', border: isLocal ? '1px solid #ffb300' : '1px solid var(--border-color)', padding:'6px', borderRadius: '6px'}} /></td>
                                    <td><input id={`distribuidor-${p.id}`} type="number" defaultValue={pDis} style={{width:'70px', background:'var(--bg-main)', color:'var(--text-main)', border: isLocal ? '1px solid #ffb300' : '1px solid var(--border-color)', padding:'6px', borderRadius: '6px'}} /></td>
                                    <td><input id={`medico-${p.id}`} type="number" defaultValue={pMed} style={{width:'70px', background:'var(--bg-main)', color:'var(--text-main)', border: isLocal ? '1px solid #ffb300' : '1px solid var(--border-color)', padding:'6px', borderRadius: '6px', borderLeft:'3px solid var(--accent)'}} /></td>
                                    
                                    <td style={{textAlign: 'center'}}>
                                        {p.tipo === 'servicio' ? (
                                            <i className="fa-solid fa-infinity" style={{fontSize: '1.2rem', color: '#00b0ff'}}></i>
                                        ) : (
                                            <span style={{fontWeight:'900', fontSize:'1.2rem', color: inv.stock < 5 ? 'var(--primary-red)' : 'var(--success)'}}>{inv.stock}</span>
                                        )}
                                    </td>
                                    
                                    <td style={{textAlign: 'center'}}>
                                        {p.tipo !== 'servicio' ? (
                                            <input id={`ajuste-${p.id}`} type="number" placeholder={t('placeholderAjuste')} style={{width:'85px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', padding:'6px', borderRadius: '6px', textAlign: 'center'}} />
                                        ) : (
                                            <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>N/A</span>
                                        )}
                                    </td>

                                    <td style={{textAlign: 'center'}}>
                                        {/* 🚀 AQUÍ MANDAMOS LOS PRECIOS VIEJOS PARA COMPARARLOS Y AUDITARLOS */}
                                        <button onClick={() => guardarCambiosFila(p.id, inv.stock, isLocal, {pGen, pMay, pDis, pMed})} className="btn-action" style={{background: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)', border: '1px solid rgba(22, 163, 74, 0.3)'}} title={t('guardarRenglon')} onMouseEnter={e => e.currentTarget.style.background = 'var(--success)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(22, 163, 74, 0.1)'}><i className="fa-solid fa-floppy-disk"></i></button>
                                    </td>

                                    <td>
                                        <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                                            {p.tipo !== 'servicio' && (
                                                <button onClick={() => openTransferModal(inv)} className="btn-action" style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '6px 10px'}} title={t('transferir')} onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(2, 132, 199, 0.1)'}><i className="fa-solid fa-truck-fast"></i></button>
                                            )}
                                            <button onClick={() => openEditArticleModal(inv)} className="btn-action" style={{background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '6px 10px'}} title={t('editar')}><i className="fa-solid fa-pen"></i></button>
                                            <button onClick={() => eliminarArticulo(p.id, p.nombre)} className="btn-action" style={{background: 'transparent', color: 'var(--primary-red)', border: '1px solid transparent', padding: '6px 10px'}} title={t('eliminar')} onMouseEnter={e => e.currentTarget.style.border = '1px solid var(--primary-red)'} onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}><i className="fa-solid fa-trash"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                            {inventarioFiltrado.length === 0 && <tr><td colSpan="11" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-box-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('sinDatos') || 'No se encontraron resultados.'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {/* VISTA 2: GLOBAL */}
            {subVista === 'global' && (
                <div className="panel" style={{ overflowX: 'auto', padding: '0', borderRadius: '12px' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 25px', borderBottom: '1px solid var(--border-color)'}}>
                        <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem', whiteSpace: 'nowrap'}}><i className="fa-solid fa-earth-americas" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('inventarioGlobal')}</h2>
                        
                        <div style={{position: 'relative', flex: 1, maxWidth: '400px', marginLeft: '20px'}}>
                            <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}}></i>
                            <input 
                                type="text" 
                                placeholder={t('buscarArticulo') || 'Buscar por nombre, código o familia...'} 
                                value={searchTermGlobal} 
                                onChange={(e) => setSearchTermGlobal(e.target.value)} 
                                style={{width: '100%', padding: '10px 10px 10px 35px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.9rem'}}
                            />
                        </div>
                    </div>
                    <table className="data-table" style={{ minWidth: '900px' }}>
                        <thead style={{background: 'var(--bg-main)'}}>
                            <tr>
                                <th>{t('codigo')}</th><th>{t('familia')}</th><th>{t('producto')}</th>
                                <th style={{textAlign:'center', background:'rgba(211, 47, 47, 0.05)', color:'var(--primary-red)', fontWeight: 'bold'}}>Nápoles</th>
                                <th style={{textAlign:'center', background:'rgba(211, 47, 47, 0.05)', color:'var(--primary-red)', fontWeight: 'bold'}}>Obrera</th>
                                <th style={{textAlign:'center', background:'rgba(211, 47, 47, 0.05)', color:'var(--primary-red)', fontWeight: 'bold'}}>Pedregal</th>
                                <th style={{textAlign:'center', background:'rgba(22, 163, 74, 0.05)', color:'var(--success)', fontWeight: 'bold'}}>{t('totalGlobal')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {globalFiltrado.map(inv => (
                                <tr key={inv.id}>
                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{inv.code || 'N/A'}</td>
                                    <td><span style={{fontSize:'0.75rem', background:'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding:'4px 8px', borderRadius:'12px', fontWeight: 'bold'}}>{inv.familia}</span></td>
                                    <td>
                                        <strong style={{color: 'var(--text-main)', fontSize: '0.95rem'}}>{inv.name}</strong>
                                        <div style={{display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap'}}>
                                            {inv.tipo === 'servicio' && <span style={{display: 'inline-block', fontSize: '0.7rem', color: '#00b0ff', background: 'rgba(0, 176, 255, 0.1)', padding: '2px 8px', borderRadius: '4px'}}><i className="fa-solid fa-hand-sparkles"></i> {t('servicioInfinito')}</span>}
                                            {inv.es_consulta && <span style={{display: 'inline-block', fontSize: '0.7rem', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid rgba(59, 130, 246, 0.3)'}}><i className="fa-solid fa-user-doctor"></i> {t('consultaMedicaBadge') || 'Consulta Médica'}</span>}
                                        </div>
                                    </td>
                                    {inv.tipo === 'servicio' ? (
                                        <><td style={{textAlign: 'center', color: '#00b0ff', fontSize: '1.2rem'}}><i className="fa-solid fa-infinity"></i></td><td style={{textAlign: 'center', color: '#00b0ff', fontSize: '1.2rem'}}><i className="fa-solid fa-infinity"></i></td><td style={{textAlign: 'center', color: '#00b0ff', fontSize: '1.2rem'}}><i className="fa-solid fa-infinity"></i></td><td style={{textAlign: 'center', color: '#00b0ff', fontSize: '1.2rem', fontWeight: 'bold'}}><i className="fa-solid fa-infinity"></i></td></>
                                    ) : (
                                        <><td style={{textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: inv.napoles === 0 ? 'var(--primary-red)' : 'var(--text-main)'}}>{inv.napoles}</td><td style={{textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: inv.obrera === 0 ? 'var(--primary-red)' : 'var(--text-main)'}}>{inv.obrera}</td><td style={{textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: inv.pedregal === 0 ? 'var(--primary-red)' : 'var(--text-main)'}}>{inv.pedregal}</td><td style={{textAlign: 'center', fontWeight: '900', fontSize: '1.1rem', color: 'var(--success)'}}>{inv.total}</td></>
                                    )}
                                </tr>
                            ))}
                            {globalFiltrado.length === 0 && <tr><td colSpan="7" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-earth-americas fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('sinDatos') || 'No se encontraron resultados.'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {/* VISTA 3: FAMILIAS */}
            {subVista === 'grupos' && (
                <div className="panel" style={{padding: '0', borderRadius: '12px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '20px 25px', borderBottom: '1px solid var(--border-color)'}}>
                        <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-layer-group" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('familiasAgrupaciones')}</h2>
                        <button className="btn-action btn-primary" onClick={openNewGroupModal} style={{borderRadius: '8px', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.2)'}}><i className="fa-solid fa-plus"></i> {t('crearFamilia')}</button>
                    </div>
                    <table className="data-table">
                        <thead style={{background: 'var(--bg-main)'}}><tr><th>{t('id')}</th><th>{t('nombreFamilia')}</th><th>{t('accionesFamilia')}</th></tr></thead>
                        <tbody>
                            {grupos.map(g => (
                                <tr key={g.id}>
                                    <td style={{color: 'var(--text-muted)', fontFamily: 'monospace'}}>{g.id}</td>
                                    <td><strong style={{color: 'var(--text-main)', fontSize: '1.05rem'}}>{g.nombre}</strong></td>
                                    <td>
                                        <div style={{display: 'flex', gap: '10px'}}>
                                            <button className="btn-action" onClick={() => openEditGroupModal(g)} style={{background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)'}}><i className="fa-solid fa-pen" style={{marginRight:'5px'}}></i> {t('editarIntegrantes')}</button>
                                            <button className="btn-action" onClick={() => actualizarPrecioGrupo(g.id, g.nombre)} style={{background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.3)', fontWeight: 'bold'}} onMouseEnter={e => {e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = 'white';}} onMouseLeave={e => {e.currentTarget.style.background = 'rgba(234, 88, 12, 0.1)'; e.currentTarget.style.color = '#ea580c';}}><i className="fa-solid fa-coins" style={{marginRight:'5px'}}></i>{t('fijarPrecioMasivo')}</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {grupos.length === 0 && <tr><td colSpan="3" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}><i className="fa-solid fa-folder-open fa-2x" style={{marginBottom: '10px', opacity: 0.5, display: 'block'}}></i> {t('noFamiliasCreadas')}</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {/* VISTA 4: PROMOCIONES */}
            {subVista === 'promociones' && (
                <div className="panel" style={{padding: 0, borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding: '25px 30px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)'}}>
                        <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-tags" style={{color: 'var(--accent)', marginRight: '10px'}}></i> Promociones Activas</h2>
                        <button className="btn-primary" onClick={openNewPromoModal} style={{padding: '12px 25px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'}}>
                            <i className="fa-solid fa-plus" style={{marginRight: '8px'}}></i> Lanzar Campaña
                        </button>
                    </div>

                    <div style={{overflowX: 'auto'}}>
                        <table className="data-table" style={{minWidth: '900px'}}>
                            <thead style={{background: 'var(--bg-panel)'}}>
                                <tr>
                                    <th style={{padding: '15px 30px'}}>{t('campana') || 'Campaña'}</th>
                                    <th>{t('aplicaA') || 'Aplica A'}</th>
                                    <th>{t('mecanica') || 'Mecánica'}</th>
                                    <th>{t('vigencia') || 'Vigencia'}</th>
                                    <th>{t('estado') || 'Estado'}</th>
                                    <th style={{textAlign: 'center'}}><i className="fa-solid fa-gear"></i></th>
                                </tr>
                            </thead>
                            <tbody>
                                {promos.map(promo => {
                                    const hoy = new Date();
                                    const activa = promo.activa && hoy >= new Date(promo.fecha_inicio) && hoy <= new Date(promo.fecha_fin);
                                    
                                    let mecanica = '';
                                    if (promo.tipo_descuento === 'porcentaje') mecanica = `${promo.valor}% OFF`;
                                    if (promo.tipo_descuento === 'precio_fijo') mecanica = `$${promo.valor} ${t('precioFijo') || 'Neto'}`;
                                    if (promo.tipo_descuento === 'volumen') mecanica = `${t('lleva') || 'Lleva'} ${promo.cantidad_requerida}, ${t('gratis') || 'Gratis'} ${promo.cantidad_regalo}`;
                                    
                                    const aplicaA = promo.grupo_id 
                                        ? <span style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', padding: '5px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(2, 132, 199, 0.2)'}}><i className="fa-solid fa-layer-group"></i> Familia: {promo.grupos_productos?.nombre}</span>
                                        : <span style={{background: 'rgba(255, 179, 0, 0.1)', color: '#ea580c', padding: '5px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(255, 179, 0, 0.2)'}}><i className="fa-solid fa-box"></i> Prod: {promo.productos?.nombre}</span>;

                                    return (
                                        <tr key={promo.id}>
                                            <td style={{padding: '15px 30px'}}>
                                                <strong style={{color: 'var(--text-main)', fontSize: '1.05rem'}}>{promo.nombre_promo}</strong>
                                            </td>
                                            <td>{aplicaA}</td>
                                            <td>
                                                <span style={{color: 'var(--accent)', fontWeight: 'bold', background: 'var(--bg-main)', padding: '5px 12px', borderRadius: '8px', border: '1px dashed var(--border-color)'}}>
                                                    {mecanica}
                                                </span>
                                            </td>
                                            <td style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>
                                                <i className="fa-regular fa-calendar" style={{marginRight: '5px'}}></i>
                                                {new Date(promo.fecha_inicio).toLocaleDateString()} &rarr; {new Date(promo.fecha_fin).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <button onClick={() => togglePromoStatus(promo.id, promo.activa, promo.nombre_promo)} style={{background: 'transparent', border: 'none', cursor: 'pointer', padding: 0}}>
                                                    {promo.activa 
                                                        ? <span style={{background: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(22, 163, 74, 0.3)'}}><i className="fa-solid fa-circle-check"></i> Activa (Pausar)</span>
                                                        : <span style={{background: 'rgba(211, 47, 47, 0.1)', color: 'var(--primary-red)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(211, 47, 47, 0.3)'}}><i className="fa-solid fa-circle-pause"></i> Pausada (Activar)</span>
                                                    }
                                                </button>
                                            </td>
                                            <td style={{textAlign: 'center'}}>
                                                <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                                                    <button onClick={() => openEditPromoModal(promo)} className="btn-action" style={{background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '6px 10px'}} title={t('editar')}><i className="fa-solid fa-pen"></i></button>
                                                    <button onClick={() => deletePromo(promo.id, promo.nombre_promo)} className="btn-action" style={{background: 'transparent', color: 'var(--primary-red)', border: '1px solid transparent', padding: '6px 10px'}} title={t('eliminar')} onMouseEnter={e => e.currentTarget.style.border = '1px solid var(--primary-red)'} onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}><i className="fa-solid fa-trash"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {promos.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', padding: '50px', color: 'var(--text-muted)'}}><i className="fa-solid fa-ticket fa-3x" style={{marginBottom: '15px', opacity: 0.3, display: 'block'}}></i> No hay campañas promocionales activas.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VISTA 5: HISTORIAL (KARDEX) - AHORA TOTALMENTE AUDITADO Y ESPECÍFICO */}
            {subVista === 'historial' && (
                <div className="panel" style={{padding: '0', borderRadius: '12px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '20px 25px', borderBottom: '1px solid var(--border-color)'}}>
                        <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-shield-halved" style={{color: 'var(--accent)', marginRight: '10px'}}></i> Bitácora de Auditoría ({branch.toUpperCase()})</h2>
                        <div style={{display: 'flex', gap: '10px'}}>
                            <button className="btn-action" onClick={exportKardexToCSV} style={{background: 'rgba(46, 125, 50, 0.1)', color: 'var(--success)', border: '1px solid var(--success)', fontWeight: 'bold'}}><i className="fa-solid fa-file-excel" style={{marginRight: '8px'}}></i> Exportar Bitácora</button>
                            <button className="btn-action" onClick={triggerPDFPrint} style={{background: 'rgba(211, 47, 47, 0.1)', color: 'var(--primary-red)', border: '1px solid var(--primary-red)', fontWeight: 'bold'}}><i className="fa-solid fa-file-pdf" style={{marginRight: '8px'}}></i> {t('imprimirPdf')}</button>
                        </div>
                    </div>
                    <table className="data-table">
                        <thead style={{background: 'var(--bg-main)'}}>
                            <tr>
                                <th>{t('fecha')}</th>
                                <th>Usuario / Resp.</th>
                                <th>Articulo / Afectación</th>
                                <th>{t('movimiento')}</th>
                                <th style={{textAlign: 'center'}}>{t('cantidad')}</th>
                                <th>Motivo / Descripción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, idx) => (
                                <tr key={idx}>
                                    <td style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>{new Date(log.fecha).toLocaleString()}</td>
                                    <td>
                                        <span style={{background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)'}}>
                                            <i className="fa-solid fa-user" style={{color: 'var(--text-muted)', marginRight: '5px'}}></i>
                                            {log.usuario_nombre || 'Sistema'}
                                        </span>
                                    </td>
                                    <td>
                                        {log.productos?.nombre ? (
                                            <strong style={{color: 'var(--text-main)'}}>{log.productos.nombre}</strong>
                                        ) : (
                                            <span style={{color: '#9333ea', fontWeight: 'bold', fontSize: '0.85rem'}}><i className="fa-solid fa-globe"></i> GLOBAL / SISTEMA</span>
                                        )}
                                    </td>
                                    <td><span style={{padding:'4px 10px', borderRadius:'12px', fontSize:'0.75rem', fontWeight: 'bold', background: log.tipo_movimiento === 'sistema' ? 'rgba(147, 51, 234, 0.1)' : (log.tipo_movimiento === 'salida' ? 'rgba(211, 47, 47, 0.1)' : 'rgba(22, 163, 74, 0.1)'), color: log.tipo_movimiento === 'sistema' ? '#9333ea' : (log.tipo_movimiento === 'salida' ? 'var(--primary-red)' : 'var(--success)')}}>{log.tipo_movimiento.toUpperCase()}</span></td>
                                    <td style={{fontWeight: '900', fontSize: '1.1rem', color: log.cantidad === 0 ? 'var(--text-muted)' : (log.cantidad > 0 ? 'var(--success)' : 'var(--primary-red)'), textAlign: 'center'}}>
                                        {log.cantidad === 0 ? '--' : (log.cantidad > 0 ? `+${log.cantidad}` : log.cantidad)}
                                    </td>
                                    <td style={{color: 'var(--text-main)', fontSize: '0.9rem'}}>{log.motivo}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODALES FLOTANTES */}
            
            {/* MODAL CREAR / EDITAR PROMOCIÓN */}
            {showPromoModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box animate-scale-in" style={{background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', width: '500px', border: '1px solid var(--accent)', boxShadow: '0 10px 40px rgba(2, 132, 199, 0.15)', textAlign: 'left'}}>
                        <h3 style={{marginBottom: '25px', color: 'var(--text-main)', fontSize: '1.4rem', textAlign: 'center'}}>
                            <i className="fa-solid fa-wand-magic-sparkles" style={{color: 'var(--accent)', marginRight: '10px'}}></i> 
                            {editingPromoId ? 'Editar Campaña' : 'Lanzar Nueva Campaña'}
                        </h3>
                        
                        <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '25px' }}>
                            <button 
                                onClick={() => setPromoTargetType('producto')}
                                style={{flex: 1, background: promoTargetType === 'producto' ? 'var(--bg-panel)' : 'transparent', color: promoTargetType === 'producto' ? 'var(--accent)' : 'var(--text-muted)', border: 'none', boxShadow: promoTargetType === 'producto' ? 'var(--shadow-sm)' : 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold', transition: 'all 0.3s', cursor: 'pointer'}} 
                            >
                                <i className="fa-solid fa-box"></i> {t('porProducto') || 'Por Producto'}
                            </button>
                            <button 
                                onClick={() => setPromoTargetType('grupo')}
                                style={{flex: 1, background: promoTargetType === 'grupo' ? 'var(--bg-panel)' : 'transparent', color: promoTargetType === 'grupo' ? 'var(--accent)' : 'var(--text-muted)', border: 'none', boxShadow: promoTargetType === 'grupo' ? 'var(--shadow-sm)' : 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold', transition: 'all 0.3s', cursor: 'pointer'}} 
                            >
                                <i className="fa-solid fa-layer-group"></i> {t('porFamilia') || 'Por Familia'}
                            </button>
                        </div>

                        <div style={{marginBottom: '20px'}}>
                            {promoTargetType === 'producto' ? (
                                <>
                                    <label style={{display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold'}}>{t('seleccionaProducto') || 'Selecciona un Producto'} *</label>
                                    <select value={promoSelectedProd} onChange={(e) => setPromoSelectedProd(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'10px', fontSize: '1rem', outline: 'none'}}>
                                        <option value="">-- Seleccionar --</option>
                                        {inventario.map(inv => {
                                            if(!inv.productos) return null;
                                            return <option key={inv.productos.id} value={inv.productos.id}>{inv.productos.nombre}</option>
                                        })}
                                    </select>
                                </>
                            ) : (
                                <>
                                    <label style={{display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold'}}>{t('seleccionaFamilia') || 'Selecciona una Familia'} *</label>
                                    <select value={promoSelectedGrupo} onChange={(e) => setPromoSelectedGrupo(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'10px', fontSize: '1rem', outline: 'none'}}>
                                        <option value="">-- Seleccionar --</option>
                                        {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                                    </select>
                                </>
                            )}
                        </div>
                        
                        <div style={{marginBottom: '20px'}}>
                            <label style={{display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold'}}>{t('nombrePromocionEjemplo') || 'Nombre Comercial de la Promoción'} *</label>
                            <input type="text" value={promoName} onChange={(e) => setPromoName(e.target.value)} placeholder="Ej. Buen Fin, Día de las Madres..." style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'10px', fontSize: '1rem', outline: 'none'}} />
                        </div>

                        <div style={{background: 'rgba(2, 132, 199, 0.05)', padding: '20px', borderRadius: '12px', border: '1px dashed var(--accent)', marginBottom: '25px'}}>
                            <label style={{display: 'block', fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '10px', fontWeight: 'bold', textTransform: 'uppercase'}}><i className="fa-solid fa-percent"></i> {t('esquemaDescuento') || 'Esquema de Descuento'}</label>
                            <select value={promoDiscountType} onChange={(e) => setPromoDiscountType(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'8px', marginBottom: '15px', fontSize: '1rem', outline: 'none'}}>
                                <option value="porcentaje">{t('porcentaje') || 'Porcentaje de Descuento (%)'}</option>
                                <option value="precio_fijo">{t('precioFijo') || 'Precio Fijo / Neto ($)'}</option>
                                <option value="volumen">{t('porVolumen') || 'Promoción por Volumen (N x M)'}</option>
                            </select>

                            {promoDiscountType === 'volumen' ? (
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                                    <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)', display: 'block', marginBottom: '5px'}}>{t('llevaTotal') || 'Pagas (Cant.)'}</label><input type="number" value={promoReqQty} onChange={(e) => setPromoReqQty(e.target.value)} placeholder="Ej. 3" style={{width:'100%', padding:'12px', background:'var(--bg-panel)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'6px', textAlign: 'center', outline: 'none'}} /></div>
                                    <div><label style={{fontSize:'0.8rem', color:'var(--text-muted)', display: 'block', marginBottom: '5px'}}>{t('descuentaGratis') || 'Gratis (Cant.)'}</label><input type="number" value={promoFreeQty} onChange={(e) => setPromoFreeQty(e.target.value)} placeholder="Ej. 1" style={{width:'100%', padding:'12px', background:'var(--bg-panel)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'6px', textAlign: 'center', outline: 'none'}} /></div>
                                </div>
                            ) : (
                                <div>
                                    <label style={{fontSize:'0.8rem', color:'var(--text-muted)', display: 'block', marginBottom: '5px'}}>{promoDiscountType === 'porcentaje' ? 'Porcentaje a descontar' : 'Precio final al público'}</label>
                                    <input type="number" value={promoValue} onChange={(e) => setPromoValue(e.target.value)} placeholder={t('valorDescuento') || "0.00"} style={{width:'100%', padding:'12px', background:'var(--bg-panel)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'6px', fontSize: '1.1rem', fontWeight: 'bold', outline: 'none'}} />
                                </div>
                            )}
                        </div>

                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'30px'}}>
                            <div>
                                <label style={{fontSize:'0.85rem', color:'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('inicio') || 'Fecha de Inicio'} *</label>
                                <input type="date" value={promoStartDate} onChange={(e) => setPromoStartDate(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'10px', outline: 'none', cursor: 'pointer'}} />
                            </div>
                            <div>
                                <label style={{fontSize:'0.85rem', color:'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>{t('fin') || 'Fecha de Fin'} *</label>
                                <input type="date" value={promoEndDate} onChange={(e) => setPromoEndDate(e.target.value)} style={{width:'100%', padding:'14px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'10px', outline: 'none', cursor: 'pointer'}} />
                            </div>
                        </div>

                        <div style={{display:'flex', gap:'15px'}}>
                            <button className="btn-action" style={{flex:1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold'}} onClick={() => setShowPromoModal(false)}>{t('cancelar') || 'Cancelar'}</button>
                            <button className="btn-primary" style={{flex:2, padding: '16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'}} onClick={savePromocion}><i className="fa-solid fa-save"></i> {editingPromoId ? 'Guardar Cambios' : 'Lanzar Campaña'}</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal Transferencia */}
            {showTransferModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box animate-scale-in" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '16px', width: '450px', border: '1px solid var(--accent)', boxShadow: '0 10px 40px rgba(2, 132, 199, 0.15)'}}>
                        <h3 style={{marginBottom: '15px', color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-truck-fast" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {t('transferenciaInventario')}</h3>
                        <p style={{color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem', lineHeight: '1.5'}}>Enviando: <strong style={{color: 'var(--text-main)'}}>{transferData.nombre}</strong> <br/> Disponible en {branch.toUpperCase()}: <span style={{color: 'var(--success)', fontWeight: 'bold'}}>{transferData.maxStock} uds.</span></p>
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('sucursalDestino')}</label>
                        <select value={transferDestino} onChange={(e) => setTransferDestino(e.target.value)} style={{width:'100%', padding:'12px', marginBottom: '15px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'8px', outline: 'none'}}>
                            <option value="">{t('seleccionaDestino')}</option>
                            {branch !== 'napoles' && <option value="1">Nápoles</option>}
                            {branch !== 'obrera' && <option value="2">Obrera</option>}
                            {branch !== 'pedregal' && <option value="3">Pedregal</option>}
                        </select>
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('cantidadTransferir')}</label>
                        <input type="number" max={transferData.maxStock} min="1" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} placeholder="0" style={{width:'100%', padding:'12px', marginBottom: '15px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'8px', fontSize: '1.1rem', fontWeight: 'bold', outline: 'none'}} />
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('motivoOpcional')}</label>
                        <input type="text" value={transferMotivo} onChange={(e) => setTransferMotivo(e.target.value)} placeholder="Ej. Faltante para evento" style={{width:'100%', padding:'12px', marginBottom: '25px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'8px', outline: 'none'}} />
                        
                        <div style={{display:'flex', gap:'15px'}}>
                            <button className="btn-action" style={{flex:1, padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold'}} onClick={() => setShowTransferModal(false)}>{t('cancelar')}</button>
                            <button className="btn-primary" style={{flex:1, padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'}} onClick={ejecutarTransferencia}><i className="fa-solid fa-paper-plane"></i> {t('confirmarTransferencia')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL FAMILIAS */}
            {showGroupModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box animate-scale-in" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '16px', width: '500px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)'}}>
                        <h3 style={{marginBottom: '20px', color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-layer-group" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {editingGroupId ? t('editarFamilia') : t('nuevaFamilia')}</h3>
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('labelNombreFamilia')}</label>
                        <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={t('ejemploFamilia')} style={{width:'100%', padding:'12px', marginBottom: '20px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'8px', outline: 'none'}} />
                        
                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '10px', fontWeight: 'bold'}}>{t('seleccionaProductosFamilia')}</label>
                        
                        <div style={{position: 'relative', marginBottom: '10px'}}>
                            <i className="fa-solid fa-magnifying-glass" style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)'}}></i>
                            <input 
                                type="text" 
                                placeholder={t('buscarArticulo') || 'Buscar producto...'} 
                                value={searchFamiliaProd} 
                                onChange={(e) => setSearchFamiliaProd(e.target.value)} 
                                style={{width: '100%', padding: '10px 10px 10px 35px', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.9rem', outline: 'none'}} 
                            />
                        </div>

                        <div style={{ maxHeight: '250px', overflowY: 'auto', background: 'var(--bg-main)', padding: '15px', marginBottom: '25px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {productosFamiliaFiltrados.map(inv => {
                                const prod = inv.productos;
                                const isSelected = selectedProductsForGroup.includes(prod.id);
                                return (
                                    <label key={prod.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: isSelected ? 'rgba(22, 163, 74, 0.1)' : 'var(--bg-panel)', border: isSelected ? '1px solid var(--success)' : '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleProductSelection(prod.id)} style={{ width: '20px', height: '20px', accentColor: 'var(--success)' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 'bold', color: isSelected ? 'var(--success)' : 'var(--text-main)' }}>{prod.nombre}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('codigo')}: {prod.codigo_barras}</span>
                                        </div>
                                    </label>
                                )
                            })}
                            {productosFamiliaFiltrados.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '20px'}}>{t('sinDatos')}</div>}
                        </div>
                        
                        <div style={{display:'flex', gap:'15px'}}>
                            <button className="btn-action" style={{flex:1, padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold'}} onClick={() => setShowGroupModal(false)}>{t('cancelar')}</button>
                            <button className="btn-primary" style={{flex:1, padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'}} onClick={guardarFamilia}><i className="fa-solid fa-save"></i> {t('guardarFamilia')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Producto Nuevo/Editar */}
            {showModal && (
                <div className="modal-overlay" style={{display: 'flex', position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex:1000, justifyContent:'center', alignItems:'center'}}>
                    <div className="modal-box animate-scale-in" style={{background: 'var(--bg-panel)', padding: '30px', borderRadius: '16px', width: '550px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)'}}>
                        <h3 style={{marginBottom: '20px', color: 'var(--text-main)', fontSize: '1.4rem'}}><i className="fa-solid fa-box-open" style={{color: 'var(--accent)', marginRight: '10px'}}></i> {editingProductId ? t('editarArticulo') : t('nuevoArticulo')}</h3>
                        
                        <div style={{display: 'flex', gap: '15px', marginBottom: '15px'}}>
                            <div style={{flex: 1}}>
                                <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('tipoArticulo')}</label>
                                <select value={newTipo} onChange={(e) => setNewTipo(e.target.value)} style={{width:'100%', padding:'12px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--accent)', borderRadius:'8px', outline: 'none'}}>
                                    <option value="producto">{t('productoFisico')}</option>
                                    <option value="servicio">{t('servicioInfinito')}</option>
                                </select>
                            </div>
                            <div style={{flex: 1}}>
                                <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('familiaOpcional')}</label>
                                <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{width:'100%', padding:'12px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'8px'}}>
                                    <option value="">{t('sinGrupo')}</option>
                                    {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                                </select>
                            </div>
                        </div>

                        {newTipo === 'servicio' && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', cursor: 'pointer', background: esConsulta ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-main)', padding: '12px 15px', borderRadius: '8px', border: esConsulta ? '1px solid #3b82f6' : '1px solid var(--border-color)', transition: 'all 0.3s ease' }}>
                                <input type="checkbox" checked={esConsulta} onChange={e => setEsConsulta(e.target.checked)} style={{width: '20px', height: '20px', accentColor: '#3b82f6'}} />
                                <span style={{color: esConsulta ? '#3b82f6' : 'var(--text-main)', fontSize: '0.9rem', fontWeight: 'bold'}}><i className="fa-solid fa-user-doctor"></i> {t('esConsultaMedica') || 'Contabilizar como "Consulta Médica"'}</span>
                            </label>
                        )}

                        <div style={{marginBottom: '15px'}}>
                            <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('codigoBarras')}</label>
                            <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Opcional. Ej. 750123456" style={{width:'100%', padding:'12px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'8px'}} />
                        </div>
                        
                        <div style={{marginBottom: '20px'}}>
                            <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('nombreArticulo')} *</label>
                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Agujas de Cobre 0.25x40" style={{width:'100%', padding:'12px', background:'var(--bg-main)', color:'var(--text-main)', border:'1px solid var(--border-color)', borderRadius:'8px'}} />
                        </div>
                        
                        {/* SWITCH ESTÉTICO: GLOBAL VS SUCURSAL */}
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '15px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '25px'}}>
                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                <strong style={{color: 'var(--text-main)', marginBottom: '4px', fontSize: '0.95rem'}}>
                                    <i className="fa-solid fa-tags" style={{fontSize: '1rem', marginRight: '8px', color: 'var(--accent)'}}></i> 
                                    {t('estrategiaPrecio')}
                                </strong>
                                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>
                                    {usaPrecioSucursal ? t('descPrecioSucursal') : t('descPrecioGlobal')}
                                </span>
                            </div>
                            <label className="switch-premium" style={{flexShrink: 0, marginLeft: '15px'}}>
                                <input type="checkbox" checked={usaPrecioSucursal} onChange={e => setUsaPrecioSucursal(e.target.checked)} />
                                <span className="slider-premium"></span>
                            </label>
                        </div>

                        <label style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '10px', fontWeight: 'bold', textTransform: 'uppercase'}}>{t('preciosInstruccion')}</label>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '30px'}}>
                            <div>
                                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px'}}>{t('generalReq')}</span>
                                <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="$0.00" style={{width:'100%', padding:'10px', background:'var(--bg-main)', color:'var(--text-main)', borderRadius:'6px', border: usaPrecioSucursal ? '1px solid #ffb300' : '1px solid var(--border-color)'}} />
                            </div>
                            <div>
                                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px'}}>{t('mayoreo')}</span>
                                <input type="number" value={newPriceMayoreo} onChange={(e) => setNewPriceMayoreo(e.target.value)} placeholder="$0.00" style={{width:'100%', padding:'10px', background:'var(--bg-main)', color:'var(--text-main)', borderRadius:'6px', border: usaPrecioSucursal ? '1px solid #ffb300' : '1px solid var(--border-color)'}} />
                            </div>
                            <div>
                                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px'}}>{t('distribuidor')}</span>
                                <input type="number" value={newPriceDistribuidor} onChange={(e) => setNewPriceDistribuidor(e.target.value)} placeholder="$0.00" style={{width:'100%', padding:'10px', background:'var(--bg-main)', color:'var(--text-main)', borderRadius:'6px', border: usaPrecioSucursal ? '1px solid #ffb300' : '1px solid var(--border-color)'}} />
                            </div>
                            <div>
                                <span style={{fontSize: '0.75rem', color:'var(--accent)', display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('precioMedico')}</span>
                                <input type="number" value={newPriceMedico} onChange={(e) => setNewPriceMedico(e.target.value)} placeholder="$0.00" style={{width:'100%', padding:'10px', background:'rgba(2, 132, 199, 0.05)', color:'var(--text-main)', borderRadius:'6px', border: usaPrecioSucursal ? '1px solid #ffb300' : '1px solid var(--accent)'}} />
                            </div>
                        </div>
                        
                        <div style={{display:'flex', gap:'15px'}}>
                            <button className="btn-action" style={{flex:1, padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold'}} onClick={() => setShowModal(false)}>{t('cancelar')}</button>
                            <button className="btn-primary" style={{flex:1, padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'}} onClick={guardarProductoIndividual}><i className="fa-solid fa-save"></i> {t('guardarArticulo')}</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .switch-premium { position: relative; display: inline-block; width: 50px; height: 26px; margin: 0; }
                .switch-premium input { opacity: 0; width: 0; height: 0; }
                .slider-premium { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border-color); transition: .4s; border-radius: 26px; }
                .slider-premium:before { position: absolute; content: ""; height: 18px; width: 18px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
                input:checked + .slider-premium { background-color: #ffb300; }
                input:checked + .slider-premium:before { transform: translateX(24px); }
                .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
            `}</style>
        </div>
    );
}