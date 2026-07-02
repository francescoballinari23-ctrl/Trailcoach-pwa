// 1. GLI IMPORT DEVONO ESSERE SEMPRE IN CIMA ASSOLUTA AL FILE
import { generaPianoLogico, CORSA_TYPES, getDefaultDetails, calculatePlanDates } from './piano-locale.js';
import { generaPianoAI, ricalcolaSettimaneFutureAI, pulisciEParseJSONAI } from './piano-ai.js';
import { renderPianoLocale, renderPianoAI } from './ui.js';
import { analizzaStatoPiano } from './piano-aggiornamento.js';
import { 
    eseguiRimodulazioneMatematicaLocale, 
    esportaPianoInJSON, 
    importaPianoDaJSON 
} from './piano-aggiornamento.js';

// 2. SISTEMA DI TRACCIAMENTO ERRORI PER SAFARI IOS (SUBITO SOTTO GLI IMPORT)
window.onerror = function(message, source, lineno, colno, error) {
    alert("❌ ERRORE RISCONTRATO:\n" + message + "\n\nFile: " + source + "\nRiga: " + lineno);
    return false;
};

window.addEventListener('unhandledrejection', function (event) {
    alert("❌ PROMESSA FALLITA:\n" + event.reason);
});

// Questo alert ora apparirà correttamente sul tuo iPhone confermando il caricamento
alert("🚀 Apllicazione caricata correttamente!");

const STORAGE_KEY = "trailcoach_v17_modular";
let STATE = { settings: {}, planData: null, planDataAI: null };

// --- INIZIALIZZAZIONE SICURA ---
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
        renderPianoLocale(STATE.planData, STATE.settings.descrizione_generale || "", avviaCaricamentoGPX, apriModaleModifica);
    }
});

// --- GESTIONE DELLO STATO (LOCAL STORAGE) ---
function saveState() { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); 
}

function loadState() {
    const datiSalvati = localStorage.getItem(STORAGE_KEY);
    if (!datiSalvati) return;
    
    STATE = JSON.parse(datiSalvati);
    const s = STATE.settings;
    if (!s) return;

    // Ripristina i valori nei campi di testo delle impostazioni se esistono nel DOM
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
        livello: document.getElementById("livello")?.value || 'intermedio',
        obbKm: parseFloat(document.getElementById("obbKm")?.value) || 50,
        obbAsc: parseInt(document.getElementById("obbAsc")?.value) || 2000,
        settimane: parseInt(document.getElementById("settimane")?.value) || 12,
        dataGara: document.getElementById("dataGara")?.value || '',
        tempoObiettivo: parseFloat(document.getElementById("tempoObiettivo")?.value) || 6,
        giorniCorsa: [...document.querySelectorAll(".chk-btn[data-type='corsa'].active")].map(b => b.dataset.day),
        giorniPalestra: [...document.querySelectorAll(".chk-btn[data-type='palestra'].active")].map(b => b.dataset.day)
    };
}

function mostraCardPiano(tipo) {
    const cardLocal = document.getElementById("PlandCard");
    const cardAI = document.getElementById("aiPlanCard");
    if (tipo === 'local') { 
        if(cardLocal) cardLocal.style.display = 'block'; 
        if(cardAI) cardAI.style.display = 'none'; 
    } else if (tipo === 'ai') { 
        if(cardLocal) cardLocal.style.display = 'none'; 
        if(cardAI) cardAI.style.display = 'block'; 
    }
}

// --- GESTIONE BOTTONI FISSI (PROTETTI DA NULL-POINTER) ---
function agganciaBottoniStatici() {
    
    // Listener Esportazione protetto
    const btnEsporta = document.getElementById("btnEsporta");
    if (btnEsporta) {
        btnEsporta.onclick = () => esportaPianoInJSON(STATE);
    }

    // Listener Importazione protetto
    const btnImporta = document.getElementById("btnImporta");
    if (btnImporta) {
        btnImporta.onclick = () => {
            const funzioniCallback = { 
                saveState, 
                mostraCardPiano, 
                renderPianoAI, 
                renderPianoLocale: (pData, desc, gpxCall, modCall) => {
                    const descrizioneEffettiva = (typeof desc === 'string') ? desc : (STATE.settings?.descrizione_generale || "");
                    const clickGPX = (typeof desc === 'function') ? desc : gpxCall;
                    const clickEdit = (typeof gpxCall === 'function') ? gpxCall : modCall;
                    renderPianoLocale(pData, descrizioneEffettiva, clickGPX, clickEdit);
                }, 
                avviaCaricamentoGPX, 
                apriModaleModifica 
            };
            importaPianoDaJSON(funzioniCallback, STATE);
        };
    }

    // Toggle Pannello Impostazioni
    const toggleSettings = document.getElementById("toggleSettings");
    if (toggleSettings) {
        toggleSettings.onclick = () => {
            const card = document.getElementById("settingsCard");
            if (card) card.style.display = (card.style.display === "none" || card.style.display === "") ? "block" : "none";
        };
    }

    // Reset Applicazione Totale + Svuotamento Cache Profonda
    const resetData = document.getElementById("resetData");
    if (resetData) {
        resetData.onclick = async () => {
            if (confirm("Vuoi cancellare definitivamento i dati, svuotare la cache e forzare il riavvio dell'app?")) {
                localStorage.removeItem(STORAGE_KEY);
                if ('caches' in window) {
                    try {
                        const cacheNames = await caches.keys();
                        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
                        console.log("Tutte le cache del Service Worker sono state eliminate.");
                    } catch (err) {
                        console.error("Errore durante lo svuotamento della cache:", err);
                    }
                }
                window.location.reload(true);
            }
        };
    }

    // Genera Piano Locale
    const genLocal = document.getElementById("genLocal");
    if (genLocal) {
        genLocal.onclick = () => {
            const settings = catturaImpostazioniSchermo();
            if (!settings.dataGara || settings.giorniCorsa.length === 0) { alert("Inserisci la data della gara e almeno un giorno di corsa!"); return; }
            
            const { raceDate } = calculatePlanDates(settings.dataGara, settings.settimane);
            const dataFormattata = new Date(raceDate).toLocaleDateString('it-IT');
            settings.descrizione_generale = `Piano locale per livello ${settings.livello}, termina il ${dataFormattata}. Target picco: ${settings.obbKm} km, +${settings.obbAsc}m D+.`;

            STATE.settings = settings;
            STATE.planData = generaPianoLogico(settings);
            STATE.planDataAI = null;

            saveState();
            const settingsCard = document.getElementById("settingsCard");
            if (settingsCard) settingsCard.style.display = "none";
            mostraCardPiano('local');
            renderPianoLocale(STATE.planData, STATE.settings.descrizione_generale, avviaCaricamentoGPX, apriModaleModifica);
        };
    }

    // Genera Piano AI
    const genAI = document.getElementById("genAI");
    if (genAI) {
        genAI.onclick = async () => {
            const settings = catturaImpostazioniSchermo();
            if (!settings.dataGara) { alert("Manca la data della gara!"); return; }

            const aiContainer = document.getElementById("piano-generato");
            const settingsCard = document.getElementById("settingsCard");
            if (settingsCard) settingsCard.style.display = "none";
            mostraCardPiano('ai');
            if (aiContainer) aiContainer.innerHTML = "<p>⏳ L'Intelligenza Artificiale sta elaborando i dislivelli e i carichi progressivi. Attendi...</p>";

            try {
                STATE.settings = settings;
                const rispostaTesto = await generaPianoAI(settings);
                const oggettoPianoAI = pulisciEParseJSONAI(rispostaTesto);

                STATE.planDataAI = oggettoPianoAI;
                STATE.planData = null;
                saveState();

                renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
            } catch (err) {
                console.error(err);
                if (aiContainer) aiContainer.innerHTML = `<p style="color:red;">❌ Errore durante la generation AI: ${err.message}</p>`;
            }
        };
    }

    // Bottone Update per Pop-up di riepilogo grafico
    const updatePlanBtn = document.getElementById("updatePlanBtn");
    if (updatePlanBtn) {
        updatePlanBtn.onclick = () => {
            if (!STATE.planData && !STATE.planDataAI) { alert("Nessun piano attivo da analizzare."); return; }
            const tipoAttivo = STATE.planDataAI ? 'ai' : 'local';
            mostraPopupAndamento(tipoAttivo);
        };
    }
}

// --- LOGICA INTERFACCIA SELEZIONE GIORNI (ANTI-CONFLITTO) ---
function inizializzaInterfacciaDinamica() {
    const settingsCard = document.getElementById("settingsCard");
    if (settingsCard) {
        settingsCard.addEventListener("click", (e) => {
            if (e.target.classList.contains("chk-btn")) {
                const { day, type } = e.target.dataset;
                if (type === 'corsa' && !e.target.classList.contains('active')) {
                    document.querySelector(`.chk-btn[data-day="${day}"][data-type="palestra"]`)?.classList.remove('active');
                } else if (type === 'palestra' && !e.target.classList.contains('active')) {
                    document.querySelector(`.chk-btn[data-day="${day}"][data-type="corsa"]`)?.classList.remove('active');
                }
                e.target.classList.toggle("active");
            }
        });
    }
}

// --- LOGICA MODIFICA ALLENAMENTI MODALE ---
let modificaInCorso = { tipoPiano: null, wIdx: null, aIdx: null };

function apriModaleModifica(tipoPiano, wIdx, aIdx) {
    modificaInCorso = { tipoPiano, wIdx, aIdx };
    const piano = tipoPiano === 'local' ? STATE.planData : STATE.planDataAI.settimane;
    const attivita = piano[wIdx].allenamenti[aIdx];

    const cType = tipoPiano === 'local' ? attivita.type : attivita.tipo;
    const cDetails = tipoPiano === 'local' ? (attivita.details?.detailText || "") : (attivita.dettagli || "");
    const cKm = tipoPiano === 'local' ? (attivita.details?.distance || 0) : (attivita.km || 0);
    const cAsc = tipoPiano === 'local' ? (attivita.details?.ascent || 0) : (attivita.asc || 0);
    const cDur = tipoPiano === 'local' ? (attivita.details?.durationMin || 60) : (attivita.durationMin || 60);

    const modalForm = document.getElementById("modalForm");
    if (!modalForm) return;

    let options = CORSA_TYPES.map(t => `<option value="${t}" ${cType === t ? 'selected' : ''}>${t}</option>`).join('');
    options += `<option value="Palestra" ${cType === 'Palestra' ? 'selected' : ''}>🏋️ Palestra</option>`;
    options += `<option value="Riposo" ${cType === 'Riposo' ? 'selected' : ''}>💤 Riposo</option>`;

    modalForm.innerHTML = `
        <label>Tipo Allenamento</label><select id="editType">${options}</select>
        <label>Dettagli</label><input id="editDetails" type="text" value="${cDetails}" />
        <div id="runFields">
            <label>Chilometri (km)</label><input id="editKm" type="number" step="0.1" value="${cKm}" />
            <label>Dislivello (m)</label><input id="editAsc" type="number" value="${cAsc}" />
        </div>
        <label>Durata (min)</label><input id="editDuration" type="number" value="${cDur}" />
    `;

    const editModal = document.getElementById("editModal");
    if (editModal) editModal.style.display = 'flex';

    const editTypeSelect = document.getElementById("editType");
    const runFields = document.getElementById("runFields");
    
    if (editTypeSelect && runFields) {
        editTypeSelect.onchange = () => {
            const val = editTypeSelect.value;
            runFields.style.display = (val === "Palestra" || val === "Riposo") ? "none" : "block";
            const detailsInput = document.getElementById("editDetails");
            if (detailsInput) detailsInput.value = getDefaultDetails(val);
        };
        if (cType === "Palestra" || cType === "Riposo") runFields.style.display = "none";
    }
}

const saveEditBtn = document.getElementById("saveEditBtn");
if (saveEditBtn) {
    saveEditBtn.onclick = () => {
        const { tipoPiano, wIdx, aIdx } = modificaInCorso;
        if (tipoPiano === null) return;

        const piano = tipoPiano === 'local' ? STATE.planData : STATE.planDataAI.settimane;
        const attivita = piano[wIdx].allenamenti[aIdx];

        const nType = document.getElementById("editType").value;
        const nDetails = document.getElementById("editDetails").value;
        const nDuration = parseInt(document.getElementById("editDuration").value) || 0;

        if (tipoPiano === 'local') {
            if (!attivita.details) attivita.details = {};
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
        const editModal = document.getElementById("editModal");
        if (editModal) editModal.style.display = 'none';
        
        if (tipoPiano === 'local') renderPianoLocale(STATE.planData, STATE.settings.descrizione_generale, avviaCaricamentoGPX, apriModaleModifica);
        else renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
    };
}

// --- STRUMENTO PARSING GPX ---
function avviaCaricamentoGPX(tipoPiano, wIdx, aIdx) {
    const inputInvisibile = document.getElementById("hiddenFileInput");
    if (!inputInvisibile) return;

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
                if (!attivita.details) attivita.details = {};
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

        const primoTempoStr = punti[0].querySelector("time")?.textContent;
        const ultimoTempoStr = punti[punti.length - 1].querySelector("time")?.textContent;
        
        let durataMinuti = 0;
        if (primoTempoStr && ultimoTempoStr) {
            const dataIninizio = new Date(primoTempoStr);
            const dataFine = new Date(ultimoTempoStr);
            durataMinuti = Math.round((dataFine - dataIninizio) / 1000 / 60);
        }

        let km = 0, dPlus = 0;
        for (let i = 1; i < punti.length; i++) {
            const lat1 = parseFloat(punti[i-1].getAttribute("lat")), lon1 = parseFloat(punti[i-1].getAttribute("lon"));
            const lat2 = parseFloat(punti[i].getAttribute("lat")), lon2 = parseFloat(punti[i].getAttribute("lon"));
            
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            km += R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));

            const ele1 = punti[i-1].querySelector("ele") ? parseFloat(punti[i-1].querySelector("ele").textContent) : null;
            const ele2 = punti[i].querySelector("ele") ? parseFloat(punti[i].querySelector("ele").textContent) : null;
            if (ele1 !== null && ele2 !== null && ele2 > ele1) dPlus += (ele2 - ele1);
        }

        let stringaPassoMedio = "--:--";
        if (km > 0 && durataMinuti > 0) {
            const passoDecimale = durataMinuti / km; 
            const min = Math.floor(passoDecimale);
            const sec = Math.round((passoDecimale - min) * 60);
            stringaPassoMedio = min + ":" + String(sec).padStart(2, '0');
        }

        return { 
            distanceKm: +km.toFixed(2), 
            ascentMeters: Math.round(dPlus),
            durationMin: durataMinuti,
            paceStr: stringaPassoMedio
        };
    } catch { return null; }
}

// --- LOGICA INTERFACCIA ED ESTRAZIONE MODALE POP-UP ---
// MODIFICATO: rimosso il comando 'export' davanti alla funzione principale di controllo interno per preservare la stabilità di esecuzione su iOS
function mostraPopupAndamento(tipoPiano) {
    const pianoLogico = tipoPiano === 'local' ? STATE.planData : STATE.planDataAI?.settimane;
    
    if (!pianoLogico) {
        alert("Nessun dato disponibile per analizzare questo piano.");
        return;
    }

    const report = analizzaStatoPiano(pianoLogico);
    if (!report) return;

    const oreReali = Math.floor(report.minutiTotaliReali / 60);
    const minutiReali = report.minutiTotaliReali % 60;
    const stringaTempoReale = oreReali > 0 ? `${oreReali}h ${minutiReali}m` : `${minutiReali}m`;

    const coloreDelta = Math.abs(report.scostamentoKmPercentuale) > 20 ? "#e53935" : "#43a047";
    const segnoDelta = report.scostamentoKmPercentuale > 0 ? "+" : "";

    const modalHtml = `
        <div id="custom-progress-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            <div style="background: #ffffff; width: 90%; max-width: 400px; padding: 20px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); text-align: center;">
                <h3 style="margin-top: 0; color: #333;">📊 Resoconto Andamento</h3>
                <p style="font-size: 13px; color: #666; margin-bottom: 20px;">Confronto tra gli obiettivi passati del piano e le tue attività reali caricate (GPX / Manuali).</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 14px;">
                    <thead>
                        <tr style="border-bottom: 2px solid #eee; color: #666; font-size: 12px;">
                            <th style="padding: 8px; text-align: left;">Metrica</th>
                            <th style="padding: 8px; text-align: right;">Previsto</th>
                            <th style="padding: 8px; text-align: right; color: #2e7d32;">Effettivo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid #f5f5f5;">
                            <td style="padding: 10px; text-align: left;">🏃 <strong>Distanza</strong></td>
                            <td style="padding: 10px; text-align: right; color:#777;">${report.kmTeorici} km</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">${report.kmReali} km</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f5f5f5;">
                            <td style="padding: 10px; text-align: left;">⛰️ <strong>Dislivello</strong></td>
                            <td style="padding: 10px; text-align: right; color:#777;">+${report.ascentTeorica} m</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">+${report.ascentReale} m</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f5f5f5;">
                            <td style="padding: 10px; text-align: left;">⏱️ <strong>Tempo Mov.</strong></td>
                            <td style="padding: 10px; text-align: right; color:#777;">--</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">${stringaTempoReale}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #444;">
                    Stato chilometrico: <span style="color: ${coloreDelta}; font-weight: bold;">${segnoDelta}${report.scostamentoKmPercentuale}%</span><br>
                    <small style="color:#888;">Allenamenti chiusi: ${report.completati} | Saltati: ${report.saltati}</small>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button id="btn-modal-annulla" style="flex: 1; padding: 12px; background: #eee; border: none; border-radius: 6px; font-weight: bold; color: #555; cursor: pointer;">Annulla</button>
                    <button id="btn-modal-aggiorna" style="flex: 1; padding: 12px; background: #2ed573; border: none; border-radius: 6px; font-weight: bold; color: white; cursor: pointer;">Aggiorna Piano</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById("btn-modal-annulla").onclick = () => { rimuoviPopup(); };
    document.getElementById("btn-modal-aggiorna").onclick = () => {
        rimuoviPopup();
        eseguiRicalcoloPianoFuturo(tipoPiano, report);
    };
}

function rimuoviPopup() {
    const modal = document.getElementById("custom-progress-modal");
    if (modal) modal.remove();
}

function eseguiRicalcoloPianoFuturo(tipoPiano, report) {
    console.log("Apertura selezione modalità di ricalcolo per:", tipoPiano);
    const nuoveImpostazioni = catturaImpostazioniSchermo();

    const modalSceltaHtml = `
        <div id="custom-choice-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10001; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            <div style="background: #ffffff; width: 90%; max-width: 400px; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); text-align: center;">
                
                <h3 style="margin-top: 0; color: #333;">⚙️ Scegli Metodo di Ricalcolo</h3>
                <p style="font-size: 13px; color: #666; margin-bottom: 20px;">Come vuoi rimodulare i carichi delle settimane future rimaste?</p>
                
                <button id="btn-scelta-locale" style="width: 100%; padding: 14px; background: #f0f7ff; border: 1px solid #b3d7ff; border-radius: 8px; text-align: left; margin-bottom: 12px; cursor: pointer;">
                    <div style="font-weight: bold; color: #0061c9; font-size: 14px;">🧮 Ricalcolo Matematico (Locale)</div>
                    <div style="font-size: 11px; color: #555; margin-top: 4px;">Ricalcola il futuro applicando i nuovi parametri inseriti a schermo (Data gara: ${nuoveImpostazioni.dataGara || 'Invariata'}, Target: ${nuoveImpostazioni.obbKm}km), basandosi sullo scostamento attuale (${report.scostamentoKmPercentuale}%). Istantaneo e offline.</div>
                </button>

                <button id="btn-scelta-ai" style="width: 100%; padding: 14px; background: #f0f7ff; border: 1px solid #b3d7ff; border-radius: 8px; text-align: left; margin-bottom: 20px; cursor: pointer;">
                    <div style="font-weight: bold; color: #0061c9; font-size: 14px;">🤖 Ottimizzazione Avanzata AI</div>
                    <div style="font-size: 11px; color: #555; margin-top: 4px;">Ricalcola il futuro applicando i nuovi parametri inseriti a schermo (Data gara: ${nuoveImpostazioni.dataGara || 'Invariata'}, Target: ${nuoveImpostazioni.obbKm}km). Invia lo storico a Gemini per una progressione smart del carico.</div>
                </button>

                <button id="btn-scelta-chiudi" style="width: 100%; padding: 10px; background: #eee; border: none; border-radius: 6px; font-weight: bold; color: #666; cursor: pointer;">Annulla</button>

            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalSceltaHtml);

    document.getElementById("btn-scelta-chiudi").onclick = () => rimuoviPopupScelta();

    document.getElementById("btn-scelta-locale").onclick = () => {
        rimuoviPopupScelta();
        avviaRimodulazioneMatematica(tipoPiano, report, nuoveImpostazioni);
    };

    document.getElementById("btn-scelta-ai").onclick = () => {
        rimuoviPopupScelta();
        avviaRimodulazioneAI(tipoPiano, report, true, nuoveImpostazioni);
    };
}

function rimuoviPopupScelta() {
    const modalScelta = document.getElementById("custom-choice-modal");
    if (modalScelta) modalScelta.remove();
}

// --- LOGICA DI RIMODULAZIONE DEFINITIVA ---
async function avviaRimodulazioneAI(tipoPiano, report, applicaNuoveImpostazioni, nuoveImpostazioni) {
    if (!STATE.planData && !STATE.planDataAI) { 
        alert("Nessun piano attivo da rimodulare."); 
        return; 
    }

    const aiContainer = document.getElementById("piano-generato");
    if (aiContainer) {
        aiContainer.innerHTML = "<p>⏳ L'AI sta analizzando lo storico dei tuoi GPX e rimodulando le settimane future... Attendi...</p>";
    }
    
    try {
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);

        const settimaneAttuali = STATE.planDataAI?.settimane || STATE.planData || [];

        const settimanePassate = settimaneAttuali.filter(w => {
            const dataSettimana = new Date(w.startDate);
            const haCompletati = w.allenamenti && w.allenamenti.some(a => a.completed || (a.details && a.details.completed));
            return dataSettimana < oggi || haCompletati;
        });

        const settimaneFuture = settimaneAttuali.filter(w => !settimanePassate.includes(w));

        if (settimaneFuture.length === 0) {
            alert("Non ci sono settimane future rimaste nel piano da poter rimodulare!");
            return;
        }

        const settingsDaUsare = applicaNuoveImpostazioni ? nuoveImpostazioni : STATE.settings;

        if (applicaNuoveImpostazioni) {
            STATE.settings = nuoveImpostazioni;
        }

        const settingsArricchiti = {
            ...settingsDaUsare,
            scostamentoStoricoPercentuale: report.scostamentoKmPercentuale,
            kmRealiCorsiNelPassato: report.kmReali,
            dislivelloRealeNelPassato: report.ascentReale
        };

        const rispostaRicalcolo = await ricalcolaSettimaneFutureAI(settingsArricchiti, settimaneFuture);
        const nuoveSettimaneRicalcolate = pulisciEParseJSONAI(rispostaRicalcolo);

        const pianoConsolidato = {
            descrizione_generale: `Piano rimodulato via AI il ${new Date().toLocaleDateString('it-IT')}. Target finale: ${settingsDaUsare.obbKm}km.`,
            settimane: [...settimanePassate, ...nuoveSettimaneRicalcolate.settimane]
        };

        STATE.planDataAI = pianoConsolidato;
        STATE.planData = null;
        
        saveState();
        mostraCardPiano('ai');
        renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
        
        alert("🎯 Il piano futuro è stato riadattato con successo! Le settimane passate e i tuoi GPX inseriti sono stati preservati.");

    } catch (err) {
        console.error("Errore durante la rimodulazione AI:", err);
        alert("Impossibile completare la rimodulazione AI: " + err.message);
        if (STATE.planDataAI) renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
    }
}

function avviaRimodulazioneMatematica(tipoPiano, report, nuoveImpostazioni) {
    const dataFormattata = nuoveImpostazioni.dataGara ? new Date(nuoveImpostazioni.dataGara).toLocaleDateString('it-IT') : '';
    const nuovaDescrizione = `Piano locale ricalcolato, termina il ${dataFormattata}. Target picco: ${nuoveImpostazioni.obbKm} km, +${nuoveImpostazioni.obbAsc}m D+.`;
    
    STATE.settings.descrizione_generale = nuovaDescrizione;

    eseguiRimodulazioneMatematicaLocale(tipoPiano, report, nuoveImpostazioni, STATE, {
        saveState,
        mostraCardPiano,
        renderPianoAI,
        renderPianoLocale: (pData, desc, gpxCall, modCall) => {
            const descrizioneEffettiva = (typeof desc === 'string') ? desc : STATE.settings.descrizione_generale;
            const clickGPX = (typeof desc === 'function') ? desc : gpxCall;
            const clickEdit = (typeof gpxCall === 'function') ? gpxCall : modCall;
            
            renderPianoLocale(pData, descrizioneEffettiva, clickGPX, clickEdit);
        },
        avviaCaricamentoGPX,
        apriModaleModifica
    });
}
