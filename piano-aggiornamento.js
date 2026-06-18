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
