// piano-ai.js - Gestione dei flussi asincroni con Pipedream AI

const WEBHOOK_URL = "https://eoakctnc24hsvp9.m.pipedream.net";

/**
 * Genera un nuovo piano di allenamento tramite intelligenza artificiale.
 * @param {Object} settings - Impostazioni raccolte dalla UI.
 * @returns {Promise<string>} - Risposta in formato testo dall'AI.
 */
export async function generaPianoAI(settings) {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 180000); // 3 minuti max

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                azione: "generate",
                ...settings
            })
        });

        clearTimeout(timeout);
        
        if (!response || !response.ok) {
            const statusErr = response ? response.status : "Sconosciuto";
            throw new Error("Errore HTTP " + statusErr);
        }
        
        const testoRisposta = await response.text();
        if (!testoRisposta || testoRisposta.trim() === "") {
            throw new Error("Il server AI ha restituito una risposta vuota.");
        }

        return testoRisposta;
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            throw new Error("La richiesta all'AI è andata in timeout. Verifica la connessione a Internet.");
        }
        throw err;
    }
}

/**
 * Ricalcola le settimane future inviando lo storico e le impostazioni aggiornate.
 * @param {Object} settings - Impostazioni arricchite con lo storico reale.
 * @param {Array} settimaneMancanti - Lista delle sole settimane future rimaste.
 * @returns {Promise<string>} - Risposta in formato testo dall'AI.
 */
export async function ricalcolaSettimaneFutureAI(settings, settimaneMancanti) {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 180000); // 3 minuti max

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                azione: "update",
                ...settings,
                settimaneRestanti: settimaneMancanti || []
            }),
        });

        clearTimeout(timeout);

        if (!response || !response.ok) {
            const statusErr = response ? response.status : "Connessione fallita";
            throw new Error("Errore HTTP " + statusErr);
        }

        const testoRisposta = await response.text();
        if (!testoRisposta || testoRisposta.trim() === "") {
            throw new Error("Il server AI ha restituito dati vuoti per il ricalcolo.");
        }

        return testoRisposta;
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            throw new Error("Il ricalcolo dell'AI è andato in timeout per inattività della rete.");
        }
        throw err;
    }
}

/**
 * Pulisce la stringa ricevuta dall'AI ed esegue il parsing sicuro in JSON.
 * @param {string} rawText - Testo grezzo ritornato dal server.
 * @returns {Object} - Oggetto JSON interpretato.
 */
export function pulisciEParseJSONAI(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error("I dati inviati dall'AI non sono testuali.");
    }

    let cleanText = rawText.trim();
    const treBacktick = String.fromCharCode(96, 96, 96);
    
    // 1. Estrazione se ci sono i blocchi di codice Markdown standard
    if (cleanText.indexOf(treBacktick) !== -1) {
        const espressioneRegolare = new RegExp(treBacktick + "(?:json)?([\\s\\S]*?)" + treBacktick);
        const match = cleanText.match(espressioneRegolare);
        if (match && match[1]) {
            cleanText = match[1].trim();
        }
    }
    
    // 2. Isola l'inizio del JSON
    const primoContenitore = Math.min(
        cleanText.indexOf('{') === -1 ? Infinity : cleanText.indexOf('{'),
        cleanText.indexOf('[') === -1 ? Infinity : cleanText.indexOf('[')
    );
    
    const ultimoContenitore = Math.max(
        cleanText.lastIndexOf('}'),
        cleanText.lastIndexOf(']')
    );
    
    if (primoContenitore !== Infinity && ultimoContenitore !== -1 && ultimoContenitore > primoContenitore) {
        cleanText = cleanText.substring(primoContenitore, ultimoContenitore + 1);
    }
    
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Errore di parsing del testo pulito dell'AI:", cleanText);
        throw new Error("La risposta dell'AI non contiene un formato JSON valido: " + e.message);
    }
}
