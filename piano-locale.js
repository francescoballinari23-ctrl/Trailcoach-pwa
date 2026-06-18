// piano-locale.js - Logica di calcolo deterministica per Trail/Ultra basata sulla settimana di picco

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
        case "Lungo Lento": case "Lungo trail": return "Lungo specifico a sensazione. Target: correre le discese e camminare forte le salite.";
        case "Corsa in Collina": case "Ripetute collinari": return "Riscaldamento + Ripetute in salita costanti + Defaticamento.";
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

export function generaPianoLogico(settings) {
    const { livello, obbKm, obbAsc, settimane, giorniCorsa, giorniPalestra, dataGara, tempoObiettivo } = settings;
    const runsCount = giorniCorsa.length;
    const { startDate, settimaneReali } = calculatePlanDates(dataGara, settimane);
    const plan = [];

    // 1. Parametri Gara e Ritmo Medio
    const tempoMinutiGara = tempoObiettivo * 60;
    const passoMedioGara = tempoMinutiGara / obbKm; 

    const settPiccoIdx = settimaneReali - 3; 
    const kmLungoPicco = obbKm * 0.80;
    const tempoLungoPiccoMin = tempoMinutiGara * 0.80;

    // Generiamo i dati strutturali dei lunghi
    const datiLunghiSettimanali = [];
    for (let w = 1; w <= settimaneReali; w++) {
        let kmLungo = 0;
        let tempoLungo = 0;
        let tipoFocus = "";
        let b2bKmMancanti = 0;
        let b2bTempoMancanti = 0;

        if (w === settimaneReali) {
            kmLungo = obbKm;
            tempoLungo = tempoMinutiGara;
            tipoFocus = "🏁 GARA TARGET";
        } else if (w === settimaneReali - 1) {
            kmLungo = kmLungoPicco * 0.40; 
            tempoLungo = tempoLungoPiccoMin * 0.40;
            tipoFocus = "Scarico e Tapering finale";
        } else if (w === settimaneReali - 2) {
            kmLungo = kmLungoPicco * 0.70;
            tempoLungo = tempoLungoPiccoMin * 0.70;
            tipoFocus = "Inizio scarico pre-gara";
        } else {
            const distanzaDaPicco = settPiccoIdx - (w - 1);
            const fattoreScalatura = Math.pow(0.90, distanzaDaPicco);
            
            kmLungo = kmLungoPicco * fattoreScalatura;
            tempoLungo = tempoLungoPiccoMin * fattoreScalatura;
            
            if ((w - 1) % 4 === 3 && w < settPiccoIdx) {
                kmLungo *= 0.75;
                tempoLungo *= 0.75;
                tipoFocus = "Fase di scarico ciclico";
            } else {
                tipoFocus = "Costruzione progressiva volume";
            }
        }

        // GESTIONE TETTO 8 ORE (480 MINUTI) CON BACK-TO-BACK AUTOMATICO
        if (w < settimaneReali && tempoLungo > 480) {
            const tempoTotaleTeorico = tempoLungo;
            const kmTotaliTeorici = kmLungo;

            // Il lungo principale viene limitato a 7 ore (420 minuti) per sicurezza
            tempoLungo = 420;
            kmLungo = tempoLungo / passoMedioGara;

            // La parte eccedente viene spostata al giorno prima (Back-to-Back)
            b2bTempoMancanti = tempoTotaleTeorico - tempoLungo;
            b2bKmMancanti = kmTotaliTeorici - kmLungo;
            tipoFocus += " | ⚠️ Back-to-Back nel Weekend (Lungo diviso in 2 giorni)";
        }

        datiLunghiSettimanali.push({ 
            kmLungo: +kmLungo.toFixed(1), 
            tempoLungo: Math.round(tempoLungo), 
            focus: tipoFocus,
            b2bKm: +b2bKmMancanti.toFixed(1),
            b2bTempo: Math.round(b2bTempoMancanti)
        });
    }

    // 3. Costruzione della timeline del piano
    for (let w = 1; w <= settimaneReali; w++) {
        const weekStartDate = addDays(startDate, (w - 1) * 7);
        const infoLungo = datiLunghiSettimanali[w - 1];
        const isUltimaSettimana = (w === settimaneReali);
        
        const kmSupportoTotale = isUltimaSettimana ? (obbKm * 0.3) : (infoLungo.kmLungo * 1.22); 
        const ascesaSupportoTotale = isUltimaSettimana ? (obbAsc * 0.2) : (obbAsc * (infoLungo.kmLungo / obbKm) * 0.5);

        const settimana = [];
        let totalKm = 0, totalAsc = 0;
        let runAssignments = {};
        const runDaysCopy = [...giorniCorsa];

        if (isUltimaSettimana) {
            runAssignments["Domenica"] = "GARA 🎉";
            if (runDaysCopy.includes("Domenica")) runDaysCopy.splice(runDaysCopy.indexOf("Domenica"), 1);
            if (runDaysCopy.includes("Sabato")) runDaysCopy.splice(runDaysCopy.indexOf("Sabato"), 1);
            runDaysCopy.forEach(day => { runAssignments[day] = "Corsa Facile"; });
        } else {
            // Se c'è un Back-to-Back attivo, occupiamo forzatamente sia Sabato che Domenica
            if (infoLungo.b2bKm > 0) {
                runAssignments["Sabato"] = "Lungo B2B (Fase 1)";
                runAssignments["Domenica"] = "Lungo trail (Fase 2)";
                if (runDaysCopy.includes("Sabato")) runDaysCopy.splice(runDaysCopy.indexOf("Sabato"), 1);
                if (runDaysCopy.includes("Domenica")) runDaysCopy.splice(runDaysCopy.indexOf("Domenica"), 1);
            } else {
                // Altrimenti gestione standard sul weekend
                if (runDaysCopy.includes("Sabato")) { runAssignments["Sabato"] = "Lungo trail"; runDaysCopy.splice(runDaysCopy.indexOf("Sabato"), 1); }
                else if (runDaysCopy.includes("Domenica")) { runAssignments["Domenica"] = "Lungo trail"; runDaysCopy.splice(runDaysCopy.indexOf("Domenica"), 1); }
            }
            
            if (runDaysCopy.length > 0) { runAssignments[runDaysCopy[0]] = "Ripetute collinari"; runDaysCopy.splice(0, 1); }
            runDaysCopy.forEach(day => { runAssignments[day] = "Fondo lento"; });
        }

        const numeroCorseFondo = giorniCorsa.filter(d => runAssignments[d] === "Fondo lento").length || 1;

        for (const day of GIORNI) {
            // Inseriamo forzatamente il giorno di corsa nel weekend se c'è un B2B attivo, anche se non selezionato dall'utente
            const calcolaComeCorsa = giorniCorsa.includes(day) || (infoLungo.b2bKm > 0 && (day === "Sabato" || day === "Domenica"));

            if (isUltimaSettimana && giorniPalestra.includes(day)) {
                settimana.push({day, type:"Riposo", summary:"Riposo pre-gara", details:{detailText:"Niente pesi, focus su mobilità e idratazione.", distance: 0, ascent: 0, durationMin: 0, completed: false, gpxData: null}});
            } else if (giorniPalestra.includes(day) && runAssignments[day] !== "Lungo B2B (Fase 1)") { 
                // Evita sovrapposizioni se la palestra era di sabato e c'è il B2B forzato
                settimana.push({day, type:"Palestra", summary:"🏋️ Palestra", details:{detailText:getDefaultDetails("Palestra"), distance: 0, ascent: 0, durationMin: 45, completed: false, gpxData: null}});
            } else if (runAssignments[day] === "GARA 🎉") {
                const minutiInteri = Math.floor(passoMedioGara);
                const secondiCalcolati = Math.round((passoMedioGara - minutiInteri) * 60);
                const secondiFormattati = String(secondiCalcolati).padStart(2, '0');
                
                const det = { 
                    distance: obbKm, 
                    ascent: obbAsc, 
                    durationMin: Math.round(tempoMinutiGara), 
                    detailText: "🏁 Giorno dell'obiettivo! Gestisci il ritmo stimato a " + minutiInteri + ":" + secondiFormattati + "/km.", 
                    completed: false, 
                    gpxData: null 
                };
                totalKm += det.distance; totalAsc += det.ascent;
                settimana.push({day, type:"GARA 🎉", summary:`🏁 TARGET GARA — ${det.distance} km`, details:det});
            } else if (calcolaComeCorsa && runAssignments[day]) {
                const type = runAssignments[day];
                let det;

                if (type === "Lungo trail") {
                    det = {
                        distance: infoLungo.kmLungo,
                        ascent: Math.round(obbAsc * (infoLungo.kmLungo / obbKm)),
                        durationMin: infoLungo.tempoLungo,
                        detailText: `Lungo specifico a sensazione. Target: correre le discese e camminare forte le salite.`,
                        completed: false, gpxData: null
                    };
                } else if (type === "Lungo trail (Fase 2)") {
                    det = {
                        distance: infoLungo.kmLungo,
                        ascent: Math.round(obbAsc * (infoLungo.kmLungo / obbKm)),
                        durationMin: infoLungo.tempoLungo,
                        detailText: `Seconda parte del Lungo Combinato (Back-to-Back). Corri su gambe stanche, ottimo per simulare il finale della Ultra.`,
                        completed: false, gpxData: null
                    };
                } else if (type === "Lungo B2B (Fase 1)") {
                    det = {
                        distance: infoLungo.b2bKm,
                        ascent: Math.round(obbAsc * (infoLungo.b2bKm / obbKm)),
                        durationMin: infoLungo.b2bTempo,
                        detailText: `Prima parte del Lungo Combinato (Back-to-Back). Gestisci il ritmo senza esagerare, domani si replica.`,
                        completed: false, gpxData: null
                    };
                } else if (type === "Ripetute collinari") {
                    const kmQualita = +(kmSupportoTotale * 0.4).toFixed(1);
                    det = {
                        distance: kmQualita,
                        ascent: Math.round(ascesaSupportoTotale * 0.6),
                        durationMin: Math.round(kmQualita * paceByLevel(livello)),
                        detailText: `Riscaldamento + Ripetute in salita costanti + Defaticamento.`,
                        completed: false, gpxData: null
                    };
                } else {
                    const kmFondo = +(kmSupportoTotale * 0.6 / numeroCorseFondo).toFixed(1);
                    det = {
                        distance: kmFondo,
                        ascent: Math.round(ascesaSupportoTotale * 0.4 / numeroCorseFondo),
                        durationMin: Math.round(kmFondo * paceByLevel(livello)),
                        detailText: `Corsa rigenerante di supporto per fare volume articolare.`,
                        completed: false, gpxData: null
                    };
                }

                totalKm += det.distance; totalAsc += det.ascent;
                settimana.push({day, type, summary:`🏃 ${type} — ${det.distance} km`, details:det});
            } else {
                settimana.push({day, type:"Riposo", summary:"Riposo", details:{detailText:getDefaultDetails("Riposo"), distance: 0, ascent: 0, durationMin: 0, completed: false, gpxData: null}});
            }
        }

        const oreVisualizzate = Math.floor(infoLungo.tempoLungo / 60);
        const minutiVisualizzati = infoLungo.tempoLungo % 60;
        let stringaFocus = infoLungo.focus + " | Dom: " + infoLungo.kmLungo + "km (~" + oreVisualizzate + "h" + minutiVisualizzati + "m)";
        if (infoLungo.b2bKm > 0) {
            stringaFocus += " + Sab: " + infoLungo.b2bKm + "km (~" + Math.floor(infoLungo.b2bTempo/60) + "h" + (infoLungo.b2bTempo%60) + "m)";
        }

        plan.push({
            settimana: w,
            startDate: `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`,
            targetKm: +totalKm.toFixed(1), targetAsc: Math.round(totalAsc),
            allenamenti: settimana,
            isScarico: infoLungo.focus.includes("scarico") || infoLungo.focus.includes("Tapering"),
            focus: stringaFocus
        });
    }

    return plan;
}
