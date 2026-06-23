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

    pianoAttuale.forEach(settimana => {
        const dataSettimana = new Date(settimana.startDate);
        let haAllenamentiCompletati = settimana.allenamenti.some(a => a.details && a.details.completed);
        
        if (dataSettimana < oggi || haAllenamentiCompletati) {
            settimana.allenamenti.forEach(all => {
                const det = all.details;
                if (!det) return;

                const kmPianificati = det.distance || 0;
                const ascesaPianificata = det.ascent || 0;

                if (all.type !== "Riposo" && all.type !== "Palestra") {
                    kmTotaliTeoriciPassati += kmPianificati;
                    metriAscesaTeoriciPassati += ascesaPianificata;

                    if (det.completed) {
                        allenamentiCompletatiConteggio++;
                        
                        const kmEffettivi = det.gpxData ? det.gpxData.distanceKm : kmPianificati;
                        const ascesaEffettiva = det.gpxData ? det.gpxData.ascentMeters : ascesaPianificata;
                        const minutiEffettivi = det.gpxData ? (det.gpxData.durationMin || det.durationMin || 0) : (det.durationMin || 0);

                        kmTotaliRealiPassati += kmEffettivi;
                        metriAscesaRealiPassati += ascesaEffettiva;
                        minutiTotaliRealiPassati += minutiEffettivi;
                    } else if (dataSettimana < oggi) {
                        allenamentiSaltatiConteggio++;
                    }
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

        // 1. Isoliamo lo storico dal futuro
        const settimaneAttuali = STATE.planDataAI?.settimane || STATE.planData || [];

        const settimanePassate = settimaneAttuali.filter(w => {
            const dataSettimana = new Date(w.startDate);
            const haCompletati = w.allenamenti.some(a => a.details && a.details.completed);
            return dataSettimana < oggi || haCompletati;
        });

        const settimaneFuture = settimaneAttuali.filter(w => !settimanePassate.includes(w));

        if (settimaneFuture.length === 0) {
            alert("Non ci sono settimane future rimaste da rimodulare!");
            return;
        }

        // 2. Troviamo l'ultimo lungo reale eseguito nel passato per agganciare la curva
        let ultimoLungoReale = 14; // Default minimo di sicurezza
        let ultimoDplusReale = 600;

        // Scansioniamo all'indietro lo storico per trovare l'ultimo lungo fatto (o pianificato se manca il GPX)
        for (let i = settimanePassate.length - 1; i >= 0; i--) {
            const lungoDomenica = settimanePassate[i].allenamenti.find(a => a.type === "Lungo" || a.tipo?.toLowerCase().includes("lungo"));
            if (lungoLungoDomenica && lungoDomenica.details?.completed) {
                ultimoLungoReale = lungoDomenica.details.gpxData ? lungoDomenica.details.gpxData.distanceKm : (lungoLungoDomenica.details.distance || 16);
                ultimoDplusReale = lungoDomenica.details.gpxData ? lungoDomenica.details.gpxData.ascentMeters : (lungoLungoDomenica.details.ascent || 700);
                break;
            }
        }

        // 3. Definiamo i vincoli della progressione (Target di picco basati sulla gara dello schermo)
        const kmGara = parseFloat(nuoveImpostazioni.obbKm) || 42;
        const dplusGara = parseFloat(nuoveImpostazioni.dislivelloGara) || 2000; // Se presente a schermo, altrimenti stimato
        
        const lungoPiccoTarget = Math.round(kmGara * 0.70); // Il picco ideale è il 70% della gara
        const dplusPiccoTarget = Math.round(lungoPiccoTarget * (dplusGara / kmGara)); // Dislivello proporzionale

        // Impostiamo il tasso di crescita settimanale ottimale (es. +10%), bloccato al max al 12%
        const fattoreCrescitaKm = 1.10; 
        const fattoreCrescitaDplus = 1.12; 

        let kmCorrentiLungo = ultimoLungoReale;
        let dplusCorrenteLungo = ultimoDplusReale;

        // 4. Ricalcoliamo la griglia dei Lunghi Futuri
        const settimaneFutureRicalcolate = settimaneFuture.map((settimana, indice) => {
            const nuovaSettimana = JSON.parse(JSON.stringify(settimana));
            
            // Verifichiamo se è una settimana di scarico (es. ogni 4 settimane o le ultime 2 prima della gara)
            // Usiamo l'indice o i metadati esistenti per capire se era concepita come scarico
            const isScaricoFisso = nuovaSettimana.details?.isScarico || (indice % 4 === 3);
            const isTaperingFinale = (settimaneFuture.length - indice) <= 2; // Le ultime due prima della gara

            if (isScaricoFisso && !isTaperingFinale) {
                // Settimana di scarico relativo: -20% rispetto al livello corrente raggiunto
                kmCorrentiLungo = Math.round((kmCorrentiLungo * 0.8) * 10) / 10;
                dplusCorrenteLungo = Math.round(dplusCorrenteLungo * 0.8);
            } else if (!isTaperingFinale) {
                // Settimana di carico: incrementiamo l'ultimo valore, senza superare il picco massimo target
                kmCorrentiLungo = Math.min(lungoPiccoTarget, Math.round((kmCorrentiLungo * fattoreCrescitaKm) * 10) / 10);
                dplusCorrenteLungo = Math.min(dplusPiccoTarget, Math.round(dplusCorrenteLungo * fattoreCrescitaDplus));
            } else {
                // Tapering pre-gara (ultime 2 settimane): calo drastico programmato
                const settimaneMancantiAllaGara = settimaneFuture.length - indice; 
                if (settimaneMancantiAllaGara === 2) {
                    kmCorrentiLungo = Math.round(lungoPiccoTarget * 0.7); // 70% del picco
                    dplusCorrenteLungo = Math.round(dplusPiccoTarget * 0.6);
                } else {
                    kmCorrentiLungo = Math.round(lungoPiccoTarget * 0.4); // 40% del picco (rifinitura)
                    dplusCorrenteLungo = Math.round(dplusPiccoTarget * 0.3);
                }
            }

            let totaleKmSettimanale = 0;
            let totaleDplusSettimanale = 0;

            // 5. Applichiamo la cascata percentuale infrasettimanale basandoci sul Lungo appena calcolato
            nuovaSettimana.allenamenti = nuovaSettimana.allenamenti.map(all => {
                if (!all.details) return all;
                if (all.details.completed) return all; // Preserva sessioni future già marcate completate per errore

                if (all.type === "Lungo" || all.tipo?.toLowerCase().includes("lungo")) {
                    all.details.distance = kmCorrentiLungo;
                    all.details.ascent = dplusCorrenteLungo;
                } else if (all.type === "Ripetute" || all.type === "Qualità" || all.type?.toLowerCase().includes("ripetute")) {
                    // La qualità infrasettimanale è rigida al 40% del lungo della stessa settimana
                    all.details.distance = Math.round((kmCorrentiLungo * 0.4) * 10) / 10;
                    all.details.ascent = Math.round(dplusCorrenteLungo * 0.3); // Meno dislivello per fare velocità
                } else if (all.type === "Lento" || all.type?.toLowerCase().includes("lento")) {
                    // Il lento rigenerante è rigido al 50% del lungo
                    all.details.distance = Math.round((kmCorrentiLungo * 0.5) * 10) / 10;
                    all.details.ascent = Math.round(dplusCorrenteLungo * 0.4);
                }

                // Aggiorniamo le stringhe di testo visive nelle card
                if (all.tipo || all.descrizione) {
                    const targetProp = all.tipo ? 'tipo' : 'descrizione';
                    all[targetProp] = all[targetProp].replace(/(\d+(\.\d+)?)\s*km/gi, `${all.details.distance} km`);
                    all[targetProp] = all[targetProp].replace(/\+(\d+)\s*m/gi, `+${all.details.ascent} m`);
                }

                if (all.type !== "Riposo" && all.type !== "Palestra") {
                    totaleKmSettimanale += all.details.distance || 0;
                    totaleDplusSettimanale += all.details.ascent || 0;
                }

                return all;
            });

            // Aggiorniamo i calcoli globali della card settimanale
            if (nuovaSettimana.details) {
                nuovaSettimana.details.totaleKm = Math.round(totaleKmSettimanale * 10) / 10;
                nuovaSettimana.details.totaleDplus = totaleDplusSettimanale;
            } else {
                nuovaSettimana.totaleKm = Math.round(totaleKmSettimanale * 10) / 10;
                nuovaSettimana.totaleDplus = totaleDplusSettimanale;
            }

            return nuovaSettimana;
        });

        // 6. Consolidamento finale del piano
        const pianoConsolidatoLocale = {
            descrizione_generale: `Piano ricalcolato localmente (Progressione Lunghi) il ${new Date().toLocaleDateString('it-IT')}. Target: ${kmGara}km.`,
            settimane: [...settimanePassate, ...settimaneFutureRicalcolate]
        };

        // 7. Aggiornamento dello stato globale e rendering grafico della UI
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
