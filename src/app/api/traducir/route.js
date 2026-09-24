// Ruta: app/api/traducir/route.js
import { NextResponse } from 'next/server';
import { Translate } from '@google-cloud/translate/build/src/v2';

export async function POST(request) {
    try {
        // Recibimos lo que nos manda el EscritorioMedico.js
        const { texto, idioma_destino } = await request.json();

        if (!texto) {
            return NextResponse.json({ error: 'Falta el texto a traducir' }, { status: 400 });
        }

        // ⚠️ TRUCO VITAL: Las llaves privadas en .env a veces fallan por los saltos de línea (\n). 
        // Esta línea lo soluciona garantizando que Google la lea bien.
        const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

        // Inicializamos el traductor de Google con TUS credenciales
        const translate = new Translate({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: privateKey,
            },
        });

        // Hacemos la magia de traducción (el idioma destino será 'zh' para chino)
        const [traduccion] = await translate.translate(texto, idioma_destino);

        // Devolvemos el texto traducido al frontend
        return NextResponse.json({ texto_traducido: traduccion });

    } catch (error) {
        console.error('Error en API de traducción:', error);
        return NextResponse.json({ error: 'Error al traducir el texto' }, { status: 500 });
    }
}