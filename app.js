// app.js - Cabina di regia principale (Event Handlers & State Management)

import { generaPianoLogico, CORSA_TYPES, getDefaultDetails, calculatePlanDates } from './piano-locale.js';
import { generaPianoAI, ricalcolaSettimaneFutureAI, pulisciEParseJSONAI } from './piano-ai.js';
import { renderPianoLocale, renderPianoAI } from './ui.js';

const STORAGE_KEY = "trailcoach_v17_modular";
let STATE = { settings: {}, planData: null, planDataAI: null };

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    inizializzaInterfacciaDinamica();
    agganciaBottoniStatici();
    
    // Al caricamento, mostra il piano salvato (se esiste)
    if (STATE.planDataAI) {
        mostraCardPiano('ai');
        renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
    } else if (STATE.planData) {
        mostraCardPiano('local');
        renderPianoLocale(STATE.planData, STATE.settings.descrizione_generale, avviaCaricamentoGPX, apriModaleModifica);
    }
});

// --- GESTIONE DELLO STATO (LOCAL STORAGE) ---
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); }

function loadState() {
    const datiSalvati = localStorage.getItem(STORAGE_KEY);
    if (!datiSalvati) return;
    
    STATE = JSON.parse(datiSalvati);
    const s = STATE.settings;
    if (!s) return;

    // Ripristina i valori nei campi di testo delle impostazioni
    if (document.getElementById("livello")) document.getElementById("livello").value = s.livello || 'intermedio';
    if (document.getElementById("obbKm")) document.getElementById("obbKm").value = s.obbKm || 50;
    if (document.getElementById("obbAsc")) document.getElementById("obbAsc").value = s.obbAsc || 2000;
    if (document.getElementById("dataGara")) document.getElementById("dataGara").value = s.dataGara || '';
    if (document.getElementById("tempoObiettivo")) document.getElementById("tempoObiettivo").value = s.tempoObiettivo || 6;
    if (document.getElementById("settimane")) document.getElementById("settimane").value = s.settimane || 12;
    
    // Riaccende i pulsanti dei giorni (Corsa e Palestra)
    document.querySelectorAll(".chk-btn").forEach(btn => {
        const { day, type } = btn.dataset;
        if (type === 'corsa' && s.giorniCorsa?.includes(day)) btn.classList.add("active");
        if (type === 'palestra' && s.giorniPalestra?.includes(day)) btn.classList.add("active");
    });
}

function catturaImpostazioniSchermo() {
    return {
        livello: document.getElementById("livello").value,
        obbKm: parseFloat(document.getElementById("obbKm").value) || 50,
        obbAsc: parseInt(document.getElementById("obbAsc").value) || 2000,
        settimane: parseInt(document.getElementById("settimane").value) || 12,
        dataGara: document.getElementById("dataGara").value,
        tempoObiettivo: parseFloat(document.getElementById("tempoObiettivo").value) || 6,
        giorniCorsa: [...document.querySelectorAll(".chk-btn[data-type='corsa'].active")].map(b => b.dataset.day),
        giorniPalestra: [...document.querySelectorAll(".chk-btn[data-type='palestra'].active")].map(b => b.dataset.day)
    };
}

function mostraCardPiano(tipo) {
    const cardLocal = document.getElementById("PlandCard");
    const cardAI = document.getElementById("aiPlanCard");
    if (tipo === 'local') { cardLocal.style.display = 'block'; cardAI.style.display = 'none'; }
    else if (tipo === 'ai') { cardLocal.style.display = 'none'; cardAI.style.display = 'block'; }
}

// --- GESTIONE BOTTONI FISSI ---
function agganciaBottoniStatici() {
    // Toggle Pannello Impostazioni
    document.getElementById("toggleSettings").onclick = () => {
        const card = document.getElementById("settingsCard");
        card.style.display = (card.style.display === "none" || card.style.display === "") ? "block" : "none";
    };

    // Reset Applicazione Totale + Svuotamento Cache Profonda
    document.getElementById("resetData").onclick = async () => {
        if (confirm("Vuoi cancellare definitivamente i dati, svuotare la cache e forzare il riavvio dell'app?")) {
            
            // 1. Cancella i dati del piano e delle impostazioni
            localStorage.removeItem(STORAGE_KEY);
            
            // 2. Forza l'eliminazione di tutte le cache del Service Worker
            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    await Promise.all(
                        cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                    console.log("Tutte le cache del Service Worker sono state eliminate.");
                } catch (err) {
                    console.error("Errore durante lo svuotamento della cache:", err);
                }
            }

            // 3. Riavvia l'applicazione forzando il download dei file freschi dal server
            // l'argomento 'true' dice al browser di bypassare completamente la cache locale
            window.location.reload(true);
        }
    };

    // Genera Piano Locale
    document.getElementById("genLocal").onclick = () => {
        const settings = catturaImpostazioniSchermo();
        if (!settings.dataGara || settings.giorniCorsa.length === 0) { alert("Inserisci la data della gara e almeno un giorno di corsa!"); return; }
        
        const { raceDate } = calculatePlanDates(settings.dataGara, settings.settimane);
        const dataFormattata = new Date(raceDate).toLocaleDateString('it-IT');
        settings.descrizione_generale = `Piano locale per livello ${settings.livello}, termina il ${dataFormattata}. Target picco: ${settings.obbKm} km, +${settings.obbAsc}m D+.`;

        STATE.settings = settings;
        STATE.planData = generaPianoLogico(settings);
        STATE.planDataAI = null; // Sovrascrive eventuale piano AI vecchio

        saveState();
        document.getElementById("settingsCard").style.display = "none";
        mostraCardPiano('local');
        renderPianoLocale(STATE.planData, STATE.settings.descrizione_generale, avviaCaricamentoGPX, apriModaleModifica);
    };

    // Genera Piano AI
    document.getElementById("genAI").onclick = async () => {
        const settings = catturaImpostazioniSchermo();
        if (!settings.dataGara) { alert("Manca la data della gara!"); return; }

        const aiContainer = document.getElementById("piano-generato");
        document.getElementById("settingsCard").style.display = "none";
        mostraCardPiano('ai');
        aiContainer.innerHTML = "<p>⏳ L'Intelligenza Artificiale sta elaborando i dislivelli e i carichi progressivi. Attendi...</p>";

        try {
            STATE.settings = settings;
            const rispostaTesto = await generaPianoAI(settings);
            const oggettoPianoAI = pulisciEParseJSONAI(rispostaTesto);

            STATE.planDataAI = oggettoPianoAI;
            STATE.planData = null; // cancella piano locale vecchio
            saveState();

            renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
        } catch (err) {
            console.error(err);
            aiContainer.innerHTML = `<p style="color:red;">❌ Errore durante la generazione AI: ${err.message}</p>`;
        }
    };

    // Aggiorna / Rimodula settimane future
    document.getElementById("updatePlanBtn").onclick = async () => {
        if (!STATE.planData && !STATE.planDataAI) { alert("Nessun piano attivo da rimodulare."); return; }
        if (!confirm("Ricalcolare le settimane future in base alle nuove impostazioni mantenendo lo storico dei GPX?")) return;

        try {
            const oggi = new Date();
            const settimaneAttuali = STATE.planDataAI?.settimane || STATE.planData || [];
            
            // Isola le settimane future che non sono ancora iniziate
            const settimaneDaRimodulare = settimaneAttuali.filter(w => new Date(w.startDate) >= oggi);
            const settings = catturaImpostazioniSchermo();

            const rispostaRicalcolo = await ricalcolaSettimaneFutureAI(settings, settimaneDaRimodulare);
            const nuoveSettimaneAI = pulisciEParseJSONAI(rispostaRicalcolo);

            if (!STATE.planDataAI) {
                STATE.planDataAI = nuoveSettimaneAI;
            } else {
                nuoveSettimaneAI.settimane.forEach(nuovaW => {
                    const idx = STATE.planDataAI.settimane.findIndex(w => w.numero === nuovaW.numero);
                    if (idx !== -1) {
                        // Preserva i dati GPX verificati se l'utente li ha già completati
                        nuovaW.allenamenti.forEach((nuovoA, aIdx) => {
                            const vecchioA = STATE.planDataAI.settimane[idx].allenamenti[aIdx];
                            if (vecchioA?.completed && vecchioA?.gpxData) {
                                nuovoA.completed = true; nuovoA.gpxData = vecchioA.gpxData;
                            }
                        });
                        STATE.planDataAI.settimane[idx] = nuovaW;
                    }
                });
            }
            STATE.planData = null;
            saveState();
            mostraCardPiano('ai');
            renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
            alert("Piano aggiornato! Le settimane future sono state rimodulate in modo bilanciato.");
        } catch (err) {
            alert("Errore nell'aggiornamento: " + err.message);
        }
    };
}

// --- LOGICA INTERFACCIA SELEZIONE GIORNI (ANTI-CONFLITTO) ---
function inizializzaInterfacciaDinamica() {
    document.getElementById("settingsCard").addEventListener("click", (e) => {
        if (e.target.classList.contains("chk-btn")) {
            const { day, type } = e.target.dataset;
            
            // Impedisce di selezionare lo stesso giorno sia per Corsa che per Palestra
            if (type === 'corsa' && !e.target.classList.contains('active')) {
                document.querySelector(`.chk-btn[data-day="${day}"][data-type="palestra"]`)?.classList.remove('active');
            } else if (type === 'palestra' && !e.target.classList.contains('active')) {
                document.querySelector(`.chk-btn[data-day="${day}"][data-type="corsa"]`)?.classList.remove('active');
            }
            e.target.classList.toggle("active");
        }
    });
}

// --- LOGICA MODIFICA ALLENAMENTI MODALE ---
let modificaInCorso = { tipoPiano: null, wIdx: null, aIdx: null };

function apriModaleModifica(tipoPiano, wIdx, aIdx) {
    modificaInCorso = { tipoPiano, wIdx, aIdx };
    const piano = tipoPiano === 'local' ? STATE.planData : STATE.planDataAI.settimane;
    const attivita = piano[wIdx].allenamenti[aIdx];

    const cType = tipoPiano === 'local' ? attivita.type : attivita.tipo;
    const cDetails = tipoPiano === 'local' ? attivita.details.detailText : attivita.dettagli;
    const cKm = tipoPiano === 'local' ? attivita.details.distance : attivita.km;
    const cAsc = tipoPiano === 'local' ? attivita.details.ascent : attivita.asc;
    const cDur = tipoPiano === 'local' ? attivita.details.durationMin : attivita.durationMin;

    const modalForm = document.getElementById("modalForm");
    let options = CORSA_TYPES.map(t => `<option value="${t}" ${cType === t ? 'selected' : ''}>${t}</option>`).join('');
    options += `<option value="Palestra" ${cType === 'Palestra' ? 'selected' : ''}>🏋️ Palestra</option>`;
    options += `<option value="Riposo" ${cType === 'Riposo' ? 'selected' : ''}>💤 Riposo</option>`;

    modalForm.innerHTML = `
        <label>Tipo Allenamento</label><select id="editType">${options}</select>
        <label>Dettagli</label><input id="editDetails" type="text" value="${cDetails}" />
        <div id="runFields">
            <label>Chilometri (km)</label><input id="editKm" type="number" step="0.1" value="${cKm || 0}" />
            <label>Dislivello (m)</label><input id="editAsc" type="number" value="${cAsc || 0}" />
        </div>
        <label>Durata (min)</label><input id="editDuration" type="number" value="${cDur || 60}" />
    `;

    document.getElementById("editModal").style.display = 'flex';

    const editTypeSelect = document.getElementById("editType");
    const runFields = document.getElementById("runFields");
    
    editTypeSelect.onchange = () => {
        const val = editTypeSelect.value;
        runFields.style.display = (val === "Palestra" || val === "Riposo") ? "none" : "block";
        document.getElementById("editDetails").value = getDefaultDetails(val);
    };
    if (cType === "Palestra" || cType === "Riposo") runFields.style.display = "none";

    // Chiudi modali all'esterno o sul tasto annulla è gestito via inline nell'HTML originale
}

document.getElementById("saveEditBtn").onclick = () => {
    const { tipoPiano, wIdx, aIdx } = modificaInCorso;
    const piano = tipoPiano === 'local' ? STATE.planData : STATE.planDataAI.settimane;
    const attivita = piano[wIdx].allenamenti[aIdx];

    const nType = document.getElementById("editType").value;
    const nDetails = document.getElementById("editDetails").value;
    const nDuration = parseInt(document.getElementById("editDuration").value) || 0;

    if (tipoPiano === 'local') {
        attivita.type = nType;
        attivita.details.detailText = nDetails;
        attivita.details.durationMin = nDuration;
        if (nType !== "Palestra" && nType !== "Riposo") {
            attivita.details.distance = parseFloat(document.getElementById("editKm").value) || 0;
            attivita.details.ascent = parseInt(document.getElementById("editAsc").value) || 0;
            attivita.summary = `🏃 ${nType} — ${attivita.details.distance} km`;
        } else {
            attivita.details.distance = 0; attivita.details.ascent = 0;
            attivita.summary = nType === "Palestra" ? "🏋️ Palestra" : "Riposo";
        }
        attivita.details.gpxData = null; attivita.details.completed = false;
    } else {
        attivita.tipo = nType;
        attivita.dettagli = nDetails;
        attivita.durationMin = nDuration;
        if (nType !== "Palestra" && nType !== "Riposo") {
            attivita.km = parseFloat(document.getElementById("editKm").value) || 0;
            attivita.asc = parseInt(document.getElementById("editAsc").value) || 0;
        } else {
            attivita.km = 0; attivita.asc = 0;
        }
        attivita.gpxData = null; attivita.completed = false;
    }

    saveState();
    document.getElementById("editModal").style.display = 'none';
    if (tipoPiano === 'local') renderPianoLocale(STATE.planData, STATE.settings.descrizione_generale, avviaCaricamentoGPX, apriModaleModifica);
    else renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
};

// --- STRUMENTO PARSING GPX ---
function avviaCaricamentoGPX(tipoPiano, wIdx, aIdx) {
    const inputInvisibile = document.getElementById("hiddenFileInput");
    inputInvisibile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const gpxEstratto = estraiDatiDaStringaGPX(event.target.result);
            if (!gpxEstratto) { alert("Struttura GPX non valida per il calcolo dei tracciati."); return; }

            const piano = tipoPiano === 'local' ? STATE.planData : STATE.planDataAI.settimane;
            const attivita = piano[wIdx].allenamenti[aIdx];

            if (tipoPiano === 'local') {
                attivita.details.gpxData = gpxEstratto; attivita.details.completed = true;
            } else {
                attivita.gpxData = gpxEstratto; attivita.completed = true;
            }

            saveState();
            if (tipoPiano === 'local') renderPianoLocale(STATE.planData, STATE.settings.descrizione_generale, avviaCaricamentoGPX, apriModaleModifica);
            else renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
            
            alert(`✅ Tracciato caricato!\nEffettivi: ${gpxEstratto.distanceKm.toFixed(2)} km\nDislivello D+: +${gpxEstratto.ascentMeters} m`);
        };
        reader.readAsText(file);
    };
    inputInvisibile.click();
}

function estraiDatiDaStringaGPX(xmlString) {
    try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlString, "application/xml");
        const punti = xml.querySelectorAll("trkpt");
        if (punti.length < 2) return null;

        let km = 0, dPlus = 0;
        for (let i = 1; i < punti.length; i++) {
            const lat1 = parseFloat(punti[i-1].getAttribute("lat")), lon1 = parseFloat(punti[i-1].getAttribute("lon"));
            const lat2 = parseFloat(punti[i].getAttribute("lat")), lon2 = parseFloat(punti[i].getAttribute("lon"));
            
            // Formula di Haversine per distanza geodetica
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            km += R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));

            const ele1 = punti[i-1].querySelector("ele") ? parseFloat(punti[i-1].querySelector("ele").textContent) : null;
            const ele2 = punti[i].querySelector("ele") ? parseFloat(punti[i].querySelector("ele").textContent) : null;
            if (ele1 !== null && ele2 !== null && ele2 > ele1) dPlus += (ele2 - ele1);
        }
        return { distanceKm: km, ascentMeters: Math.round(dPlus) };
    } catch { return null; }
}
