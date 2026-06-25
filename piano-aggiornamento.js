// piano-aggiornamento.js - Analisi dello storico e rimodulazione basata sulla progressione del Lungo

/**
 * Analizza il piano attuale e calcola il volume reale completato rispetto al teorico.
 */
export function analizzaStatoPiano(pianoAttuale) {
    if (!pianoAttuale || pianoAttuale.length === 0) return null;

    let kmTotaliTeoriciPassati = 0;
    let kmTotaliRealiPassati = 0;
    let metriAscesaTeoriciPassati = 0;
    let metriAscesaRealiPassati = 0;
    let minutiTotaliRealiPassati = 0;
    
    let allenamentiCompletatiConteggio = 0;
    let allenamentiSaltatiConteggio = 0;

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const settimane = Array.isArray(pianoAttuale) ? pianoAttuale : (pianoAttuale.settimane || []);

    settimane.forEach(settimana => {
        const dataSettimana = new Date(settimana.startDate);
        let haAllenamentiCompletati = settimana.allenamenti.some(a => (a.completed || (a.details && a.details.completed)));
        
        if (dataSettimana < oggi || haAllenamentiCompletati) {
            settimana.allenamenti.forEach(all => {
                const tipoAttivita = all.type || all.tipo || "";
                if (tipoAttivita === "Riposo" || tipoAttivita === "Palestra") return;

                const det = all.details || {};
                const kmPianificati = det.distance || all.km || 0;
                const ascesaPianificata = det.ascent || all.asc || 0;

                kmTotaliTeoriciPassati += kmPianificati;
                metriAscesaTeoriciPassati += ascesaPianificata;

                const isCompleted = all.completed || det.completed;

                if (isCompleted) {
                    allenamentiCompletatiConteggio++;
                    const gpx = det.gpxData || all.gpxData;
                    
                    const kmEffettivi = gpx ? gpx.distanceKm : kmPianificati;
                    const ascesaEffettiva = gpx ? gpx.ascentMeters : ascesaPianificata;
                    const minutiEffettivi = gpx ? (gpx.durationMin || det.durationMin || all.durationMin || 0) : (det.durationMin || all.durationMin || 0);

                    kmTotaliRealiPassati += kmEffettivi;
                    metriAscesaRealiPassati += ascesaEffettiva;
                    minutiTotaliRealiPassati += minutiEffettivi;
                } else if (dataSettimana < oggi) {
                    allenamentiSaltatiConteggio++;
                }
            });
        }
    });

    let deltaPercentualeKm = 0;
    if (kmTotaliTeoriciPassati > 0) {
        deltaPercentualeKm = ((kmTotaliRealiPassati - kmTotaliTeoriciPassati) / kmTotaliTeoriciPassati) * 100;
    }

    return {
        kmTeorici: +kmTotaliTeoriciPassati.toFixed(1),
        kmReali: +kmTotaliRealiPassati.toFixed(1),
        ascesaTeorica: metriAscesaTeoriciPassati,
        ascesaReale: metriAscesaRealiPassati,
        minutiTotaliReali: minutiTotaliRealiPassati,
        completati: allenamentiCompletatiConteggio,
        saltati: allenamentiSaltatiConteggio,
        scostamentoKmPercentuale: +deltaPercentualeKm.toFixed(1)
    };
}

/**
 * Ricalcolo Matematico Locale basato sulla Progressione Biologica del Lungo
 */
export function eseguiRimodulazioneMatematicaLocale(tipoPiano, report, nuoveImpostazioni, STATE, funzioniCallback) {
    console.log("Avvio ricalcolo locale basato sulla progressione del lungo...", report, nuoveImpostazioni);

    const { saveState, mostraCardPiano, renderPianoAI, renderPianoLocale, avviaCaricamentoGPX, apriModaleModifica } = funzioniCallback;

    try {
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);

        // 1. Isoliamo lo storico dal futuro basandoci sulla struttura flessibile dello stato
        const settimaneAttuali = STATE.planDataAI?.settimane || STATE.planData || [];

        const settimanePassate = settimaneAttuali.filter(w => {
            const dataSettimana = new Date(w.startDate);
            const haCompletati = w.allenamenti.some(a => a.completed || (a.details && a.details.completed));
            return dataSettimana < oggi || haCompletati;
        });

        const settimaneFuture = settimaneAttuali.filter(w => !settimanePassate.includes(w));

        if (settimaneFuture.length === 0) {
            alert("Non ci sono settimane future rimaste da rimodulare!");
            return;
        }

        // 2. Troviamo l'ultimo lungo reale eseguito nel passato per agganciare la curva
        let ultimoLungoReale = 16; 
        let ultimoDplusReale = 700;

        for (let i = settimanePassate.length - 1; i >= 0; i--) {
            const lungoDomenica = settimanePassate[i].allenamenti.find(a => {
                const t = (a.type || a.tipo || "").toLowerCase();
                return t.includes("lungo");
            });
            if (lungoLungoDomenica) {
                const det = lungoDomenica.details || {};
                const gpx = det.gpxData || lungoDomenica.gpxData;
                ultimoLungoReale = gpx ? gpx.distanceKm : (det.distance || lungoDomenica.km || 16);
                ultimoDplusReale = gpx ? gpx.ascentMeters : (det.ascent || lungoDomenica.asc || 700);
                break;
            }
        }

        // 3. Definiamo i vincoli della progressione prendendo i valori corretti dall'HTML
        const kmGara = parseFloat(nuoveImpostazioni.obbKm) || 54;
        const dplusGara = parseFloat(nuoveImpostazioni.dislivelloGara) || parseFloat(nuoveImpostazioni.obbAsc) || 4000;
        
        const lungoPiccoTarget = Math.round(kmGara * 0.70); 
        const dplusPiccoTarget = Math.round(lungoPiccoTarget * (dplusGara / kmGara)); 

        const fattoreCrescitaKm = 1.10; 
        const fattoreCrescitaDplus = 1.12; 

        let kmCorrentiLungo = ultimoLungoReale;
        let dplusCorrenteLungo = ultimoDplusReale;

        // Recuperiamo il passo del test sui 10km (es. 5.8 per 5:48/km)
        const passo10k = parseFloat(nuoveImpostazioni.passoBasePianura) || 5.8;

        // 4. Ricalcoliamo la griglia dei Lunghi Futuri
        const settimaneFutureRicalcolate = settimaneFuture.map((settimana, indice) => {
            const nuovaSettimana = JSON.parse(JSON.stringify(settimana));
            
            const isScaricoFisso = nuovaSettimana.details?.isScarico || (indice % 4 === 3);
            const isTaperingFinale = (settimaneFuture.length - indice) <= 2; 

            if (isScaricoFisso && !isTaperingFinale) {
                kmCorrentiLungo = Math.round((kmCorrentiLungo * 0.8) * 10) / 10;
                dplusCorrenteLungo = Math.round(dplusCorrenteLungo * 0.8);
            } else if (!isTaperingFinale) {
                kmCorrentiLungo = Math.min(lungoPiccoTarget, Math.round((kmCorrentiLungo * fattoreCrescitaKm) * 10) / 10);
                dplusCorrenteLungo = Math.min(dplusPiccoTarget, Math.round(dplusCorrenteLungo * fattoreCrescitaDplus));
            } else {
                const settimaneMancantiAllaGara = settimaneFuture.length - indice; 
                if (settimaneMancantiAllaGara === 2) {
                    kmCorrentiLungo = Math.round(lungoPiccoTarget * 0.7); 
                    dplusCorrenteLungo = Math.round(dplusPiccoTarget * 0.6);
                } else {
                    kmCorrentiLungo = Math.round(lungoPiccoTarget * 0.4); 
                    dplusCorrenteLungo = Math.round(dplusPiccoTarget * 0.3);
                }
            }

            let totaleKmSettimanale = 0;
            let totaleDplusSettimanale = 0;

            // 5. Applichiamo la cascata percentuale infrasettimanale mettendo in sicurezza gli oggetti
            nuovaSettimana.allenamenti = nuovaSettimana.allenamenti.map(all => {
                if (!all.details) all.details = {};
                
                const isCompleted = all.completed || all.details.completed;
                if (isCompleted) {
                    totaleKmSettimanale += all.details.distance || all.km || 0;
                    totaleDplusSettimanale += all.details.ascent || all.asc || 0;
                    return all; 
                }

                const tagTipo = (all.type || all.tipo || "").toLowerCase();
                let passoSpecificoPianura = passo10k; // Di default ritmo soglia 10k

                if (tagTipo.includes("lungo")) {
                    all.details.distance = kmCorrentiLungo;
                    all.details.ascent = dplusCorrenteLungo;
                    passoSpecificoPianura = passo10k * 1.15; // Z2 aerobica: +15% rispetto ai 10k
                } else if (tagTipo.includes("ripetute") || tagTipo.includes("qualità") || tagTipo.includes("qualita")) {
                    all.details.distance = Math.round((kmCorrentiLungo * 0.4) * 10) / 10;
                    all.details.ascent = Math.round(dplusCorrenteLungo * 0.3);
                    passoSpecificoPianura = passo10k; // Ritmo 10k (Soglia)
                } else if (tagTipo.includes("lento")) {
                    all.details.distance = Math.round((kmCorrentiLungo * 0.5) * 10) / 10;
                    all.details.ascent = Math.round(dplusCorrenteLungo * 0.4);
                    passoSpecificoPianura = passo10k * 1.15; // Z2 Fondo Lento: +15% rispetto ai 10k
                }

                if (all.km !== undefined) all.km = all.details.distance;
                if (all.asc !== undefined) all.asc = all.details.ascent;

                // Calcolo durata compensando il dislivello con la regola di Naismith
                const tipoPuro = all.type || all.tipo || "";
                if (tipoPuro !== "Riposo" && tipoPuro !== "Palestra") {
                    const kmEquivalenti = all.details.distance + (all.details.ascent / 100);
                    all.details.durationMin = Math.round(kmEquivalenti * passoSpecificoPianura);
                    if (all.durationMin !== undefined) all.durationMin = all.details.durationMin;
                    
                    totaleKmSettimanale += all.details.distance;
                    totaleDplusSettimanale += all.details.ascent;
                }

                // Sincronizziamo i testi delle descrizioni grafiche nelle card
                const kmRiferimento = all.details.distance || all.km || 0;
                const ascRiferimento = all.details.ascent || all.asc || 0;

                if (all.summary) all.summary = all.summary.replace(/(\d+(\.\d+)?)\s*km/gi, `${kmRiferimento} km`);
                if (all.dettagli) all.dettagli = all.dettagli.replace(/(\d+(\.\d+)?)\s*km/gi, `${kmRiferimento} km`).replace(/\+(\d+)\s*m/gi, `+${ascRiferimento} m`);
                if (all.details.detailText) all.details.detailText = all.details.detailText.replace(/(\d+(\.\d+)?)\s*km/gi, `${kmRiferimento} km`).replace(/\+(\d+)\s*m/gi, `+${ascRiferimento} m`);

                return all;
            });

            // Ricalcolo dei riassunti di riga delle card
            if (nuovaSettimana.details) {
                nuovaSettimana.details.totaleKm = Math.round(totaleKmSettimanale * 10) / 10;
                nuovaSettimana.details.totaleDplus = totaleDplusSettimanale;
            }
            nuovaSettimana.totaleKm = Math.round(totaleKmSettimanale * 10) / 10;
            nuovaSettimana.totaleDplus = totaleDplusSettimanale;

            return nuovaSettimana;
        });

        // 6. Consolidamento finale del piano nello stato corretto
        const pianoConsolidatoLocale = {
            descrizione_generale: `Piano ricalcolato localmente (Progressione Lunghi) il ${new Date().toLocaleDateString('it-IT')}. Target: ${kmGara}km.`,
            settimane: [...settimanePassate, ...settimaneFutureRicalcolate]
        };

        // 7. Aggiornamento e Rendering grafico forzato
        if (STATE.planDataAI) {
            STATE.planDataAI = pianoConsolidatoLocale;
            mostraCardPiano('ai');
            renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
        } else {
            STATE.planData = pianoConsolidatoLocale.settimane;
            mostraCardPiano('local');
            renderPianoLocale(STATE.planData, avviaCaricamentoGPX, apriModaleModifica);
        }

        saveState();
        alert(`🎯 Ricalcolo basato sulla progressione dei Lunghi completato! Le settimane future sono state riadattate partendo dai tuoi 16 km reali.`);

    } catch (error) {
        console.error("Errore nel ricalcolo locale dei lunghi:", error);
        alert("Impossibile completare il ricalcolo basato sui lunghi: " + error.message);
    }
}
