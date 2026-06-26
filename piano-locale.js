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
    const parts = dataGara.split('-');
    const raceDate = new Date(parts[0], parts[1] - 1, parts[2]); 
    raceDate.setHours(0, 0, 0, 0);
    const daysBeforeRace = settimane * 7;
    let startDate = addDays(raceDate, -daysBeforeRace); 
    
    const dayOfWeek = startDate.getDay(); 
    if (dayOfWeek === 0) startDate = addDays(startDate, -6);
    else if (dayOfWeek > 1) startDate = addDays(startDate, -(dayOfWeek - 1));
    
    const fineRangeStandard = addDays(startDate, settimane * 7);
    let settimaneReali = settimane;
    if (raceDate >= fineRangeStandard) settimaneReali = settimane + 1;
    
    return { startDate, raceDate, settimaneReali };
}

export function generaPianoLogico(settings) {
    const { livello, obbKm, obbAsc, settimane, giorniCorsa, giorniPalestra, dataGara, passoBasePianura } = settings;
    const { startDate, settimaneReali } = calculatePlanDates(dataGara, settimane);
    const plan = [];

    // Parametri Base
    const targetKmGara = parseFloat(obbKm) || 54;
    const targetDplusGara = parseFloat(obbAsc) || 4000;
    const passo10k = parseFloat(passoBasePianura) || 5.8; // Passo 10k di riferimento fornito dall'utente (es. 5.8 = 5:48/km)
    
    // Configurazione Picco
    const lungoPiccoTarget = Math.round(targetKmGara * 0.70); 
    const dplusPiccoTarget = Math.round(lungoPiccoTarget * (targetDplusGara / targetKmGara)); 
    
    // Punto di partenza (Giorno 1) per la progressione dei lunghi
    // 16km base per ultra, oppure un volume proporzionale se la gara è più breve
    let kmCorrentiLungo = Math.min(16, targetKmGara * 0.4); 
    let dplusCorrenteLungo = Math.round(kmCorrentiLungo * (targetDplusGara / targetKmGara));

    // Generazione della griglia strutturale delle settimane (Lungo, Ripetute e Lenti)
    for (let w = 1; w <= settimaneReali; w++) {
        const weekStartDate = addDays(startDate, (w - 1) * 7);
        const isUltimaSettimana = (w === settimaneReali);
        const isScaricoFisso = (!isUltimaSettimana && (w - 1) % 4 === 3); // Ogni 4 settimane
        const isTaperingFinale = (settimaneReali - w) <= 2; 

        // 1. Calcolo Progressione Biologica dei Lunghi
        let focusSettimana = "";
        
        if (isUltimaSettimana) {
            kmCorrentiLungo = targetKmGara;
            dplusCorrenteLungo = targetDplusGara;
            focusSettimana = "🏁 GARA TARGET";
        } else if (isScaricoFisso && !isTaperingFinale) {
            // Settimana di scarico periodica (-20%)
            kmCorrentiLungo = Math.round((kmCorrentiLungo * 0.8) * 10) / 10;
            dplusCorrenteLungo = Math.round(dplusCorrenteLungo * 0.8);
            focusSettimana = "Fase di scarico ciclico";
        } else if (!isTaperingFinale) {
            // Crescita progressiva naturale (+10% km, +12% dplus) fino al picco
            kmCorrentiLungo = Math.min(lungoPiccoTarget, Math.round((kmCorrentiLungo * 1.10) * 10) / 10);
            dplusCorrenteLungo = Math.min(dplusPiccoTarget, Math.round(dplusCorrenteLungo * 1.12));
            focusSettimana = "Costruzione progressiva volume";
        } else {
            // Tapering (le ultime 2 settimane prima della gara)
            const settimaneMancantiAllaGara = settimaneReali - w;
            if (settimaneMancantiAllaGara === 2) {
                kmCorrentiLungo = Math.round(lungoPiccoTarget * 0.7); 
                dplusCorrenteLungo = Math.round(dplusPiccoTarget * 0.6);
                focusSettimana = "Inizio scarico pre-gara";
            } else { // 1 settimana prima
                kmCorrentiLungo = Math.round(lungoPiccoTarget * 0.4); 
                dplusCorrenteLungo = Math.round(dplusPiccoTarget * 0.3);
                focusSettimana = "Scarico e Tapering finale";
            }
        }

        // 2. Assegnazione tipologie di corsa ai giorni
        const allenamentiSettimana = [];
        let totaleKmSettimanale = 0, totaleDplusSettimanale = 0;
        let runAssignments = {};
        const runDaysCopy = [...giorniCorsa];

        if (isUltimaSettimana) {
            runAssignments["Domenica"] = "GARA 🎉";
            if (runDaysCopy.includes("Domenica")) runDaysCopy.splice(runDaysCopy.indexOf("Domenica"), 1);
            if (runDaysCopy.includes("Sabato")) runDaysCopy.splice(runDaysCopy.indexOf("Sabato"), 1);
            runDaysCopy.forEach(day => { runAssignments[day] = "Corsa Facile (attivazione)"; });
        } else {
            if (runDaysCopy.includes("Sabato")) { runAssignments["Sabato"] = "Lungo trail"; runDaysCopy.splice(runDaysCopy.indexOf("Sabato"), 1); }
            else if (runDaysCopy.includes("Domenica")) { runAssignments["Domenica"] = "Lungo trail"; runDaysCopy.splice(runDaysCopy.indexOf("Domenica"), 1); }
            
            if (runDaysCopy.length > 0) { runAssignments[runDaysCopy[0]] = "Ripetute / Qualità"; runDaysCopy.splice(0, 1); }
            runDaysCopy.forEach(day => { runAssignments[day] = "Fondo Lento"; });
        }

        // 3. Compilazione dei dettagli giornalieri
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
                det.detailText = "Allenamento di Forza o Core, 45-60 min. Focus su gambe, schiena e stabilità.";
            } else if (runAssignments[day]) {
                type = runAssignments[day];
                let kmGiorno = 0, dplusGiorno = 0, durataMinuti = 0, descSpecifico = "";
                
                if (type === "GARA 🎉") {
                    kmGiorno = targetKmGara;
                    dplusGiorno = targetDplusGara;
                    
                    const oreStimate = Math.floor((kmGiorno + (dplusGiorno / 100)) * (passo10k * 1.30) / 60);
                    durataMinuti = Math.round((kmGiorno + (dplusGiorno / 100)) * (passo10k * 1.30)); 
                    descSpecifico = `🏁 Giorno dell'obiettivo! Divertiti e gestisci il ritmo.`;
                    
                } else if (type === "Lungo trail") {
                    kmGiorno = kmCorrentiLungo;
                    dplusGiorno = dplusCorrenteLungo;
                    
                    const passoZ2 = passo10k * 1.15; // Z2 Aerobico
                    durataMinuti = Math.round((kmGiorno + (dplusGiorno / 100)) * passoZ2);
                    descSpecifico = `Lungo specifico a sensazione in ambiente trail. Cammina le salite ripide.`;
                    
                } else if (type === "Ripetute / Qualità") {
                    // Logica Fisiologica Ripetute a Tempo
                    const isSettimanaDispari = (w % 2 !== 0);
                    let quanteRipetute = 0;
                    
                    if (isSettimanaDispari) {
                        // 🏃 BREVI: VO2Max (Frazioni da 1'15")
                        quanteRipetute = 8;
                        if (w > 3) quanteRipetute = 10;
                        if (w > 7) quanteRipetute = 12;
                        
                        const passoBreve = passo10k * 0.90; // 10% più veloce della soglia
                        descSpecifico = `Riscl. 15' + ${quanteRipetute}x 1'15" @${formattaPasso(passoBreve)}/km (Rec. 1'30" da fermo) + Defat.`;
                        
                        const kmFrazioni = (quanteRipetute * 1.25) / passoBreve;
                        kmGiorno = Math.round((3 + kmFrazioni) * 10) / 10; // 3km fisso riscl/defat
                        durataMinuti = Math.round(15 + (quanteRipetute * 1.25) + ((quanteRipetute - 1) * 1.5) + 5);
                        
                    } else {
                        // 🏃 LUNGHE: Tolleranza Lattato (Frazioni da 5')
                        quanteRipetute = 2;
                        if (w > 4) quanteRipetute = 4;
                        if (w > 8) quanteRipetute = 5;
                        
                        const passoLungo = passo10k; // Soglia pura
                        descSpecifico = `Riscl. 15' + ${quanteRipetute}x 5' @${formattaPasso(passoLungo)}/km (Rec. 2'30" Corsa Lenta) + Defat.`;
                        
                        const kmFrazioni = (quanteRipetute * 5) / passoLungo;
                        const kmRecuperi = ((quanteRipetute - 1) * 2.5) / (passo10k * 1.15); 
                        kmGiorno = Math.round((3 + kmFrazioni + kmRecuperi) * 10) / 10;
                        durataMinuti = Math.round(15 + (quanteRipetute * 5) + ((quanteRipetute - 1) * 2.5) + 5);
                    }
                    dplusGiorno = Math.round(dplusCorrenteLungo * 0.12);
                    
                } else { // Fondo Lento o Corsa Facile pre-gara
                    kmGiorno = Math.round((kmCorrentiLungo * 0.5) * 10) / 10;
                    if (isUltimaSettimana) kmGiorno = 5; 
                    dplusGiorno = Math.round(dplusCorrenteLungo * 0.4);
                    
                    const passoZ2 = passo10k * 1.15;
                    durataMinuti = Math.round((kmGiorno + (dplusGiorno / 100)) * passoZ2);
                    descSpecifico = `Fondo lento rigenerante. Volume aerobico senza forzare.`;
                }

                det.distance = kmGiorno;
                det.ascent = dplusGiorno;
                det.durationMin = durataMinuti;
                
                const tempoStimatoh = Math.floor(durataMinuti / 60);
                const tempoStimatom = durataMinuti % 60;
                const stringaTempo = tempoStimatoh > 0 ? `${tempoStimatoh}h ${tempoStimatom}m` : `${tempoStimatom} min`;

                det.detailText = `Distanza: ${kmGiorno} km, Dislivello: +${dplusGiorno} m, Tempo: ${stringaTempo}. \n${descSpecifico}`;
                
                if (type === "Ripetute / Qualità") {
                    summary = `🏃 Ripetute: ${descSpecifico}`;
                } else if (type === "GARA 🎉") {
                    summary = `🏁 TARGET GARA — ${kmGiorno} km`;
                } else {
                    summary = `${type} di ${kmGiorno} km`;
                }

                totaleKmSettimanale += kmGiorno;
                totaleDplusSettimanale += dplusGiorno;
            }

            allenamentiSettimana.push({day, type, summary, dettagli: det.detailText, details: det});
        }

        // Calcolo della durata del lungo del weekend per il riassunto della riga
        const passoZ2LungoInfo = passo10k * 1.15;
        const durataLungoSettimana = Math.round((kmCorrentiLungo + (dplusCorrenteLungo / 100)) * passoZ2LungoInfo);
        const infoOre = Math.floor(durataLungoSettimana / 60);
        const infoMinuti = durataLungoSettimana % 60;
        
        let stringaFocusFinale = `${focusSettimana} | Dom: ${kmCorrentiLungo}km (~${infoOre}h ${infoMinuti}m)`;
        if (isUltimaSettimana) stringaFocusFinale = "Obiettivo raggiunto, scarica e divertiti in gara!";

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
