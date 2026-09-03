import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const getAuthClient = async () => {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error("Faltan las credenciales de Google en el archivo .env.local");
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    return await auth.getClient();
};

// TRAER CITAS (GET DINÁMICO)
export async function GET(request) {
    try {
        const authClient = await getAuthClient();
        const calendar = google.calendar({ version: 'v3', auth: authClient });
        const calendarId = process.env.CALENDAR_ID_NAPOLES;

        if (!calendarId) throw new Error("Falta el CALENDAR_ID_NAPOLES en el .env");

        // 🚀 Recibimos las fechas exactas desde React
        const { searchParams } = new URL(request.url);
        const startParam = searchParams.get('start');
        const endParam = searchParams.get('end');

        // Si no mandan fechas, por seguridad traemos solo el mes actual
        const timeMin = startParam ? new Date(startParam).toISOString() : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const timeMax = endParam ? new Date(endParam).toISOString() : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();

        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: timeMin,
            timeMax: timeMax,
            maxResults: 2500, // Límite amplio para cubrir el mes entero sin problemas
            singleEvents: true,
            orderBy: 'startTime',
        });
        
        const eventos = response.data.items || [];
        return NextResponse.json({ events: eventos }, { status: 200 });
    } catch (error) {
        console.error('❌ Error GET calendar:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// CREAR CITA (POST) - Mantenemos esto intacto
export async function POST(request) {
    try {
        const authClient = await getAuthClient();
        const calendar = google.calendar({ version: 'v3', auth: authClient });
        const calendarId = process.env.CALENDAR_ID_NAPOLES;

        const body = await request.json();
        
        const event = {
            summary: body.summary,
            description: body.description,
            start: { dateTime: body.start, timeZone: 'America/Mexico_City' },
            end: { dateTime: body.end, timeZone: 'America/Mexico_City' },
        };

        const response = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
        });
        
        return NextResponse.json({ event: response.data }, { status: 200 });
    } catch (error) {
        console.error('❌ Error POST calendar:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}