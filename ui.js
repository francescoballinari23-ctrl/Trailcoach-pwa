// ui.js - Gestione della visualizzazione e del rendering grafico DOM

const nomiGiorniBrevi = { "Lunedì": "Lun", "Martedì": "Mar", "Mercoledì": "Mer", "Giovedì": "Gio", "Venerdì": "Ven", "Sabato": "Sab", "Domenica": "Dom" };
const ordineGiorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Funzione di supporto interna per generare il box grafico dei dati reali GPX
function generaHtmlBoxGPX(gpxData) {
    if (!gpxData) return '';
    
    // Calcoliamo ore e minuti reali
    let stringaTempoReale = "--";
    if (gpxData.durationMin) {
        const ore = Math.floor(gpxData.durationMin / 60);
        const minuti = gpxData.durationMin % 60;
        stringaTempoReale = ore > 0 ? `${ore}h ${minuti}m` : `${minuti}m`;
    }

    return `
        <div class="gpx-data" style="background-color: #f1f8e9; border-left: 4px solid #7cb342; padding: 10px; margin-top: 8px; border-radius: 4px; font-size: 12px; text-align: left;">
            <strong style="color: #558b2f; display: block; margin-bottom: 6px;">📊 Rilevato da GPX ✅:</strong>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; color: #333;">
                <div>🏁 <strong>Distanza:</strong> ${gpxData.distanceKm.toFixed(2)} km</div>
                <div>⛰️ <strong>Dislivello:</strong> +${gpxData.ascentMeters} m</div>
                <div>⏱️ <strong>Tempo:</strong> ${stringaTempoReale}</div>
                <div>⚡ <strong>Passo:</strong> ${gpxData.paceStr || '--:--'} /km</div>
            </div>
        </div>
    `;
}

export function renderPianoLocale(planData, descrizioneGenerale, onGpxUpload, onEditClick) {
    const container = document.getElementById("planView");
    if (!planData?.length) { container.textContent = "Nessun piano ancora generato."; return; }

    let html = `<div class="card"><label>Descrizione Generale</label><div class="muted">${descrizioneGenerale || ""}</div></div>`;

    planData.forEach((w, wIdx) => {
        const totalKm = w.allenamenti.reduce((sum, a) => sum + (a.details?.distance || 0), 0).toFixed(1);
        html += `
            <div class="week" data-week="${wIdx}">
                <div class="accordion">📅 Settimana ${w.settimana} (dal ${formatDate(w.startDate)}) — ${w.focus || w.summary} (${totalKm} km)</div>
                <div class="days panel" style="display:none;">
                    ${w.allenamenti.map((a, aIdx) => {
                        const d = a.details;
                        const isRun = a.type !== "Riposo" && a.type !== "Palestra";
                        const statusIcon = d.completed ? '✅' : (a.type === "GARA 🎉" ? '🏁' : (a.type === "Riposo" ? '💤' : '💪'));
                        
                        let dataDisplay = a.day;
                        if (w.startDate) {
                            const offset = ordineGiorni.indexOf(a.day);
                            if (offset !== -1) {
                                const dEsatta = new Date(w.startDate);
                                dEsatta.setDate(dEsatta.getDate() + offset);
                                dataDisplay = `${nomiGiorniBrevi[a.day]} ${dEsatta.getDate()}.${dEsatta.getMonth() + 1}`;
                            }
                        }

                        return `
                            <div class="day">
                                <div class="day-header" data-target="local-${wIdx}-${aIdx}">
                                    <div><span class="day-status">${statusIcon}</span><strong>${dataDisplay}</strong> — ${isRun ? a.type + ' ('+d.distance+' km)' : a.summary}</div>
                                    <div class="muted" style="font-size:11px;">${d?.detailText || ''}</div>
                                </div>
                                <div class="day-details-panel" id="local-${wIdx}-${aIdx}" style="display:none;">
                                    ${isRun ? `<div class="muted" style="margin-bottom:6px;">Obiettivo target: ${d.distance} km • +${d.ascent} m • ${d.durationMin} min</div>` : ''}
                                    
                                    ${d.gpxData ? generaHtmlBoxGPX(d.gpxData) : isRun ? `<button class="gpx-upload-btn btn-gpx-up" data-w="${wIdx}" data-a="${aIdx}">Carica GPX</button>` : ''}
                                    
                                    <button class="gpx-upload-btn btn-edit-act" style="background:#39a3f2; margin-top:6px;" data-w="${wIdx}" data-a="${aIdx}">✏️ Modifica</button>
                                </div>
                            </div>`;
                    }).join("")}
                </div>
            </div>`;
    });

    container.innerHTML = html;
    agganciaEventiDinamici(container, "local", onGpxUpload, onEditClick);
}

export function renderPianoAI(pianoAI, onGpxUpload, onEditClick) {
    const container = document.getElementById("piano-generato");
    if (!pianoAI?.settimane) return;

    let html = `<div class="card"><label>Descrizione Generale</label><div class="muted">${pianoAI.descrizione_generale || ""}</div></div>`;

    pianoAI.settimane.forEach((w, wIdx) => {
        const totalKm = w.allenamenti ? w.allenamenti.reduce((sum, a) => sum + (a.km || 0), 0).toFixed(1) : 0;
        html += `
            <div class="week" data-week="${wIdx}">
                <div class="accordion">📅 Settimana ${w.numero} (dal ${formatDate(w.startDate)}) — ${w.focus || ""} (${totalKm} km)</div>
                <div class="days panel" style="display:none;">
                    ${w.allenamenti.map((a, aIdx) => {
                        const isRun = a.tipo !== "Riposo" && a.tipo !== "Palestra";
                        const statusIcon = a.completed ? '✅' : (a.tipo.includes("GARA") ? '🏁' : (a.tipo === "Riposo" ? '💤' : '💪'));
                        
                        let dataDisplay = a.giorno;
                        if (w.startDate) {
                            const offset = ordineGiorni.indexOf(a.giorno);
                            if (offset !== -1) {
                                const dEsatta = new Date(w.startDate);
                                dEsatta.setDate(dEsatta.getDate() + offset);
                                dataDisplay = `${nomiGiorniBrevi[a.giorno]} ${dEsatta.getDate()}.${dEsatta.getMonth() + 1}`;
                            }
                        }

                        return `
                            <div class="day">
                                <div class="day-header" data-target="ai-${wIdx}-${aIdx}">
                                    <div><span class="day-status">${statusIcon}</span><strong>${dataDisplay} — ${a.tipo}</strong></div>
                                    <div class="muted" style="font-size:11px;">${a.dettagli || ''}</div>
                                </div>
                                <div class="day-details-panel" id="ai-${wIdx}-${aIdx}" style="display:none;">
                                    ${isRun ? `<div class="muted" style="margin-bottom:6px;">Obiettivo target: ${a.km} km • +${a.asc || 0} m • ${a.durationMin || 60} min</div>` : ''}
                                    
                                    ${a.gpxData ? generaHtmlBoxGPX(a.gpxData) : isRun ? `<button class="gpx-upload-btn btn-gpx-up" data-w="${wIdx}" data-a="${aIdx}">Carica GPX</button>` : ''}
                                    
                                    <button class="gpx-upload-btn btn-edit-act" style="background:#39a3f2; margin-top:6px;" data-w="${wIdx}" data-a="${aIdx}">✏️ Modifica</button>
                                </div>
                            </div>`;
                    }).join("")}
                </div>
            </div>`;
    });

    container.innerHTML = html;
    agganciaEventiDinamici(container, "ai", onGpxUpload, onEditClick);
}

function agganciaEventiDinamici(container, tipoPiano, onGpxUpload, onEditClick) {
    // Accordion Settimane
    container.querySelectorAll(".accordion").forEach(acc => {
        acc.onclick = function() {
            this.classList.toggle("active");
            const panel = this.nextElementSibling;
            panel.style.display = panel.style.display === "block" ? "none" : "block";
        };
    });

    // Sub-panel Giorni
    container.querySelectorAll(".day-header").forEach(head => {
        head.onclick = function() {
            const idTarget = this.getAttribute("data-target");
            const panel = document.getElementById(idTarget);
            if (panel) panel.style.display = panel.style.display === "block" ? "none" : "block";
        };
    });

    // Bottoni interni Carica GPX e Modifica Dettagli
    container.querySelectorAll(".btn-gpx-up").forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            onGpxUpload(tipoPiano, parseInt(btn.dataset.w), parseInt(btn.dataset.a));
        };
    });

    container.querySelectorAll(".btn-edit-act").forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            onEditClick(tipoPiano, parseInt(btn.dataset.w), parseInt(btn.dataset.a));
        };
    });
}
