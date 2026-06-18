// piano-locale.js - Logica di calcolo deterministica

export const CORSA_TYPES = [
    "Corsa Lenta", "Corsa Facile", "Lungo Lento", "Corsa in Collina",
    "Ripetute Veloci", "Fartlek", "Progressivo", "Interval Training", "Tempo Run", "GARA 🎉"
];

const nomiGiorniBrevi = { "Lunedì": "Lun", "Martedì": "Mar", "Mercoledì": "Mer", "Giovedì": "Gio", "Venerdì": "Ven", "Sabato": "Sab", "Domenica": "Dom" };
const GIORNI = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];

export function paceByLevel(l) { return l === "principiante" ? 6.2 : l === "intermedio" ? 5.8 : 5.4; }

export function getDefaultDetails(type) {
    switch(type) {
        case "Corsa Lenta": case "Corsa Facile": return "Corri a ritmo tranquillo (Z1/Z2), focus sulla resistenza. Durata tipica: 1 ora.";
        case "Lungo Lento": return "Lungo a ritmo costante, mantieni un'intensità bassa per costruire l'endurance.";
        case "Corsa in Collina": return "Ripetute in salita (5-8 volte 100-200m) per forza e potenza.";
        case "Ripetute Veloci": return "Ripetute in piano (es. 6x400m o 4x800m) con recupero attivo.";
        case "Fartlek": return "Gioco di velocità: alterna tratti veloci e lenti in modo spontaneo.";
        case "Progressivo": return "Inizia lento e aumenta il ritmo ogni 2-3 km, finendo a ritmo gara.";
        case "Palestra": return "Allenamento di Forza o Core, 45-60 min. Focus su gambe, schiena e stabilità.";
        case "Riposo": return "Giorno di recupero completo. Ideale per stretching o mobilità.";
        case "GARA 🎉": return "Giorno dell'obiettivo finale! Gestisci il ritmo e alimentati con precisione.";
        default: return "Dettagli specifici per l'allenamento. Modifica liberamente.";
    }
}

export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days); 
    return result;
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

export function creaDettagliAllenamento(type, weeklyKm, weeklyAsc, runsCount, livello) {
    if(runsCount === 0) return { distance: 0, ascent: 0, durationMin: 0, detailText: getDefaultDetails(type), completed: false, gpxData: null };
    const longPct = 0.55, speedPct = 0.25, fondoPct = 0.20;
    const longKm = weeklyKm * longPct, longAsc = weeklyAsc * longPct;
    const qualKm = weeklyKm * speedPct, qualAsc = weeklyAsc * speedPct;
    const fondoKm = (weeklyKm * fondoPct) / Math.max(1, runsCount - 2), fondoAsc = (weeklyAsc * fondoPct) / Math.max(1, runsCount - 2);
    
    let dist, asc;
    if(/Lungo/i.test(type)) { dist = longKm; asc = longAsc; }
    else if(/Ripetute|Progressivo|Fartlek/.test(type)) { dist = qualKm; asc = qualAsc; }
    else { dist = fondoKm; asc = fondoAsc; }
    
    const dur = dist * paceByLevel(livello);
    let det = getDefaultDetails(type);
    
    if(/Ripetute/.test(type)) det = `${Math.min(12, Math.max(4, Math.round(dist)))}×400 m in salita, rec. 90–120s`;
    else if(/Progressivo/.test(type)) det = `Progressivo: aumenta ritmo negli ultimi km`;
    else if(/Lungo/.test(type)) det = `Lungo trail: endurance e gestione salita`;
    
    return { distance: +dist.toFixed(1), ascent: Math.round(asc), durationMin: Math.round(dur), detailText: det, completed: false, gpxData: null };
}

export function generaPianoLogico(settings) {
    const { livello, obbKm, obbAsc, settimane, giorniCorsa, giorniPalestra, dataGara, tempoObiettivo } = settings;
    const runsCount = giorniCorsa.length;
    const { startDate, settimaneReali } = calculatePlanDates(dataGara, settimane);
    const plan = []; 
    const baseVolumeCoeff = 0.6;

    for(let w = 1; w <= settimaneReali; w++) {
        const weekStartDate = addDays(startDate, (w - 1) * 7);
        const isUltimaSettimana = (w === settimaneReali);
        const w_mod = (w - 1) % 4;
        const w_cycle = Math.floor((w - 1) / 4);
        
        let cycleCoeff = Math.min(baseVolumeCoeff + (w_cycle * 0.15), 1.0);
        if (w_mod === 1) cycleCoeff *= 1.10;
        else if (w_mod === 2) cycleCoeff *= 1.20;

        const isScarico = (w_mod === 3 || isUltimaSettimana);
        const moltiplicatoreScarico = isUltimaSettimana ? 0.4 : (isScarico ? 0.7 : 1);
        const finalCoeff = cycleCoeff * moltiplicatoreScarico;
        
        const baseKm = obbKm * finalCoeff;
        const baseAsc = obbAsc * finalCoeff;
        const settimana = []; 
        let totalKm = 0, totalAsc = 0;
        
        const runDaysCopy = [...giorniCorsa];
        let runAssignments = {};
        
        if (isUltimaSettimana) {
            runAssignments["Domenica"] = "GARA 🎉";
            if (runDaysCopy.includes("Domenica")) runDaysCopy.splice(runDaysCopy.indexOf("Domenica"), 1);
            if (runDaysCopy.includes("Sabato")) runDaysCopy.splice(runDaysCopy.indexOf("Sabato"), 1);
            runDaysCopy.forEach(day => { runAssignments[day] = "Corsa Facile"; });
        } else {
            if (runDaysCopy.includes("Sabato")) { runAssignments["Sabato"] = "Lungo trail"; runDaysCopy.splice(runDaysCopy.indexOf("Sabato"), 1); }
            else if (runDaysCopy.includes("Domenica")) { runAssignments["Domenica"] = "Lungo trail"; runDaysCopy.splice(runDaysCopy.indexOf("Domenica"), 1); }
            if (runDaysCopy.length > 0) { runAssignments[runDaysCopy[0]] = "Ripetute collinari"; runDaysCopy.splice(0, 1); }
            runDaysCopy.forEach(day => { runAssignments[day] = "Fondo lento"; });
        }

        for(const day of GIORNI) {
            if(isUltimaSettimana && giorniPalestra.includes(day)) {
                settimana.push({day, type:"Riposo", summary:"Riposo pre-gara", details:{detailText:"Niente pesi questa settimana. Solo mobilità.", distance: 0, ascent: 0, durationMin: 0, completed: false, gpxData: null}});
            } else if(giorniPalestra.includes(day)) {
                settimana.push({day, type:"Palestra", summary:"🏋️ Palestra", details:{detailText:getDefaultDetails("Palestra"), distance: 0, ascent: 0, durationMin: 60, completed: false, gpxData: null}});
            } else if(runAssignments[day] === "GARA 🎉") {
                const det = { distance: obbKm, ascent: obbAsc, durationMin: Math.round(tempoObiettivo * 60), detailText: getDefaultDetails("GARA 🎉"), completed: false, gpxData: null };
                totalKm += det.distance; totalAsc += det.ascent;
                settimana.push({day, type:"GARA 🎉", summary:`🏁 GIORNO DELLA GARA — ${det.distance} km`, details:det});
            } else if(giorniCorsa.includes(day) && runAssignments[day]) {
                const type = runAssignments[day];
                const det = isUltimaSettimana ? 
                    { distance: +(obbKm * 0.12).toFixed(1), ascent: 0, durationMin: Math.round((obbKm * 0.12) * paceByLevel(livello)), detailText: "Attivazione pre-gara controllata.", completed: false, gpxData: null } :
                    creaDettagliAllenamento(type, baseKm, baseAsc, runsCount, livello);
                totalKm += det.distance; totalAsc += det.ascent;
                settimana.push({day, type, summary:`🏃 ${type} — ${det.distance} km`, details:det});
            } else {
                settimana.push({day, type:"Riposo", summary:"Riposo", details:{detailText:getDefaultDetails("Riposo"), distance: 0, ascent: 0, durationMin: 0, completed: false, gpxData: null}});
            }
        }
        
        plan.push({
            settimana: w,
            startDate: `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`, 
            targetKm: +totalKm.toFixed(1), targetAsc: Math.round(totalAsc),
            allenamenti: settimana, isScarico, 
            focus: isUltimaSettimana ? "🏁 Tapering Finale e GARA!" : (isScarico ? "Settimana di scarico e recupero attivo" : "Costruzione volume e resistenza")
        });
    }
    return plan;
}
