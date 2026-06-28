// piano-ai.js - Gestione dei flussi asincroni con Pipedream AI

const WEBHOOK_URL = "[https://eoakctnc24hsvp9.m.pipedream.net](https://eoakctnc24hsvp9.m.pipedream.net)";

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
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                azione: "update",
                ...settings,
                settimaneRestanti: settimaneMancanti || []
            }),
        });

        if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);
        return await response.text();
    } catch (err) {
        throw err;
    }
}

export function pulisciEParseJSONAI(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error("Dati ricevuti dall'AI non validi o vuoti.");
    }

    let cleanText = rawText.trim();
    
    // 1. Estrazione se ci sono i blocchi di codice Markdown ```
    if (cleanText.includes("```")) {
        const match = cleanText.match(/
http://googleusercontent.com/immersive_entry_chip/0

### 📋 Manca un solo pezzo del puzzle
Se dopo aver aggiornato questo file e `piano-locale.js` (del passaggio precedente) noti che l'app non parte ancora, manca solo l'ispezione di **`piano-aggiornamento.js`**. Se hai quel codice a disposizione, incollalo pure qui, così chiudiamo il cerchio ed eliminiamo l'ultimo potenziale punto di fallimento nativo di Safari!
