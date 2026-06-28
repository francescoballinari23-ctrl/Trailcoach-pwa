```javascript
// piano-ai.js - Gestione dei flussi asincroni con Pipedream AI

const WEBHOOK_URL = "https://eoakctnc24hsvp9.m.pipedream.net";

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
        if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);
        
        return await response.text();
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

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
        if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);
        return await response.text();
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

export function pulisciEParseJSONAI(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error("Dati ricevuti dall'AI non validi o vuoti.");
    }

    let cleanText = rawText.trim();
    
    // 1. Estrazione se ci sono i blocchi di codice Markdown 

```
