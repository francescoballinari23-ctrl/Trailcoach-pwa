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
    const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            azione: "update",
            ...settings,
            settimaneRestanti: settimaneMancanti
        }),
    });

    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);
    return await response.text();
}

export function pulisciEParseJSONAI(rawText) {
    let cleanText = rawText;
    if (cleanText.includes("```")) {
        const match = cleanText.match(/```json([\s\S]*?)```/);
        cleanText = match ? match[1] : cleanText.substring(cleanText.indexOf('{'), cleanText.lastIndexOf('}') + 1);
    }
    return JSON.parse(cleanText.trim());
}
