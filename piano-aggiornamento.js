
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
        let haAllenamentiCompletati = settimana.allenamenti && settimana.allenamenti.some(a => (a.completed || (a.details && a.details.completed)));
        
        if ((dataSettimana < oggi || haAllenamentiCompletati) && settimana.allenamenti) {
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

        const settimaneAttuali = STATE.planDataAI?.settimane || STATE.planData || [];

        const settimanePassate = settimaneAttuali.filter(w => {
            const dataSettimana = new Date(w.startDate);
            const haCompletati = w.allenamenti && w.allenamenti.some(a => a.completed || (a.details && a.details.completed));
            return dataSettimana < oggi || haCompletati;
        });

        const settimaneFuture = settimaneAttuali.filter(w => !passateInclude(w, settimanePassate));

        function passateInclude(settimana, listaPassate) {
            return listaPassate.some(p => p.startDate === settimana.startDate);
        }

        if (settimaneFuture.length === 0) {
            alert("Non ci sono settimane future rimaste da rimodulare!");
            return;
        }

        let ultimoLungoReale = 16; 
        let ultimoDplusReale = 700;

        for (let i = settimanePassate.length - 1; i >= 0; i--) {
            if (!settimanePassate[i].allenamenti) continue;
            const lungoDomenica = settimanePassate[i].allenamenti.find(a => {
                const t = (a.type || a.tipo || "").toLowerCase();
                return t.includes("lungo");
            });
            // ✅ CORRETTO: Risolto il refuso 'lungoLungoDomenica' che mandava in crash iOS
            if (lungoDomenica) {
                const det = lungoDomenica.details || {};
                const gpx = det.gpxData || lungoDomenica.gpxData;
                ultimoLungoReale = gpx ? gpx.distanceKm : (det.distance || lungoDomenica.km || 16);
                ultimoDplusReale = gpx ? gpx.ascentMeters : (det.ascent || lungoDomenica.asc || 700);
                break;
            }
        }

        const kmGara = parseFloat(nuoveImpostazioni.obbKm) || 54;
        const dplusGara = parseFloat(nuoveImpostazioni.dislivelloGara) || parseFloat(nuoveImpostazioni.obbAsc) || 4000;
        
        const lungoPiccoTarget = Math.round(kmGara * 0.70); 
        const dplusPiccoTarget = Math.round(lungoPiccoTarget * (dplusGara / kmGara)); 

        const fattoreCrescitaKm = 1.10; 
        const fattoreCrescitaDplus = 1.12; 

        let kmCorrentiLungo = ultimoLungoReale;
        let dplusCorrenteLungo = ultimoDplusReale;

        const passo10k = parseFloat(nuoveImpostazioni.passoBasePianura) || 5.8;

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

            if (nuovaSettimana.allenamenti) {
                nuovaSettimana.allenamenti = nuovaSettimana.allenamenti.map(all => {
                    if (!all.details) all.details = {};
                    
                    const isCompleted = all.completed || all.details.completed;
                    if (isCompleted) {
                        totaleKmSettimanale += all.details.distance || all.km || 0;
                        totaleDplusSettimanale += all.details.ascent || all.asc || 0;
                        return all; 
                    }

                    const tagTipo = (all.type || all.tipo || "").toLowerCase();
                    const dicituraDettagli = (all.dettagli || all.summary || "").toLowerCase();
                    
                    const isCorsa = tagTipo.includes("corsa") || tagTipo.includes("lungo") || tagTipo.includes("lento") || tagTipo.includes("ripetute") || tagTipo.includes("qualit");
                    const isPalestraORiposo = tagTipo.includes("palestra") || tagTipo.includes("riposo");

                    if (isCorsa && !isPalestraORiposo) {
                        let passoSpecificoPianura = passo10k;
                        let skipNaismithDovutoATempoFisso = false;

                        const formattaPassoLocal = (passoDecimale) => {
                            const m = Math.floor(passoDecimale);
                            const s = Math.round((passoDecimale - m) * 60).toString().padStart(2, '0');
                            return `${m}:${s}`;
                        };

                        if (tagTipo.includes("lungo") || dicituraDettagli.includes("lungo")) {
                            all.details.distance = kmCorrentiLungo;
                            all.details.ascent = dplusCorrenteLungo;
                            passoSpecificoPianura = passo10k * 1.15;
                            
                        } else if (tagTipo.includes("ripetute") || tagTipo.includes("qualit") || dicituraDettagli.includes("ripetute") || dicituraDettagli.includes("qualit")) {
                            skipNaismithDovutoATempoFisso = true;
                            
                            const numeroSettimanaConfig = indice + 1; 
                            const isSettimanaDispari = (numeroSettimanaConfig % 2 !== 0);
                            
                            let descrizioneRipetute = "";
                            let quanteRipetute = 0;

                            if (isSettimanaDispari) {
                                quanteRipetute = 8;
                                if (numeroSettimanaConfig > 3) quanteRipetute = 10;
                                if (numeroSettimanaConfig > 7) quanteRipetute = 12;
                                
                                const passoBreve = passo10k * 0.90;
                                descrizioneRipetute = `Riscl. 15' + ${quanteRipetute}x 1'15" @${formattaPassoLocal(passoBreve)}/km (Rec. 1'30" da fermo) + Defat.`;
                                
                                const kmFrazioni = (quanteRipetute * 1.25) / (passoBreve || 5);
                                all.details.distance = Math.round((3 + kmFrazioni) * 10) / 10; 
                                all.details.durationMin = Math.round(15 + (quanteRipetute * 1.25) + ((quanteRipetute - 1) * 1.5) + 5);
                            } else {
                                quanteRipetute = 2; 
                                if (numeroSettimanaConfig > 4) quanteRipetute = 4;
                                if (numeroSettimanaConfig > 8) quanteRipetute = 5;
                                
                                const passoLungo = passo10k;
                                descrizioneRipetute = `Riscl. 15' + ${quanteRipetute}x 5' @${formattaPassoLocal(passoLungo)}/km (Rec. 2'30" Corsa Lenta) + Defat.`;
                                
                                const kmFrazioni = (quanteRipetute * 5) / (passoLungo || 5);
                                const kmRecuperi = ((quanteRipetute - 1) * 2.5) / (passo10k * 1.15); 
                                all.details.distance = Math.round((3 + kmFrazioni + kmRecuperi) * 10) / 10;
                                all.details.durationMin = Math.round(15 + (quanteRipetute * 5) + ((quanteRipetute - 1) * 2.5) + 5);
                            }

                            all.details.ascent = Math.round(dplusCorrenteLungo * 0.12);
                            all.summary = `🏃 Ripetute: ${descrizioneRipetute}`;

                        } else if (tagTipo.includes("lento") || dicituraDettagli.includes("lento") || dicituraDettagli.includes("fondo")) {
                            all.details.distance = Math.round((kmCorrentiLungo * 0.5) * 10) / 10;
                            all.details.ascent = Math.round(dplusCorrenteLungo * 0.4);
                            passoSpecificoPianura = passo10k * 1.15;
                        }

                        if (all.km !== undefined) all.km = all.details.distance;
                        if (all.asc !== undefined) all.asc = all.details.ascent;

                        if (!skipNaismithDovutoATempoFisso) {
                            const kmEquivalenti = (all.details.distance || 0) + ((all.details.ascent || 0) / 100);
                            all.details.durationMin = Math.round(kmEquivalenti * passoSpecificoPianura);
                        }
                        if (all.durationMin !== undefined) all.durationMin = all.details.durationMin;

                        totaleKmSettimanale += (all.details.distance || 0);
                        totaleDplusSettimanale += (all.details.ascent || 0);

                        const kmRiferimento = all.details.distance || 0;
                        const ascRiferimento = all.details.ascent || 0;
                        const tempoStimatoh = Math.floor((all.details.durationMin || 0) / 60);
                        const tempoStimatom = (all.details.durationMin || 0) % 60;
                        const stringaTempo = tempoStimatoh > 0 ? `${tempoStimatoh}h ${tempoStimatom}m` : `${tempoStimatom} min`;

                        if (!tagTipo.includes("ripetute") && !dicituraDettagli.includes("ripetute")) {
                            all.summary = `${tagTipo.charAt(0).toUpperCase() + tagTipo.slice(1)} di ${kmRiferimento} km`;
                        }
                        
                        all.dettagli = `🏃 Sforzo stimato: ${stringaTempo} | ${kmRiferimento} km | +${ascRiferimento}m D+`;
                        all.details.detailText = `Distanza: ${kmRiferimento} km, Dislivello: +${ascRiferimento} m, Tempo: ${stringaTempo}`;
                    }

                    return all;
                });
            }

            if (!nuovaSettimana.details) nuovaSettimana.details = {};
            nuovaSettimana.details.totaleKm = Math.round(totaleKmSettimanale * 10) / 10;
            nuovaSettimana.details.totaleDplus = totaleDplusSettimanale;
            nuovaSettimana.totaleKm = Math.round(totaleKmSettimanale * 10) / 10;
            nuovaSettimana.totaleDplus = totaleDplusSettimanale;

            return nuovaSettimana;
        });

        const pianoConsolidatoLocale = {
            descrizione_generale: `Piano ricalcolato localmente (Progressione Lunghi) il ${new Date().toLocaleDateString('it-IT')}. Target: ${kmGara}km.`,
            settimane: [...settimanePassate, ...settimaneFutureRicalcolate]
        };

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

/**
 * Esporta il piano corrente in JSON
 */
export function esportaPianoInJSON(STATE) {
    const datiDaSalvare = STATE.planDataAI || STATE.planData;
    
    if (!datiDaSalvare || datiDaSalvare.length === 0) {
        alert("Nessun piano presente da esportare!");
        return;
    }

    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(datiDaSalvare, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `piano_allenamento_trail_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    } catch (err) {
        alert("Errore durante l'esportazione: " + err.message);
    }
}

/**
 * Importa un file JSON precedentemente salvato
 */
export function importaPianoDaJSON(funzioniCallback, STATE) {
    const { saveState, mostraCardPiano, renderPianoAI, renderPianoLocale, avviaCaricamentoGPX, apriModaleModifica } = funzioniCallback;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = lettoreEvent => {
            try {
                const pianoCaricato = JSON.parse(lettoreEvent.target.result);
                let settimane = pianoCaricato.settimane || (Array.isArray(pianoCaricato) ? pianoCaricato : null);
                
                if (!settimane) {
                    throw new Error("Formato del file non riconosciuto. Struttura settimane mancante.");
                }

                settimane = settimane.map(settimana => {
                    if (settimana.allenamenti) {
                        settimana.allenamenti = settimana.allenamenti.map(all => {
                            if (!all.details) all.details = {};
                            
                            const kmRiferimento = all.details.distance || all.km || 0;
                            const ascRiferimento = all.details.ascent || all.asc || 0;

                            if (all.summary) all.summary = all.summary.replace(/(\d+(\.\d+)?)\s*km/gi, `${kmRiferimento} km`);
                            if (all.dettagli) all.dettagli = all.dettagli.replace(/(\d+(\.\d+)?)\s*km/gi, `${kmRiferimento} km`).replace(/\+(\d+)\s*m/gi, `+${ascRiferimento} m`);
                            if (all.details.detailText) all.details.detailText = all.details.detailText.replace(/(\d+(\.\d+)?)\s*km/gi, `${kmRiferimento} km`).replace(/\+(\d+)\s*m/gi, `+${ascRiferimento} m`);
                            
                            return all;
                        });
                    }
                    return settimana;
                });

                const pianoPulito = pianoCaricato.settimane ? { ...pianoCaricato, settimane } : { settimane };

                if (STATE.planDataAI) {
                    STATE.planDataAI = pianoPulito;
                    mostraCardPiano('ai');
                    renderPianoAI(STATE.planDataAI, avviaCaricamentoGPX, apriModaleModifica);
                } else {
                    STATE.planData = settimane;
                    mostraCardPiano('local');
                    renderPianoLocale(STATE.planData, avviaCaricamentoGPX, apriModaleModifica);
                }

                saveState(); 
                alert("🎯 Piano ripristinato e testi sincronizzati con successo!");

            } catch (error) {
                console.error("Errore nell'importazione:", error);
                alert("Errore nel caricamento del file: " + error.message);
            }
        };
        reader.readAsText(file);
    };

    fileInput.click();
}

```
