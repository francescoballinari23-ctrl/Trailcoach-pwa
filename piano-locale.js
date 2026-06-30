// piano-locale.js - Logica di calcolo deterministica per Trail/Ultra basata sulla progressione biologica e passo utente

export const CORSA_TYPES = [
    "Corsa Lenta", "Corsa Facile", "Lungo Lento", "Corsa in Collina",
    "Ripetute Veloci", "Fartlek", "Progressivo", "Interval Training", "Tempo Run", "GARA 🎉"
];

const nomiGiorniBrevi = { "Lunedì": "Lun", "Martedì": "Mar", "Mercoledì": "Mer", "Giovedì": "Gio", "Venerdì": "Ven", "Sabato": "Sab", "Domenica": "Dom" };
const GIORNI = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];

export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days); 
    return result;
}

export function formattaPasso(passoDecimale) {
    const m = Math.floor(passoDecimale);
    const s = Math.round((passoDecimale - m) * 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export function calculatePlanDates(dataGara, settimane) {
    if (!dataGara) {
        const oggi = new Date();
        dataGara = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`;
    }
    const parts = dataGara.split('-');
    const raceDate = new Date(parts[0], parts[1] - 1, parts[2]); 
    raceDate.setHours(0, 0, 0, 0);
    const daysBeforeRace = (settimane || 12) * 7;
    let startDate = addDays(raceDate, -daysBeforeRace); 
    
    const dayOfWeek = startDate.getDay(); 
    if (dayOfWeek === 0) startDate = addDays(startDate, -6);
    else if (dayOfWeek > 1) startDate = addDays(startDate, -(dayOfWeek - 1));
    
    const fineRangeStandard = addDays(startDate, (settimane || 12) * 7);
    let settimaneReali = settimane || 12;
    if (raceDate >= fineRangeStandard) settimaneReali = settimane + 1;
    
    return { startDate, raceDate, settimaneReali };
}

/**
 * Fornisce i parametri iniziali e i valori di default per l'applicazione
 * Risolve l'errore di importazione in app.js
 */
export function getDefaultDetails() {
    return {
        livello: "5.8",
        obbKm: 50,
        obbAsc: 2000,
        settimane: 12,
        giorniCorsa: ["Martedì", "Giovedì", "Sabato"],
        giorniPalestra: ["Lunedì", "Mercoledì"],
        passoBasePianura: "5.8",
        dataGara: ""
    };
}

export function generaPianoLogico(settings) {
    const sicuroSettings = settings || {};
    const livello = sicuroSettings.livello || "5.8";
    const obbKm = sicuroSettings.obbKm || 50;
    const obbAsc = sicuroSettings.obbAsc || 2000;
    const settimane = sicuroSettings.settimane || 12;
    const giorniCorsa = sicuroSettings.giorniCorsa || ["Martedì", "Giovedì", "Sabato"];
    const giorniPalestra = sicuroSettings.giorniPalestra || ["Lunedì", "Mercoledì"];
    const dataGara = sicuroSettings.dataGara;
    const passoBasePianura = sicuroSettings.passoBasePianura || livello;

    const { startDate, raceDate, settimaneReali } = calculatePlanDates(dataGara, settimane);
    const plan = [];

    // Determina l'esatto giorno della settimana in cui cade la gara (es. "Sabato", "Domenica")
    const giornoDellaGaraTesto = GIORNI[(raceDate.getDay() === 0 ? 6 : raceDate.getDay() - 1)];

    const targetKmGara = parseFloat(obbKm) || 54;
    const targetDplusGara = parseFloat(obbAsc) || 4000;
    const passo10k = parseFloat(passoBasePianura) || 5.8; 
    
    const lungoPiccoTarget = Math.round(targetKmGara * 0.70); 
    const dplusPiccoTarget = Math.round(lungoPiccoTarget * (targetDplusGara / targetKmGara)); 
    
    const kmPartenzaLungo = Math.min(16, targetKmGara * 0.4); 
    const dplusPartenzaLungo = Math.round(kmPartenzaLungo * (targetDplusGara / targetKmGara));

    let kmProgressioneFisiologica = kmPartenzaLungo;
    let dplusProgressioneFisiologica = dplusPartenzaLungo;

    for (let w = 1; w <= settimaneReali; w++) {
        const weekStartDate = addDays(startDate, (w - 1) * 7);
        const isUltimaSettimana = (w === settimaneReali);
        const isScaricoFisso = (!isUltimaSettimana && (w - 1) % 4 === 3); 
        const isTaperingFinale = (settimaneReali - w) <= 2; 

        let focusSettimana = "";
        let kmCorrentiLungo = kmProgressioneFisiologica;
        let dplusCorrenteLungo = dplusProgressioneFisiologica;
        
        if (isUltimaSettimana) {
            kmCorrentiLungo = targetKmGara;
            dplusCorrenteLungo = targetDplusGara;
            focusSettimana = "🏁 GARA TARGET";
        } else if (isScaricoFisso && !isTaperingFinale) {
            kmCorrentiLungo = Math.round((kmProgressioneFisiologica * 0.8) * 10) / 10;
            dplusCorrenteLungo = Math.round(dplusProgressioneFisiologica * 0.8);
            focusSettimana = "Fase di scarico ciclico";
            
            kmProgressioneFisiologica = Math.min(lungoPiccoTarget, Math.round((kmProgressioneFisiologica * 1.10) * 10) / 10);
            dplusProgressioneFisiologica = Math.min(dplusPiccoTarget, Math.round(dplusProgressioneFisiologica * 1.12));
        } else if (!isTaperingFinale) {
            focusSettimana = "Costruzione progressiva volume";
            kmProgressioneFisiologica = Math.min(lungoPiccoTarget, Math.round((kmProgressioneFisiologica * 1.10) * 10) / 10);
            dplusProgressioneFisiologica = Math.min(dplusPiccoTarget, Math.round(dplusProgressioneFisiologica * 1.12));
        } else {
            const settimaneMancantiAllaGaraVal = settimaneReali - w;
            if (settimaneMancantiAllaGaraVal === 2) {
                kmCorrentiLungo = Math.round(lungoPiccoTarget * 0.7); 
                dplusCorrenteLungo = Math.round(dplusPiccoTarget * 0.6);
                focusSettimana = "Inizio scarico pre-gara";
            } else { 
                kmCorrentiLungo = Math.round(lungoPiccoTarget * 0.4); 
                dplusCorrenteLungo = Math.round(dplusPiccoTarget * 0.3);
                focusSettimana = "Scarico e Tapering finale";
            }
        }

        // --- STIMA DEL TEMPO REALE DEL LUNGO TEORICO ---
        const ripidezzaMertriPerKm = kmCorrentiLungo > 0 ? (dplusCorrenteLungo / kmCorrentiLungo) : 0;
        let fattoreRipidezza = 1.15;
        if (ripidezzaMertriPerKm > 60) fattoreRipidezza = 1.25; 
        if (ripidezzaMertriPerKm > 90) fattoreRipidezza = 1.35; 

        let fattoreDistanza = 1.0;
        if (kmCorrentiLungo > 25) fattoreDistanza = 1.08;
        if (kmCorrentiLungo > 40) fattoreDistanza = 1.18;

        const passoZ2Reale = passo10k * fattoreRipidezza * fattoreDistanza;
        const kmSforzoTeorici = kmCorrentiLungo + (dplusCorrenteLungo / 100);
        const durataLungoTeoricaMinuti = Math.round(kmSforzoTeorici * passoZ2Reale);

        const richiedeBackToBack = (durataLungoTeoricaMinuti > 420) && !isUltimaSettimana;

        if (richiedeBackToBack && focusSettimana === "Costruzione progressiva volume") {
            focusSettimana = "⚡ Blocco Back-to-Back (Volume Avanzato)";
        }

        const allenamentiSettimana = [];
        let totaleKmSettimanale = 0, totaleDplusSettimanale = 0;
        let runAssignments = {};
        let infoStringaFocusLungo = ""; 
        
        const runDaysCopy = Array.isArray(giorniCorsa) ? [...giorniCorsa] : [];

        // --- ASSEGNAZIONE DEI GIORNI DI CORSA CORRETTA ---
        if (isUltimaSettimana) {
            runAssignments[giornoDellaGaraTesto] = "GARA 🎉";
            if (runDaysCopy.includes(giornoDellaGaraTesto)) runDaysCopy.splice(runDaysCopy.indexOf(giornoDellaGaraTesto), 1);
            
            const indiceGara = GIORNI.indexOf(giornoDellaGaraTesto);
            if (indiceGara > 0) {
                const giornoVigilia = GIORNI[indiceGara - 1];
                if (runDaysCopy.includes(giornoVigilia)) runDaysCopy.splice(runDaysCopy.indexOf(giornoVigilia), 1);
            }
            runDaysCopy.forEach(day => { runAssignments[day] = "Corsa Facile (attivazione)"; });
        } else if (richiedeBackToBack) {
            runAssignments["Sabato"] = "B2B - Lungo Sabato";
            runAssignments["Domenica"] = "B2B - Lungo Domenica";
            if (runDaysCopy.includes("Sabato")) runDaysCopy.splice(runDaysCopy.indexOf("Sabato"), 1);
            if (runDaysCopy.includes("Domenica")) runDaysCopy.splice(runDaysCopy.indexOf("Domenica"), 1);
            
            if (runDaysCopy.length > 0) { runAssignments[runDaysCopy[0]] = "Ripetute / Qualità"; runDaysCopy.splice(0, 1); }
            runDaysCopy.forEach(day => { runAssignments[day] = "Fondo Lento"; });
        } else {
            let giornoLungo = "Domenica";
            if (runDaysCopy.includes("Sabato")) { giornoLungo = "Sabato"; runDaysCopy.splice(runDaysCopy.indexOf("Sabato"), 1); }
            else if (runDaysCopy.includes("Domenica")) { giornoLungo = "Domenica"; runDaysCopy.splice(runDaysCopy.indexOf("Domenica"), 1); }
            
            runAssignments[giornoLungo] = "Lungo trail";
            if (runDaysCopy.length > 0) { runAssignments[runDaysCopy[0]] = "Ripetute / Qualità"; runDaysCopy.splice(0, 1); }
            runDaysCopy.forEach(day => { runAssignments[day] = "Fondo Lento"; });
        }

        // --- CICLO GENERAZIONE GIORNALIERA ---
        for (const day of GIORNI) {
            let det = { distance: 0, ascent: 0, durationMin: 0, detailText: "", completed: false, gpxData: null };
            let type = "Riposo";
            let summary = "Riposo";

            if (isUltimaSettimana && giorniPalestra.includes(day)) {
                type = "Riposo";
                summary = "Riposo pre-gara";
                det.detailText = "Niente pesi, focus su mobilità e idratazione.";
            } else if (giorniPalestra.includes(day)) { 
                type = "Palestra";
                summary = "🏋️ Palestra";
                det.durationMin = 45;
                det.detailText = "Allenamento di Forza o Core, 45-60 min. Focus su stabilità e catena posteriore.";
            } else if (runAssignments[day]) {
                type = runAssignments[day];
                let kmGiorno = 0, dplusGiorno = 0, durataMinuti = 0, descSpecifico = "";
                
                if (type === "GARA 🎉") {
                    kmGiorno = targetKmGara;
                    dplusGiorno = targetDplusGara;
                    durataMinuti = Math.round((kmGiorno + (dplusGiorno / 100)) * (passo10k * 1.35)); 
                    descSpecifico = `🏁 Giorno dell'obiettivo! Gestisci le energie nella prima metà.`;
                    
                } else if (type === "Lungo trail") {
                    kmGiorno = kmCorrentiLungo;
                    dplusGiorno = dplusCorrenteLungo;
                    durataMinuti = durataLungoTeoricaMinuti;
                    descSpecifico = `Lungo specifico in ambiente trail. Ritmo aerobico, ottimizza i materiali.`;
                    const gBreve = day === "Sabato" ? "Sab" : "Dom";
                    infoStringaFocusLungo = `${gBreve}: ${kmGiorno}km (${Math.floor(durataMinuti/60)}h ${durataMinuti%60}m)`;

                } else if (type === "B2B - Lungo Sabato") {
                    kmGiorno = Math.round((kmCorrentiLungo * 0.6) * 10) / 10;
                    dplusGiorno = Math.round(dplusCorrenteLungo * 0.6);
                    const kmSforzo = kmGiorno + (dplusGiorno / 100);
                    durataMinuti = Math.round(kmSforzo * (passo10k * fattoreRipidezza)); 
                    descSpecifico = `Parte 1 del Back-to-Back. Corri sciolto, focus su nutrizione e idratazione pre-Domenica.`;
                    infoStringaFocusLungo = `Sab: ${kmGiorno}km (${Math.floor(durataMinuti/60)}h ${durataMinuti%60}m)`;

                } else if (type === "B2B - Lungo Domenica") {
                    kmGiorno = Math.round((kmCorrentiLungo * 0.5) * 10) / 10;
                    dplusGiorno = Math.round(dplusCorrenteLungo * 0.5);
                    const kmSforzo = kmGiorno + (dplusGiorno / 100);
                    durataMinuti = Math.round(kmSforzo * (passo10k * fattoreRipidezza * 1.10));
                    descSpecifico = `Parte 2 del Back-to-Back. Simulazione di gara su forte stanchezza residua. Cammina con decisione.`;
                    infoStringaFocusLungo += ` + Dom: ${kmGiorno}km (${Math.floor(durataMinuti/60)}h ${durataMinuti%60}m)`;

                } else if (type === "Ripetute / Qualità") {
                    const isSettimanaDispari = (w % 2 !== 0);
                    let quanteRipetute = 0;
                    
                    if (isSettimanaDispari) {
                        quanteRipetute = w > 7 ? 12 : (w > 3 ? 10 : 8);
                        const passoBreve = passo10k * 0.90; 
                        descSpecifico = `Riscl. 15' + ${quanteRipetute}x 1'15" @${formattaPasso(passoBreve)}/km (Rec. 1'30" da fermo) + Defat.`;
                        const kmFrazioni = (quanteRipetute * 1.25) / (passoBreve || 5);
                        kmGiorno = Math.round((3 + kmFrazioni) * 10) / 10; 
                        durataMinuti = Math.round(15 + (quanteRipetute * 1.25) + ((quanteRipetute - 1) * 1.5) + 5);
                    } else {
                        quanteRipetute = w > 8 ? 5 : (w > 4 ? 4 : 2);
                        const passoLungo = passo10k; 
                        descSpecifico = `Riscl. 15' + ${quanteRipetute}x 5' @${formattaPasso(passoLungo)}/km (Rec. 2'30" Corsa Lenta) + Defat.`;
                        const kmFrazioni = (quanteRipetute * 5) / (passoLungo || 5);
                        const kmRecuperi = ((quanteRipetute - 1) * 2.5) / (passo10k * 1.15); 
                        kmGiorno = Math.round((3 + kmFrazioni + kmRecuperi) * 10) / 10;
                        durataMinuti = Math.round(15 + (quanteRipetute * 5) + ((quanteRipetute - 1) * 2.5) + 5);
                    }
                    dplusGiorno = Math.round(dplusCorrenteLungo * 0.12);
                } else { 
                    kmGiorno = isUltimaSettimana ? 5 : Math.round((kmCorrentiLungo * 0.4) * 10) / 10;
                    dplusGiorno = Math.round(dplusCorrenteLungo * 0.25);
                    durataMinuti = Math.round((kmGiorno + (dplusGiorno / 100)) * (passo10k * 1.15));
                    descSpecifico = `Fondo lento rigenerante aerobico.`;
                }

                det.distance = kmGiorno;
                det.ascent = dplusGiorno;
                det.durationMin = durationMinuti;
                
                const tempoStimatoh = Math.floor(durataMinuti / 60);
                const tempoStimatom = durationMinuti % 60;
                const stringaTempo = tempoStimatoh > 0 ? `${tempoStimatoh}h ${tempoStimatom}m` : `${tempoStimatom} min`;

                det.detailText = `Distanza: ${kmGiorno} km, Dislivello: +${dplusGiorno} m, Tempo: ${stringaTempo}. \n${descSpecifico}`;
                
                if (type.includes("Ripetute")) {
                    summary = `🏃 Ripetute: ${descSpecifico}`;
                } else if (type === "GARA 🎉") {
                    summary = `🏁 TARGET GARA — ${kmGiorno} km`;
                } else if (type.includes("B2B")) {
                    summary = `🧱 ${type} — ${kmGiorno} km`;
                } else {
                    summary = `${type} di ${kmGiorno} km`;
                }

                totaleKmSettimanale += kmGiorno;
                totaleDplusSettimanale += dplusGiorno;
            }

            allenamentiSettimana.push({day, type, summary, dettagli: det.detailText, details: det});
        }
        
        let stringaFocusFinale = `${focusSettimana} | ${infoStringaFocusLungo}`;
        if (isUltimaSettimana) stringaFocusFinale = `Obiettivo raggiunto! La gara sarà di ${giornoDellaGaraTesto}.`;

        plan.push({
            settimana: w,
            startDate: `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`,
            totaleKm: Math.round(totaleKmSettimanale * 10) / 10, 
            totaleDplus: totaleDplusSettimanale,
            targetKm: Math.round(totaleKmSettimanale * 10) / 10, 
            targetAsc: totaleDplusSettimanale,
            allenamenti: allenamentiSettimana,
            isScarico: focusSettimana.includes("scarico") || focusSettimana.includes("Tapering"),
            focus: stringaFocusFinale,
            details: {
                totaleKm: Math.round(totaleKmSettimanale * 10) / 10, 
                totaleDplus: totaleDplusSettimanale
            }
        });
    }

    return plan;
}
