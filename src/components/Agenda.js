'use client';
import { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';

moment.locale('es');
const localizer = momentLocalizer(moment);

export default function Agenda({ branch = 'napoles' }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // 🚀 ESTADOS DE CONTROL ESTRICTO DEL CALENDARIO
    const [currentView, setCurrentView] = useState(Views.DAY);
    const [currentDate, setCurrentDate] = useState(new Date());

    const [formData, setFormData] = useState({
        title: '',
        patient: '',
        date: moment().format('YYYY-MM-DD'),
        startTime: '10:00',
        endTime: '11:00',
        notes: ''
    });

    const stripHTML = (html) => {
        if (!html) return '';
        return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
    };

    // 🚀 FUNCIÓN DE CARGA DINÁMICA ABSOLUTA
    const fetchEvents = async () => {
        setLoading(true);
        try {
            let start, end;
            
            // Calculamos con bisturí el rango exacto que necesitamos pedirle a Google según la vista
            if (currentView === 'day') {
                start = moment(currentDate).startOf('day').toISOString();
                end = moment(currentDate).endOf('day').toISOString();
            } else if (currentView === 'week') {
                start = moment(currentDate).startOf('week').toISOString();
                end = moment(currentDate).endOf('week').toISOString();
            } else if (currentView === 'month') {
                start = moment(currentDate).startOf('month').subtract(1, 'weeks').toISOString(); // Expandimos para cubrir esquinas
                end = moment(currentDate).endOf('month').add(1, 'weeks').toISOString();
            } else {
                start = moment(currentDate).startOf('day').toISOString();
                end = moment(currentDate).add(1, 'month').toISOString();
            }

            const res = await fetch(`/api/calendar?start=${start}&end=${end}`);
            const data = await res.json();
            
            if (data.events) {
                const formattedEvents = data.events
                    .filter(event => event.start && event.end)
                    .map(event => ({
                        id: event.id,
                        title: event.summary || 'Cita',
                        start: new Date(event.start.dateTime || event.start.date),
                        end: new Date(event.end.dateTime || event.end.date),
                        description: stripHTML(event.description),
                    }));
                
                setEvents(formattedEvents);
            }
        } catch (error) {
            console.error("Error de conexión:", error);
        }
        setLoading(false);
    };

    // 🚀 DISPARADOR AUTOMÁTICO CADA QUE CAMBIAN LA VISTA O LA FECHA
    useEffect(() => {
        fetchEvents();
    }, [currentDate, currentView]);

    const handleSelectSlot = (slotInfo) => {
        setFormData({
            ...formData,
            date: moment(slotInfo.start).format('YYYY-MM-DD'),
            startTime: moment(slotInfo.start).format('HH:mm'),
            endTime: moment(slotInfo.start).add(1, 'hour').format('HH:mm')
        });
        setShowModal(true);
    };

    const handleSaveEvent = async () => {
        if (!formData.title || !formData.patient) return alert("Título y Paciente son obligatorios");

        const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`).toISOString();
        const endDateTime = new Date(`${formData.date}T${formData.endTime}:00`).toISOString();

        const payload = {
            summary: `${formData.title} - ${formData.patient}`,
            description: formData.notes,
            start: startDateTime,
            end: endDateTime
        };

        const btn = document.getElementById('btn-agendar');
        if(btn) { btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`; btn.disabled = true; }

        const res = await fetch('/api/calendar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            setShowModal(false);
            setFormData({ title: '', patient: '', date: moment().format('YYYY-MM-DD'), startTime: '10:00', endTime: '11:00', notes: '' });
            fetchEvents(); 
        } else {
            alert("Error al agendar la cita.");
            if(btn) { btn.innerHTML = `<i class="fa-solid fa-save"></i> Agendar`; btn.disabled = false; }
        }
    };

    const handleSelectEvent = (event) => {
        alert(`CITA: ${event.title}\n\nHORARIO: ${moment(event.start).format('hh:mm A')} a ${moment(event.end).format('hh:mm A')}\n\nDETALLES:\n${event.description || 'Sin detalles'}`);
    };

    const eventStyleGetter = (event, start, end, isSelected) => {
        let bgColor = 'linear-gradient(135deg, #0288d1, #026aa7)'; 
        if (event.title.toLowerCase().includes('cancelada')) bgColor = 'linear-gradient(135deg, #ef4444, #b91c1c)';
        if (event.title.toLowerCase().includes('masaje') || event.title.toLowerCase().includes('tuina')) bgColor = 'linear-gradient(135deg, #8b5cf6, #6d28d9)';

        return {
            style: {
                background: bgColor,
                borderRadius: '8px',
                opacity: 0.95,
                color: 'white',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                fontWeight: '600',
                padding: '4px 8px',
                fontSize: '0.85rem',
                boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                zIndex: isSelected ? 10 : 1
            },
            className: 'custom-calendar-event'
        };
    };

    const minTime = new Date();
    minTime.setHours(7, 0, 0);
    const maxTime = new Date();
    maxTime.setHours(22, 0, 0);

    return (
        <div className="view-section active animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingRight: '5px' }}>
            <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '25px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', background: 'var(--bg-panel)', position: 'relative' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{background: 'rgba(2, 132, 199, 0.1)', padding: '10px', borderRadius: '12px', display: 'flex'}}>
                            <i className="fa-regular fa-calendar-check" style={{ color: 'var(--accent)' }}></i>
                        </div>
                        Control de Citas - {branch.toUpperCase()}
                    </h2>
                    
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button onClick={fetchEvents} className="btn-action" style={{ background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                            <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i> Sincronizar
                        </button>
                        <button onClick={() => setShowModal(true)} className="btn-primary" style={{ padding: '12px 24px', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 20px rgba(2, 132, 199, 0.3)', transition: 'all 0.3s', transform: 'translateY(0)' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                            <i className="fa-solid fa-plus"></i> Agendar Nueva
                        </button>
                    </div>
                </div>

                <div className="calendar-wrapper" style={{ flex: 1, background: 'var(--bg-main)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                    
                    {loading && (
                        <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 17, 26, 0.4)', backdropFilter: 'blur(3px)', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '15px', justifyContent: 'center', alignItems: 'center', borderRadius: '16px', color: 'white'}}>
                            <i className="fa-solid fa-circle-notch fa-spin fa-3x" style={{color: 'var(--accent)', filter: 'drop-shadow(0 0 10px rgba(2, 132, 199, 0.8))'}}></i>
                            <h3 style={{margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>Actualizando Radar...</h3>
                        </div>
                    )}
                    
                    <Calendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        
                        // 🚀 COMPONENTE ESTRICTAMENTE CONTROLADO
                        view={currentView}
                        onView={setCurrentView}
                        date={currentDate}
                        onNavigate={setCurrentDate}
                        
                        views={['day', 'week', 'month', 'agenda']} 
                        min={minTime} 
                        max={maxTime} 
                        step={15} 
                        timeslots={4} 
                        style={{ height: '100%', color: 'var(--text-main)' }}
                        selectable
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        eventPropGetter={eventStyleGetter}
                        showCurrentTimeIndicator={true} 
                        messages={{
                            next: "Sig. ❯",
                            previous: "❮ Ant.",
                            today: "Ir a Hoy",
                            month: "Mes",
                            week: "Semana",
                            day: "Día",
                            agenda: "Lista",
                            date: "Fecha",
                            time: "Hora",
                            event: "Cita",
                            noEventsInRange: "Agenda libre en este periodo."
                        }}
                    />
                </div>
            </div>

            {/* MODAL PARA AGENDAR */}
            {showModal && (
                <div className="modal-overlay" style={{ display: 'flex', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }}>
                    <div className="modal-box animate-scale-in" style={{ background: 'var(--bg-panel)', padding: '30px', borderRadius: '20px', width: '480px', border: '1px solid var(--accent)', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', textAlign: 'left' }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px'}}>
                            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', padding: '8px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '40px', height: '40px'}}>
                                    <i className="fa-solid fa-calendar-plus"></i>
                                </div>
                                Nueva Cita
                            </h3>
                            <button onClick={() => setShowModal(false)} style={{background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', transition: '0.2s'}} onMouseEnter={e => e.currentTarget.style.color='var(--primary-red)'} onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.80rem', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '0.5px' }}>TÍTULO O TRATAMIENTO *</label>
                        <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ej. Consulta Acupuntura..." style={{ width: '100%', padding: '14px', marginBottom: '18px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', outline: 'none', fontSize: '1rem', transition: 'border 0.3s' }} onFocus={e => e.currentTarget.style.borderColor='var(--accent)'} onBlur={e => e.currentTarget.style.borderColor='var(--border-color)'}/>

                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.80rem', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '0.5px' }}>NOMBRE DEL PACIENTE *</label>
                        <input type="text" value={formData.patient} onChange={e => setFormData({...formData, patient: e.target.value})} placeholder="Nombre completo..." style={{ width: '100%', padding: '14px', marginBottom: '18px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', outline: 'none', fontSize: '1rem', transition: 'border 0.3s' }} onFocus={e => e.currentTarget.style.borderColor='var(--accent)'} onBlur={e => e.currentTarget.style.borderColor='var(--border-color)'}/>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '15px', marginBottom: '18px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.80rem', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '0.5px' }}>FECHA</label>
                                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} style={{ width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', outline: 'none', cursor: 'pointer' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.80rem', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '0.5px' }}>INICIO</label>
                                    <input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} style={{ width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', outline: 'none', cursor: 'pointer' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.80rem', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '0.5px' }}>FIN</label>
                                    <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} style={{ width: '100%', padding: '14px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', outline: 'none', cursor: 'pointer' }} />
                                </div>
                            </div>
                        </div>

                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.80rem', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '0.5px' }}>NOTAS / DETALLES (Opcional)</label>
                        <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows="2" style={{ width: '100%', padding: '14px', marginBottom: '25px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', resize: 'none', outline: 'none' }}></textarea>

                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button onClick={() => setShowModal(false)} className="btn-action" style={{ flex: 1, padding: '16px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem', transition: 'background 0.3s' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-dark)'} onMouseLeave={e => e.currentTarget.style.background='var(--bg-main)'}>Cancelar</button>
                            <button id="btn-agendar" onClick={handleSaveEvent} className="btn-primary" style={{ flex: 2, padding: '16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 8px 20px rgba(2, 132, 199, 0.3)', transition: 'transform 0.3s' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}><i className="fa-solid fa-save" style={{marginRight: '8px'}}></i> Confirmar Cita</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
                .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

                .calendar-wrapper .rbc-calendar { font-family: inherit; }
                
                .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: none; background: var(--bg-panel); border-radius: 12px; }
                
                .rbc-header { padding: 15px 0; font-weight: 800; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid var(--border-color); border-left: 1px solid var(--border-color); background: var(--bg-dark); color: var(--text-main); }
                
                .rbc-month-row, .rbc-day-bg, .rbc-time-content, .rbc-time-header-content { border-color: var(--border-color); }
                .rbc-time-content > * + * > * { border-left: 1px dashed var(--border-color); }
                .rbc-timeslot-group { border-bottom: 1px dashed var(--border-color); }
                .rbc-time-slot { color: var(--text-muted); font-size: 0.8rem; }
                
                .rbc-off-range-bg { background: var(--bg-main); opacity: 0.4; }
                .rbc-today { background: rgba(2, 132, 199, 0.04); }
                
                .custom-calendar-event:hover { transform: scale(1.02); box-shadow: 0 8px 20px rgba(0,0,0,0.3) !important; z-index: 50 !important; }
                
                /* LA LÍNEA DEL TIEMPO ANIMADA */
                .rbc-current-time-indicator { background-color: #ef4444; height: 2px; z-index: 20; box-shadow: 0 0 8px #ef4444; opacity: 0.9; }
                .rbc-current-time-indicator::before { content: ''; position: absolute; left: -6px; top: -4px; width: 10px; height: 10px; border-radius: 50%; background-color: #ef4444; box-shadow: 0 0 10px #ef4444; animation: radar-pulse 2s infinite; }
                @keyframes radar-pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }

                /* BOTONES SUPERIORES (TOOLBAR) MODERNIZADOS */
                .rbc-toolbar { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                .rbc-toolbar .rbc-btn-group { display: flex; gap: 5px; }
                .rbc-toolbar button { color: var(--text-main); border: 1px solid var(--border-color); background: var(--bg-main); padding: 8px 16px; border-radius: 30px; font-weight: 600; font-size: 0.85rem; transition: all 0.3s ease; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
                .rbc-toolbar button:hover { background: var(--bg-dark); border-color: var(--text-muted); }
                .rbc-toolbar button:active, .rbc-toolbar button.rbc-active { background: linear-gradient(135deg, var(--accent), #026aa7); color: white; border-color: var(--accent); box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4); }
                .rbc-toolbar .rbc-toolbar-label { font-size: 1.2rem; font-weight: 900; color: var(--text-main); text-transform: capitalize; }
            `}</style>
        </div>
    );
}