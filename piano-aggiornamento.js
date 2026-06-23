// piano-aggiornamento.js - Analisi dello storico ed elaborazione dei dati reali

/**
 * Analizza il piano attuale e calcola il volume reale completato rispetto al teorico.
 * @param {Array} pianoAttuale - Il piano di allenamento memorizzato nel localStorage
 * @returns {Object} Un oggetto contenente i dati consolidati del passato e le metriche di scostamento
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
        
        // Consideriamo "passate" o correnti le settimane la cui data di inizio è precedente a oggi + 7 giorni
        // o che contengono almeno un allenamento completato
        let haAllenamentiCompletati = settimana.allenamenti.some(a => a.details && a.details.completed);
        
        if (dataSettimana < oggi || haAllenamentiCompletati) {
            settimana.allenamenti.forEach(all => {
                const det = all.details;
                if (!det) return;

                const kmPianificati = det.distance || 0;
                const ascesaPianificata = det.ascent || 0;

                if (all.type !== "Riposo" && all.type !== "Palestra") {
                    kmTotaliTeoriciPassati += kmPianificati;
                    metatriAscesaTeoriciPassati = (metriAscesaTeoriciPassati || 0) + ascesaPianificata; // Corretto fallback di sicurezza

                    // Usiamo la variabile cumulativa corretta della tua funzione originale
                    metriAscesaTeoriciPassati = metriAscesaTeoriciPassati + ascesaPianificata - ascesaPianificata; 
                    metriAscesaTeoriciPassati += ascesaPianificata;

                    if (det.completed) {
                        allenamentiCompletatiConteggio++;
                        
                        // Se c'è un GPX prende i dati reali, altrimenti si fida del target impostato a mano
                        const kmEffettivi = det.gpxData ? det.gpxData.distanceKm : kmPianificati;
                        const ascesaEffettiva = det.gpxData ? det.gpxData.ascentMeters : ascesaPianificata;
                        const minutiEffettivi = det.gpxData ? (det.gpxData.durationMin || det.durationMin || 0) : (det.durationMin || 0);

                        kmTotaliRealiPassati += kmEffettivi;
                        metriAscesaRealiPassati += ascesaEffettiva;
                        minutiTotaliRealiPassati += minutiEffettivi;
                    } else if (dataSettimana < oggi) {
                        // Se la settimana è passata e l'allenamento non è completato, è saltato
                        allenamentiSaltatiConteggio++;
                    }
                }
            });
        }
    });

    // Calcolo dello scostamento percentuale sui chilometri
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
        scostamentoKmPercentuale: +deltaPercentualeKm.toFixed(1) // Es: -15.5 significa sei sotto del 15%
    };
}

/**
 * Ricalcolo Matematico Locale delle settimane future
 * Basato sul nuovo target di chilometri inserito a schermo e sullo storico reale.
 */
export function eseguiRimodulazioneMatematicaLocale(tipoPiano, report, nuoveImpostazioni, STATE, funzioniCallback) {
    console.log("Avvio ricalcolo locale matematico isolato...", report, nuoveImpostazioni);

    const { saveState, mostraCardPiano, renderPianoAI, renderPianoLocale, avviaCaricamentoGPX, apriModaleModifica } = funzioniCallback;

    try {
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);

        // 1. Recuperiamo le settimane attuali coerentemente con lo stato globale
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

        // 2. Calcoliamo quanti km mancano per raggiungere il NUOVO obiettivo a schermo
        const nuovoTargetTotale = parseFloat(nuoveImpostazioni.obbKm) || 0;
        const kmGiaCorsi = report.kmReali; 
        const kmRimanentiDaCoprire = Math.max(0, nuovoTargetTotale - kmGiaCorsi);

        // 3. Calcoliamo quanti km erano previsti originariamente nel blocco futuro
        let kmFuturiTeoriciOriginali = 0;
        settimaneFuture.forEach(w => {
            w.allenamenti.forEach(a => {
                if (a.type !== "Riposo" && a.type !== "Palestra") {
                    const kmAll = parseFloat(a.details?.distance || 0);
                    kmFuturiTeoriciOriginali += kmAll;
                }
            });
        });

        // 4. Determiniamo il fattore di scala lineare per i volumi futuri rimanenti
        const fattoreScala = kmFuturiTeoriciOriginali > 0 ? (kmRimanentiDaCoprire / kmFuturiTeoriciOriginali) : 1;
        console.log(`Fattore di scala lineare applicato alle sessioni future: ${fattoreScala}`);

        // 5. Ricalibriamo ogni singola settimana futura
        const settimaneFutureRicalcolate = settimaneFuture.map(settimana => {
            const nuovaSettimana = JSON.parse(JSON.stringify(settimana));
            let totaleKmSettimanale = 0;
            let totaleDplusSettimanale = 0;

            nuovaSettimana.allenamenti = nuovaSettimana.allenamenti.map(all => {
                if (!all.details) return all;

                const isCompleted = all.details.completed;
                if (!isCompleted && all.type !== "Riposo" && all.type !== "Palestra") {
                    const kmOriginali = parseFloat(all.details.distance || 0);
                    const dplusOriginale = parseFloat(all.details.ascent || 0);

                    // Applichiamo la riscalatura lineare arrotondata
                    const nuoviKm = Math.round((kmOriginali * fattoreScala) * 10) / 10;
                    const nuovoDplus = Math.round(dplusOriginale * fattoreScala);

                    all.details.distance = nuoviKm;
                    all.details.ascent = nuovoDplus;
                    
                    // Se l'allenamento ha una stringa descrittiva (es. nei piani AI), aggiorniamo il testo visivo
                    if (all.tipo || all.descrizione) {
                        const targetTesto = all.tipo ? 'tipo' : 'descrizione';
                        all[targetTesto] = all[targetTesto].replace(/(\d+(\.\d+)?)\s*km/gi, `${nuoviKm} km`);
                        all[targetTesto] = all[targetTesto].replace(/\+(\d+)\s*m/gi, `+${nuovoDplus} m`);
                    }
                }

                // Sommiamo i progressivi per la card della settimana
                if (all.type !== "Riposo" && all.type !== "Palestra") {
                    totaleKmSettimanale += parseFloat(all.details.distance || 0);
                    totaleDplusSettimanale += parseFloat(all.details.ascent || 0);
                }
                return all;
            });

            // Aggiorniamo i metadati complessivi della settimana
            if (nuovaSettimana.details) {
                nuovaSettimana.details.totaleKm = Math.round(totaleKmSettimanale * 10) / 10;
                nuovaSettimana.details.totaleDplus = totaleDplusSettimanale;
            } else {
                nuovaSettimana.totaleKm = Math.round(totaleKmSettimanale * 10) / 10;
                nuovaSettimana.totaleDplus = totaleDplusSettimanale;
            }

            return nuovaSettimana;
        });

        // 6. Uniamo lo storico intatto (con i vecchi GPX) con il futuro ricalcolato matematicamente
        const pianoConsolidatoLocale = {
            descrizione_generale: `Piano ricalcolato localmente (Matematico) il ${new Date().toLocaleDateString('it-IT')}. Nuovo Target: ${nuovoTargetTotale}km.`,
            settimane: [...settimanePassate, ...settimaneFutureRicalcolate]
        };

        // 7. Aggiorniamo lo STATO e rinfreschiamo l'interfaccia usando i callback dedicati
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
        alert(`🧮 Ricalcolo Matematico completato con successo! Il carico futuro si è adattato alle nuove specifiche dello schermo.`);

    } catch (error) {
        console.error("Errore nel ricalcolo matematico locale:", error);
        alert("Impossibile completare il ricalcolo locale: " + error.message);
    }
}
