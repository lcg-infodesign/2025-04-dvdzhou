let volcanoesData;
let volcanoTypesData;
let mapImage;
let volcanoes;
let lastEruptionLegend;

// Variabili per la trasformazione
let transX = 0;
let transY = 0;
let currentScale = 1;
let minScale = 1;
let maxScale = 5;
let isDragging = false;
let hasDragged = false;
let prevMouseX, prevMouseY;

let baseMarkerSize = 7;
let zoomMultiplier = 5;

let currentVisMode = "TypeCategory";
let colorPalette_Category = {};
let colorPalette_Status = {};

let categoryVisibility_Category = {};
let categoryVisibility_Status = {};

let colorElevLow, colorElevHigh;
let minElev, maxElev;

let volcanoTypesInfo = {}; // Lookup table per i tipi
let selectedVolcano = null;
let modalChart = null;
let isMouseOverModal = false;
let closeTimeout = null;
let htmlTooltip;
let currentTypeDescription = "";

function preload() {
    volcanoesData = loadTable("datasets/volcanoes.csv", "csv", "header");
    volcanoTypesData = loadTable("datasets/types.csv", "csv", "header");
    mapImage = loadImage("assets/map.webp");    // https://it.wikipedia.org/wiki/File:World_location_map_%28equirectangular_180%29.svg
}

function setup() {
    let canvasContainer = select("#canvas-container");
    let canvas = createCanvas(canvasContainer.width, canvasContainer.height);
    canvas.parent("canvas-container");

    volcanoes = [];

    colorPalette_Category = {
        Stratovolcano: color(255, 69, 0, 180),
        Cone: color(255, 165, 0, 180),
        "Submarine Volcano": color(0, 100, 255, 180),
        Caldera: color(243, 218, 11, 180),
        "Shield Volcano": color(139, 69, 19, 180),
        "Crater System": color(100, 100, 100, 180),
        "Other / Unknown": color(200, 200, 200, 150),
        "Maars / Tuff ring": color(0, 128, 0, 180),
        Subglacial: color(173, 216, 230, 180),
        Unknown: color(200, 200, 200, 150),
    };

    colorPalette_Status = {
        Historical: color(255, 0, 0, 180),
        Holocene: color(255, 150, 0, 180),
        Radiocarbon: color(243, 218, 11, 180),
        Uncertain: color(150, 150, 150, 180),
        Fumarolic: color(200, 200, 255, 180),
        Hydrophonic: color(0, 100, 255, 180),
        Unknown: color(200, 200, 200, 150)
    };

    // Imposta tutti i tipi di CATEGORIA su "true" (visibile)
    for (let key in colorPalette_Category) {
        categoryVisibility_Category[key] = true;
    }
    // Imposta tutti i tipi di STATO su "true" (visibile)
    for (let key in colorPalette_Status) {
        categoryVisibility_Status[key] = true;
    }
    
    colorElevLow = color(0, 255, 0, 180);
    colorElevHigh = color(255, 0, 0, 180);

    // Lookup per i tipi di vulcano
    for (let i = 0; i < volcanoTypesData.getRowCount(); i++) {
        let typeName = volcanoTypesData.getString(i, "Volcano Type");
        if (typeName) {
            volcanoTypesInfo[typeName] = {
                mainCategory: volcanoTypesData.getString(i, "Main Category"),
                description: volcanoTypesData.getString(i, "Description"),
                wikiLink: volcanoTypesData.getString(i, "Wikipedia Link")
            };
        }
    }

    updateLegend();

    minElev = Infinity;
    maxElev = -Infinity;

    lastEruptionLegend = {
        D1: "Last known eruption 1964 or later",
        D2: "Last known eruption 1900-1963",
        D3: "Last known eruption 1800-1899",
        D4: "Last known eruption 1700-1799",
        D5: "Last known eruption 1500-1699",
        D6: "Last known eruption A.D. 1-1499",
        D7: "Last known eruption B.C. (Holocene)",
        U: "Undated, but probable Holocene eruption",
        Q: "Quaternary eruption(s) with the only known Holocene activity being hydrothermal",
        "?": "Uncertain Holocene eruption"
    }

    for (let i = 0; i < volcanoesData.getRowCount(); i++) {
        let volcano = {};

        // Pulisci e assegna i dati, gestendo valori nulli o vuoti
        volcano.name = volcanoesData.getString(i, "Volcano Name") || "N/A";
        volcano.country = volcanoesData.getString(i, "Country") || "N/A";
        volcano.lat = volcanoesData.getNum(i, "Latitude");
        volcano.lon = volcanoesData.getNum(i, "Longitude");
        volcano.elevation = volcanoesData.get(i, "Elevation (m)") || "N/A";
        volcano.type = volcanoesData.getString(i, "Type") || "N/A";
        volcano.typeCategory = volcanoesData.getString(i, "TypeCategory") || "N/A";
        volcano.status = volcanoesData.getString(i, "Status") || "N/A";
        
        let eruptionCode = volcanoesData.getString(i, "Last Known Eruption");
        volcano.lastEruption = lastEruptionLegend[eruptionCode] || "N/A";

        // Aggiungi info da types.csv
        let typeInfo = volcanoTypesInfo[volcano.type] || {};
        volcano.description = typeInfo.description || "No description available.";
        volcano.wikiLink = typeInfo.wikiLink || "#";

        volcano.x = map(volcano.lon, -180, 180, 0, mapImage.width);
        volcano.y = map(volcano.lat, 90, -90, 0, mapImage.height);
        volcanoes.push(volcano);

        if (!isNaN(volcano.elevation)) {
            let elevNum = parseFloat(volcano.elevation);
            // Calcola min/max solo se è un numero valido
            if (elevNum < minElev) minElev = elevNum;
            if (elevNum > maxElev) maxElev = elevNum;
        }
    }

    currentScale = height / mapImage.height;
    minScale = currentScale;
    maxScale = minScale * zoomMultiplier;

    transX = (width - (mapImage.width * currentScale)) / 2;
    transY = 0;

    constrainTranslation();

    // Tooltip HTML
    htmlTooltip = select("#html-tooltip");

    let typeTrigger = document.getElementById("modal-type");

    typeTrigger.addEventListener("mouseover", (event) => {
        // Mostra il tooltip solo se c'è una descrizione da mostrare
        if (currentTypeDescription) {
            htmlTooltip.html(currentTypeDescription);
            htmlTooltip.removeClass("hidden");
            // Posizionalo
            positionHtmlTooltip(event.clientX, event.clientY);
        }
    });

    typeTrigger.addEventListener("mouseout", () => {
        // Nascondi il tooltip
        htmlTooltip.addClass("hidden");
    });

    typeTrigger.addEventListener("mousemove", (event) => {
        // Aggiorna la posizione mentre il mouse si muove
        positionHtmlTooltip(event.clientX, event.clientY);
    });

    // Lister per il modal
    select("#modal")
        // Blocca i "mousedown" (per mousePressed/mouseDragged)
        .mousePressed((e) => e.stopPropagation())
        // Blocca i "wheel" (per mouseWheel/zoom)
        .mouseWheel((e) => e.stopPropagation())
        // Imposta il flag a VERO quando il mouse entra nel modal
        .mouseOver(() => isMouseOverModal = true)
        // Imposta il flag a FALSO quando il mouse esce
        .mouseOut(() => isMouseOverModal = false);
    select("#modal-close-btn").mousePressed(() => closeModal());

    // Listener per le visualizzazioni
    select("#btn-category").mousePressed(() => {
        currentVisMode = "TypeCategory";
        updateButtonStates();
        updateLegend();
        closeModal();
    });
    select("#btn-status").mousePressed(() => {
        currentVisMode = "Status";
        updateButtonStates();
        updateLegend();
        closeModal();
    });
    select("#btn-elevation").mousePressed(() => {
        currentVisMode = "Elevation";
        updateButtonStates();
        updateLegend();
        closeModal();
    });

    // Listener per All/None della legenda
    let btnAll = select("#legend-all");
    let btnNone = select("#legend-none");

    // Aggiungi i listener ai bottoni "All" e "none"
    btnAll.mousePressed((e) => setAllLegendVisibility(true));
    btnNone.mousePressed((e) => setAllLegendVisibility(false));

    setTimeout(windowResized, 0);
}

function setAllLegendVisibility(isVisible) {
    // Determina quale stato aggiornare in base alla vista corrente
    let targetVisibilityState = null;
    if (currentVisMode === "TypeCategory") {
        targetVisibilityState = categoryVisibility_Category;
    } else if (currentVisMode === "Status") {
        targetVisibilityState = categoryVisibility_Status;
    }

    // Se abbiamo trovato uno stato, modificalo
    if (targetVisibilityState) {
        for (let key in targetVisibilityState) {
            targetVisibilityState[key] = isVisible;
        }
    }

    // Forza un ridisegno della legenda per mostrare i checkbox aggiornati
    updateLegend();

    // Chiudi il modal SOLO SE stiamo nascondendo gli elementi
    if (isVisible === false && selectedVolcano && !isVolcanoVisible(selectedVolcano)) {
        closeModal();
    }
}

function isVolcanoVisible(volcano) {
    if (currentVisMode === "TypeCategory") {
        // Ritorna lo stato di visibilità (es. true/false) O "true" se la categoria non è in lista
        return categoryVisibility_Category[volcano.typeCategory] ?? true;

    } else if (currentVisMode === "Status") {
        return categoryVisibility_Status[volcano.status] ?? true;
    }

    // Se siamo in modalità "Elevation" o altro, è sempre visibile
    return true;
}

function getVolcanoColor(volcano) {
    if (currentVisMode === "TypeCategory") {
        return colorPalette_Category[volcano.typeCategory] || color(200, 200, 200, 150);
    
    } else if (currentVisMode === "Status") {
        return colorPalette_Status[volcano.status] || color(200, 200, 200, 150);
    
    } else if (currentVisMode === "Elevation") {
        if (volcano.elevation === "N/A") return color(200, 200, 200, 150);
        
        if (minElev === maxElev) {
            return colorElevLow;
        }

        let amount = map(volcano.elevation, minElev, maxElev, 0, 1);
        return lerpColor(colorElevLow, colorElevHigh, amount);
    }
}

function getVolcanoAt(x, y) {
    let hitRadius = baseMarkerSize;

    // Cerca dall'ultimo al primo (quelli disegnati sopra)
    for (let i = volcanoes.length - 1; i >= 0; i--) {
        let volcano = volcanoes[i];

        if (!isVolcanoVisible(volcano)) {
            continue;
        }
        
        // Converti le coordinate del mondo in coordinate schermo
        let screenX = (volcano.x * currentScale) + transX;
        let screenY = (volcano.y * currentScale) + transY;

        let d = dist(x, y, screenX, screenY);

        if (d < hitRadius) {
            // Salva le coordinate schermo sull'oggetto
            // (serve per disegnarne l'evidenziazione)
            volcano.screenX = screenX; 
            volcano.screenY = screenY;
            return volcano; // Trovato!
        }
    }

    return null; // Non trovato
}

function drawVolcanoes() {
    noStroke();
    
    // Dimensione fissa del marker, scalata inversamente allo zoom
    let markerSize = baseMarkerSize / currentScale;

    for (let volcano of volcanoes) {
        if (!isVolcanoVisible(volcano)) {
            continue;
        }

        let col = getVolcanoColor(volcano);
        fill(col);

        drawHighlightTriangle(volcano.x, volcano.y, markerSize);
    }
}

function draw() {
    background(51);

    push();
    translate(transX, transY);  // Pan
    scale(currentScale);    // Zoom

    image(mapImage, 0, 0, mapImage.width, mapImage.height);
    drawVolcanoes();

    // Disegna l'evidenziazione permanente per il vulcano selezionato
    if (selectedVolcano) {
        // Usa lo stesso stile dell'hover
        stroke("#000000ad");
        // Lo spessore dello stroke deve essere scalato inversamente
        strokeWeight(2 / currentScale); 
        noFill();
        // Anche la dimensione del marker deve essere scalata inversamente
        let markerSize = baseMarkerSize / currentScale;

        drawHighlightTriangle(selectedVolcano.x, selectedVolcano.y, markerSize);
    }

    pop();

    if (isMouseOverCanvas() && !isMouseOverModal) {
        // 1. Controlla prima se siamo sopra un vulcano
        let volcanoHover = getVolcanoAt(mouseX, mouseY);
        
        strokeWeight(1);

        if (volcanoHover) {
            // ** Logica di aggancio **
            // Usa le coordinate del VULCANO, non del mouse
            let x = volcanoHover.screenX;
            let y = volcanoHover.screenY;
            // Imposta un margine (un po' più grande del triangolo)
            let margin = baseMarkerSize + 8; 

            // Disegna 4 linee separate che si fermano al margine
            stroke("#3636366B");
            line(x, 0, x, y - margin);      // Alto
            line(x, y + margin, x, height); // Basso
            line(0, y, x - margin, y);      // Sinistra
            line(x + margin, y, width, y);  // Destra

        } else {
            // ** Logica normale **
            // Nessun vulcano, usa le coordinate del MOUSE
            stroke("#36363636");
            line(mouseX, 0, mouseX, height);
            line(0, mouseY, width, mouseY);
        }

        // Evidenziazione (disegnata in coordinate schermo)
        if (volcanoHover) {
            stroke("#000000ad");
            strokeWeight(2);
            noFill();
            let markerSize = baseMarkerSize;
            drawHighlightTriangle(volcanoHover.screenX, volcanoHover.screenY, markerSize);
        }

        // Tooltip
        if (volcanoHover) {
            // Gestione pulita dell'output dell'elevazione
            let elevText = (volcanoHover.elevation === "N/A") ? "N/A" : `${volcanoHover.elevation} m`;
            
            let name = `${volcanoHover.name}`;
            /*let tooltipLines = [
                `Country: ${volcanoHover.country}`,
                `Lat/Lon: ${volcanoHover.lat}, ${volcanoHover.lon}`,
                `Elevation: ${elevText}`,
                `Type: ${volcanoHover.type}`,
                `State: ${volcanoHover.status}`,
                `Last Eruption: ${volcanoHover.lastEruption}` 
            ];*/
            let tooltipLines = [
                `Lat/Lon: ${volcanoHover.lat}, ${volcanoHover.lon}`,
                `Elevation: ${elevText}`,
                `Type: ${volcanoHover.type}`,
                `State: ${volcanoHover.status}`,
            ]

            let lineHeight = 15;
            let padding = 10;
            let boxHeight = ((tooltipLines.length + 1) * lineHeight) + (padding * 2) - (lineHeight - 12);   // +1 perché bisogna contare anche il nome
            let boxWidth = 0;

            textSize(12);
            textFont("Courier New");
            let nameWidth = textWidth(name);
            if (nameWidth > boxWidth) boxWidth = nameWidth;
            for (let line of tooltipLines) {
                let w = textWidth(line);
                if (w > boxWidth) boxWidth = w;
            }
            boxWidth += padding * 2;

            // Logica di posizionamento per evitare i bordi
            let xOffset = 25;
            let yOffset = -10; // Offset per stare sopra il mouse
            let boxX, boxY;

            // Margine interno al canvas
            let margin = 10; // "Safe area" dai bordi

            // Logica asse X (orizzontale)
            boxX = mouseX + xOffset;
            // Se esce a destra, prova a sinistra
            if (boxX + boxWidth > width - margin) {
                boxX = mouseX - xOffset - boxWidth;
            }
            // Se esce *ancora* a sinistra (es. finestra stretta), bloccalo a 0
            if (boxX < margin) {
                boxX = margin;
            }

            // Logica asse Y (verticale)
            boxY = mouseY + yOffset;
            // Se esce in alto, prova sotto
            if (boxY < margin) {
                boxY = mouseY + 10; // Offset per stare sotto il mouse
            }
            // Se esce *in basso* (sia da sopra che da sotto), bloccalo al fondo
            if (boxY + boxHeight > height - margin) {
                boxY = height - margin - boxHeight;
            }
            
            fill(0, 0, 0, 220);
            noStroke();
            rect(boxX, boxY, boxWidth, boxHeight, 4);

            fill(255);
            noStroke();
            textAlign(LEFT, TOP);
            textStyle(BOLD);
            text(name, boxX + padding, boxY + padding);
            textStyle(NORMAL);
            for (let i = 0; i < tooltipLines.length; i++) {
                text(tooltipLines[i], boxX + padding, boxY + padding + ((i + 1) * lineHeight));
            }
        }
    }
    // Se il mouse NON è sulla mappa (è sul modal o sidebar)
    // E un vulcano è selezionato, disegna i crosshair agganciati
    else if (selectedVolcano) {
        let x = (selectedVolcano.x * currentScale) + transX;
        let y = (selectedVolcano.y * currentScale) + transY;

        // Disegna i crosshair agganciati
        let margin = baseMarkerSize + 8;
        stroke("#3636366B");          // Colore "agganciato"
        strokeWeight(1);
        line(x, 0, x, y - margin);      // Alto
        line(x, y + margin, x, height); // Basso
        line(0, y, x - margin, y);      // Sinistra
        line(x + margin, y, width, y);  // Destra
    }
}

function constrainTranslation() {
    let scaledMapWidth = mapImage.width * currentScale;
    let scaledMapHeight = mapImage.height * currentScale;

    // Asse X
    if (scaledMapWidth < width) {
        // Se la mappa è più stretta dello schermo, centrala
        transX = (width - scaledMapWidth) / 2;
    } else {
        // Altrimenti, non permettere ai bordi di entrare
        transX = max(transX, width - scaledMapWidth); // Limite sinistro
        transX = min(transX, 0);                      // Limite destro
    }

    // Asse Y
    if (scaledMapHeight < height) {
        // Se la mappa è più "corta" dello schermo, centrala
        transY = (height - scaledMapHeight) / 2;
    } else {
        transY = max(transY, height - scaledMapHeight); // Limite superiore
        transY = min(transY, 0);                        // Limite inferiore
    }
}

function updateButtonStates() {
    
    const buttons = [
        { selector: "#btn-category", mode: "TypeCategory" },
        { selector: "#btn-status", mode: "Status" },
        { selector: "#btn-elevation", mode: "Elevation" }
    ];

    for (let btnInfo of buttons) {
        let btn = select(btnInfo.selector);
        
        // Controlla se il modo del pulsante corrisponde allo stato globale
        if (currentVisMode === btnInfo.mode) {
            // È attivo: imposta le classi attive
            btn.addClass("bg-white");
            btn.addClass("rounded");
            btn.addClass("shadow-sm");
            btn.removeClass("cursor-pointer");
            
        } else {
            // È inattivo: imposta le classi inattive
            btn.removeClass("bg-white");
            btn.removeClass("rounded");
            btn.removeClass("shadow-sm");
            btn.addClass("cursor-pointer");
        }
    }
}

function updateLegend() {
    let legendContainer = select("#legend-container");
    legendContainer.html(""); // Pulisce la legenda vecchia

    if (currentVisMode === "TypeCategory" || currentVisMode === "Status") {
        // Scegli la palette e l'oggetto di stato corretti
        let palette = (currentVisMode === "TypeCategory") ? colorPalette_Category : colorPalette_Status;
        let visibilityState = (currentVisMode === "TypeCategory") ? categoryVisibility_Category : categoryVisibility_Status;

        // Ordina le chiavi (categorie) alfabeticamente
        let sortedKeys = Object.keys(palette).sort();

        for (let key of sortedKeys) {
            let p5Color = palette[key];
            let hexColor = p5Color.toString("#rrggbb");

            //let legendItem = createDiv("");
            let legendItem = createElement("label");
            legendItem.addClass("flex items-center space-x-2 border border-gray-300 rounded hover:bg-gray-50 p-2 cursor-pointer");
            legendItem.parent(legendContainer);

            /*let legendLabel = createElement("div");
            legendLabel.addClass("flex space-x-2");

            // Quadratino colorato
            let colorBox = createSpan("");
            colorBox.style("background-color", hexColor);
            colorBox.style("border-radius", "4px");
            // Aggiungi dimensioni fisse se necessario (es. "width", "15px")
            colorBox.style("width", "16px");
            colorBox.style("height", "16px");
            colorBox.style("display", "inline-block");
            colorBox.parent(legendLabel);*/

            //legendLabel.parent(legendItem);

            // Checkbox
            let checkbox = createInput("", "checkbox");
            checkbox.addClass("w-4 h-4 border border-gray-400 rounded cursor-pointer appearance-none");
            checkbox.parent(legendItem);

  			const setCheckboxStyle = (isChecked) => {
  				if (isChecked) {
  					// STATO "CHECKED": imposta il colore di sfondo e del bordo
  					checkbox.style("background-color", hexColor);
  					checkbox.style("border-color", hexColor);
  				} else {
  					// STATO "UNCHECKED": resetta gli stili
  					// Lascia che le classi "border-gray-300" riprendano il controllo
  					checkbox.style("background-color", "");
  					checkbox.style("border-color", "");
  				}
  			};

  			// Imposta lo stato iniziale (dal nostro oggetto visibilityState)
  			checkbox.elt.checked = visibilityState[key];
  			
  			// Applica lo stile corretto al caricamento
  			setCheckboxStyle(checkbox.elt.checked);

  			// Aggiungi il listener per i cambi futuri
  			checkbox.changed(() => {
  				let isChecked = checkbox.elt.checked;
  				visibilityState[key] = isChecked;
  				
  				// Applica lo stile in base al nuovo stato
  				setCheckboxStyle(isChecked);
  		
  				// Se un vulcano è selezionato e lo nascondiamo, chiudi il modal
  				if (selectedVolcano && !isVolcanoVisible(selectedVolcano)) {
  					closeModal();
  				}
  			});
            
            // Testo
            let label = createSpan(key);
            label.addClass("font-mono text-sm");
            label.style("color", "black"); // Forza il colore del testo
            label.parent(legendItem);
        }
    } else if (currentVisMode === "Elevation") {
        // Gradiente per l'elevazione
        let gradientBox = createDiv("");
        let lowHex = colorElevLow.toString("#rrggbb");
        let highHex = colorElevHigh.toString("#rrggbb");
        
        gradientBox.style("width", "100%");
        gradientBox.style("height", "20px");
        gradientBox.style("border-radius", "4px");
        gradientBox.style("background", `linear-gradient(90deg, ${lowHex}, ${highHex})`);
        gradientBox.parent(legendContainer);
        
        let labels = createDiv("");
        labels.addClass("flex justify-between w-full");
        labels.parent(legendContainer);

        let minText = (minElev === Infinity) ? "N/A" : `${minElev} m`;
        let maxText = (maxElev === -Infinity) ? "N/A" : `${maxElev} m`;

        let minLabel = createSpan(minText);
        minLabel.addClass("font-mono text-sm");
        minLabel.style("color", "black");
        minLabel.parent(labels);
        
        let maxLabel = createSpan(maxText);
        maxLabel.addClass("font-mono text-sm");
        maxLabel.style("color", "black");
        maxLabel.parent(labels);
    }
}

function checkForVolcanoClick() {
    let volcanoClicked = getVolcanoAt(mouseX, mouseY);

    if (volcanoClicked) {
        openModal(volcanoClicked); 
    }
    else return false;
}

function openModal(volcano) {
    if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
    }

    if (selectedVolcano) {
        closeModal(true); // Chiudi qualsiasi modal precedente (immediatamente)
    }
    
    selectedVolcano = volcano;

    // Popola i campi di testo
    select("#modal-name").html(volcano.name);
    select("#modal-country").html(volcano.country);
    select("#modal-latlon").html(`${volcano.lat}, ${volcano.lon}`);
    select("#modal-elevation").html(`(${volcano.elevation} m)`);
    select("#modal-type-category").html(volcano.typeCategory);
    select("#modal-type").html(volcano.type);
    select("#modal-status").html(volcano.status);
    select("#modal-eruption").html(volcano.lastEruption);

    // ** Stile header del modal **

    // Ottieni il colore del vulcano
    let volcanoColor = getVolcanoColor(volcano);
    
    // Crea una versione opaca per lo sfondo
    let opaqueBgColor = color(volcanoColor); // Clona il colore
    //opaqueBgColor.setAlpha(255); // Rendi opaco

    // Calcola il colore del testo con contrasto
    let textColor = getContrastingTextColor(opaqueBgColor);

    // Applica i colori
    select("#modal-header").style("background-color", opaqueBgColor.toString());
    
    // Applica il colore di contrasto a tutti gli elementi nell'header
    select("#modal-name").style("color", textColor);
    select("#modal-elevation").style("color", textColor).style("opacity", 0.7);
    select("#modal-close-btn").style("color", textColor);

    // ** Fine stile header del modal **

    // Salva la descrizione per il nostro tooltip
    currentTypeDescription = volcano.description || "";

    // Gestione del link
    let wikiLink = select("#modal-wiki-link");
    wikiLink.html(volcano.wikiLink === "#" ? "" : "🡥");
    wikiLink.attribute("href", volcano.wikiLink);

    // Mostra il modal
    select("#modal-overlay").removeClass("translate-y-full");

    // Crea e disegna il grafico a barre
    let chartContainer = select("#modal-chart-container");
    chartContainer.html(""); // Reset

    // Crea un canvas p5.Graphics (un buffer di disegno separato)
    // Usiamo le dimensioni del contenitore
    modalChart = createGraphics(chartContainer.width, chartContainer.height);
    modalChart.style("display", "block");
    
    // Disegna il grafico su quel buffer
    drawModalChart(modalChart, volcano);
    
    // Attacca il canvas del buffer al contenitore HTML
    modalChart.parent(chartContainer);
}

function getContrastingTextColor(bgColor) {
    // Estrai i valori R, G, B
    let r = red(bgColor);
    let g = green(bgColor);
    let b = blue(bgColor);

    // Calcola la luminanza percepita (formula YIQ)
    // Un valore tra 0 (nero) e 255 (bianco)
    let luminance = (0.299 * r + 0.587 * g + 0.114 * b);

    // Scegli il colore del testo in base alla luminanza
    // Se lo sfondo è > 140 (più chiaro che medio-grigio), usa testo nero
    if (luminance > 140) {
        return "#000000"; // Testo nero
    } else {
        return "#FFFFFF"; // Testo bianco
    }
}

function drawModalChart(pg, selected) {
    // Sfondo per il grafico
    pg.background("#F9FAFB"); 
    
    // Filtra i vulcani che hanno un'elevazione valida
    let validVolcanoes = volcanoes.filter(v => {
        if (v.elevation === "N/A") return false;
        return !isNaN(parseFloat(v.elevation)); // Controlla se è un numero
    })
    .sort((a, b) => {
        // Ordina in base all'elevazione, da più piccolo a più grande
        return parseFloat(a.elevation) - parseFloat(b.elevation);
    });

    let totalVolcanoes = validVolcanoes.length;
    if (totalVolcanoes === 0) return;

    let barWidth = pg.width / totalVolcanoes;
    let padding = 0; // Spaziatura tra barre
    let margin = 30; // "Safe area" dai bordi 

    // Trova la posizione Y della "linea del mare" (livello 0)
    let yZero = map(0, minElev, maxElev, pg.height - margin, margin);

    // Colori
    let baseColor = color("#D1D5DC"); // Colore chiaro
    //let extremeColor = color(0, 100, 255, 180); // Colore per estremi
    let extremeColor = color("#000000");

    // Clona il colore selezionato per renderlo opaco
    let origSelectedColor = getVolcanoColor(selected);
    let selectedColor = color(
        red(origSelectedColor),
        green(origSelectedColor),
        blue(origSelectedColor)
    );
    selectedColor.setAlpha(255);

    // Variabili per i dati
    let minBarData = null;
    let maxBarData = null;
    let selectedBarData = null;

    pg.noStroke();

    // ** Disegna tutte le barre "normali" (base) e salva quelle speciali **
    for (let i = 0; i < totalVolcanoes; i++) {
        let v = validVolcanoes[i];
        let elevNum = parseFloat(v.elevation);

        // Calcola altezza e posizione
        //let h = map(elevNum, minElev, maxElev, 1, pg.height); // (usiamo 1 come min per vedere anche le barre piccole)
        let x = map(i, 0, totalVolcanoes, margin, pg.width - margin);
        let yPos = map(elevNum, minElev, maxElev, pg.height - margin, margin);
        let currentBarWidth = (barWidth - padding);

        // Controlla se è selezionato, minimo o massimo (usiamo Lat/Lon come ID unico)
        let isSelected = (v.lat === selected.lat && v.lon === selected.lon);
        let isMin = (elevNum === minElev);
        let isMax = (elevNum === maxElev);

        // Disegna la barra di base SE NON è una barra speciale
        if (!isSelected && !isMin && !isMax) {
            pg.fill(baseColor);
            drawBar(pg, x, yPos, yZero, currentBarWidth, elevNum);
        }

        // Salva i dati delle barre speciali per dopo
        // (sovrascriverà se uno è sia min che selezionato, il che è corretto)
        let barData = { x, yPos, yZero, currentBarWidth, elevNum, rank: i };

        if (isMin) {
            minBarData = barData;
            minBarData.color = extremeColor;
            minBarData.currentBarWidth = max(barWidth * 2, 1); // Ispessisci
        }
        if (isMax) {
            maxBarData = barData;
            maxBarData.color = extremeColor;
            maxBarData.currentBarWidth = max(barWidth * 2, 1); // Ispessisci
        }
        if (isSelected) {
            selectedBarData = barData;
            selectedBarData.color = selectedColor;
            selectedBarData.currentBarWidth = max(barWidth * 2, 1); // Ispessisci
        }
    }

    let dotDiameter = 4;

    // ** Disegna barre min/max speciali **

    // Disegna il Minimo
    if (minBarData) {
        // Controlla se il min è ANCHE il selezionato. Se sì, saltalo (verrà disegnato dopo)
        let isMinSelected = (selectedBarData && minBarData.x === selectedBarData.x);
        if (!isMinSelected) {
            pg.fill(minBarData.color);
            drawBar(pg, minBarData.x, minBarData.yPos, minBarData.yZero, minBarData.currentBarWidth, minBarData.elevNum);
            pg.ellipse(minBarData.x + minBarData.currentBarWidth / 2, minBarData.yPos, dotDiameter, dotDiameter);
        }
    }
    // Disegna il Massimo
    if (maxBarData) {
        // Controlla se il max è ANCHE il selezionato.
        let isMaxSelected = (selectedBarData && maxBarData.x === selectedBarData.x);
        if (!isMaxSelected) {
            pg.fill(maxBarData.color);
            drawBar(pg, maxBarData.x, maxBarData.yPos, maxBarData.yZero, maxBarData.currentBarWidth, maxBarData.elevNum);
            pg.ellipse(maxBarData.x + maxBarData.currentBarWidth / 2, maxBarData.yPos, dotDiameter, dotDiameter);
        }
    }
    // Disegna il selezionato (sempre per ultimo)
    if (selectedBarData) {
        pg.fill(selectedBarData.color);
        drawBar(pg, selectedBarData.x, selectedBarData.yPos, selectedBarData.yZero, selectedBarData.currentBarWidth, selectedBarData.elevNum);
        pg.ellipse(selectedBarData.x + selectedBarData.currentBarWidth / 2, selectedBarData.yPos, dotDiameter, dotDiameter);
    }

    // ** Disegna le etichette **
    
    // Etichetta Minimo
    if (minBarData) {
        let isMinSelected = (selectedBarData && minBarData.x === selectedBarData.x);
        if (!isMinSelected) { // Non disegnare se è anche selezionato
            drawBarLabel(pg, minBarData, `${minBarData.elevNum} m`, dotDiameter);
        }
    }
    // Etichetta Massimo
    if (maxBarData) {
        let isMaxSelected = (selectedBarData && maxBarData.x === selectedBarData.x);
        if (!isMaxSelected) { // Non disegnare se è anche selezionato
            drawBarLabel(pg, maxBarData, `${maxBarData.elevNum} m`, dotDiameter);
        }
    }
    // Etichetta Selezionato
    if (selectedBarData) {
        let rankText = `${selectedBarData.rank + 1} / ${totalVolcanoes}`;
        let labelData = { ...selectedBarData }; 

        // Invertiamo i valori
        labelData.yPos = selectedBarData.yZero;
        labelData.elevNum = -selectedBarData.elevNum;
        
        // 3. Disegna l'etichetta ancorata a yZero
        drawBarLabel(pg, labelData, rankText, 0); 
    }

    // Disegna il livello del mare
    pg.stroke(100, 100, 100, 150); // Grigio scuro, semitrasparente
    pg.strokeWeight(1);
    pg.line(0, yZero, pg.width, yZero);
}

function drawHighlightTriangle(x, y, markerSize) {
    triangle(
        x - markerSize, y + markerSize, 
        x + markerSize, y + markerSize, 
        x, y - markerSize
    );
}

function drawBar(pg, x, yPos, yZero, width, elevNum) {
    if (elevNum >= 0) {
        // Positivo: disegna da yPos (cima) a yZero (fondo)
        pg.rect(x, yPos, width, yZero - yPos);
    } else if (elevNum < 0) {
        // Negativo: disegna da yZero (cima) a yPos (fondo)
        pg.rect(x, yZero, width, yPos - yZero);
    }
}

function drawBarLabel(pg, barData, labelText, dotDiameter) {
    let x = barData.x + barData.currentBarWidth / 2;
    let dotRadius = dotDiameter / 2;
    let padding = 8; // Spazio tra il pallino e il testo

    pg.fill(0); // Colore del testo (nero)
    pg.textSize(10);
    pg.textAlign(CENTER);

    if (barData.elevNum > 0) {
        // Disegna SOPRA il pallino
        pg.textAlign(CENTER, BASELINE);
        pg.text(labelText, x, barData.yPos - dotRadius - padding);
    } else {
        // Disegna SOTTO il pallino
        pg.textAlign(CENTER, TOP);
        pg.text(labelText, x, barData.yPos + dotRadius + padding);
    }
}

function positionHtmlTooltip(mouseX, mouseY) {
    let boxWidth = htmlTooltip.elt.offsetWidth;
    let boxHeight = htmlTooltip.elt.offsetHeight;

    // Definisci offset e margini
    let xOffset = 25;
    let yOffset = -10;
    let margin = 10; // "Safe area" dai bordi della finestra
    let boxX, boxY;

    // Logica di posizionamento (questa era corretta)
    // Logica asse X
    boxX = mouseX + xOffset;
    if (boxX + boxWidth > windowWidth - margin) {
        boxX = mouseX - xOffset - boxWidth;
    }
    if (boxX < margin) {
        boxX = margin;
    }

    // Logica asse Y
    boxY = mouseY + yOffset;
    if (boxY < margin) {
        boxY = mouseY + 10;
    }
    if (boxY + boxHeight > windowHeight - margin) {
        boxY = windowHeight - margin - boxHeight;
    }

    // Applica lo stile
    // (Questo è il blocco che prima non veniva mai eseguito)
    htmlTooltip.style("left", `${boxX}px`);
    htmlTooltip.style("top", `${boxY}px`);
}

function closeModal(isImmediate = false) {
    // Se il modal è già in chiusura o chiuso (selectedVolcano è null), non fare nulla
    if (!selectedVolcano) {
        return;
    }

    // ** Azioni immediate **
    isMouseOverModal = false;
    currentTypeDescription = "";
    
    if (htmlTooltip) {
        htmlTooltip.addClass("hidden");
    }

    // Avvia l'animazione di chiusura
    select("#modal-overlay").addClass("translate-y-full");
    
    // Imposta lo stato su "chiuso" SUBITO
    // Questo è fondamentale per prevenire che si apra di nuovo
    selectedVolcano = null;

    // Cancella qualsiasi vecchio timeout (sicurezza)
    if (closeTimeout) {
        clearTimeout(closeTimeout);
    }

    // ** Funzione di pulizia **
    const cleanup = () => {
        // Resetta gli stili in linea dell'header
        select("#modal-name").style("color", "");
        select("#modal-elevation").style("color", "").style("opacity", "");
        select("#modal-close-btn").style("color", "");
        select("#modal-header").style("background-color", "");

        // Rimuove il canvas del grafico per liberare memoria
        if (modalChart) {
            modalChart.remove();
            modalChart = null;
        }
        
        // Pulisce l'HTML del contenitore
        select("#modal-chart-container").html(""); 

        closeTimeout = null; // Resetta il nostro ID di timeout
    };

    // ** Azioni ritardate o immediate **
    if (isImmediate) {
        // Chiamato da openModal: pulisci tutto SUBITO
        cleanup();
    } else {
        // Chiamato dall'utente: pulisci DOPO l'animazione
        closeTimeout = setTimeout(cleanup, 600); // 600ms = la tua transition-duration
    }
}

function isMouseOverCanvas() {
    return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function mouseWheel(event) {
    if (!isMouseOverCanvas()) {
        return true; // Permette di interagire con la sidebar senza interferire con la mappa
    }

    let zoomFactor = 1.1; 
    let oldScale = currentScale;

    if (event.delta < 0) {
        currentScale *= zoomFactor;
    } else {
        currentScale /= zoomFactor;
    }
    
    currentScale = constrain(currentScale, minScale, maxScale);

    // Zoom verso il mouse
    let worldMouseX = (mouseX - transX) / oldScale;
    let worldMouseY = (mouseY - transY) / oldScale;

    transX = mouseX - (worldMouseX * currentScale);
    transY = mouseY - (worldMouseY * currentScale);

    constrainTranslation();

    return false; // Previene lo scrolling della pagina
}

function mousePressed() {
    if (!isMouseOverCanvas()) {
        return; // Non fare nulla
    }

    if (mouseButton === LEFT) {
        isDragging = true;
        hasDragged = false;
        prevMouseX = mouseX;
        prevMouseY = mouseY;

        if (checkForVolcanoClick() === false) {
            closeModal();
        }
    }
}

function mouseDragged() {
    if (isDragging) {
        hasDragged = true;

        // Disabilita la selezione del testo sul modal MENTRE si trascina
        select("#modal").style("user-select", "none");

        let dx = mouseX - prevMouseX;
        let dy = mouseY - prevMouseY;
        transX += dx;
        transY += dy;
        
        // Applica i vincoli DURANTE il trascinamento
        constrainTranslation();

        prevMouseX = mouseX;
        prevMouseY = mouseY;
    }
}

function mouseReleased() {
    if (isDragging) {
        if (!hasDragged && isMouseOverCanvas()) {
            checkForVolcanoClick();
        }

        // Riabilita la selezione del testo quando il drag finisce
        select("#modal").style("user-select", "auto");

        // Resettiamo lo stato
        isDragging = false;
        hasDragged = false;
    }
}

function windowResized() {
    let canvasContainer = select("#canvas-container");
    resizeCanvas(canvasContainer.width, canvasContainer.height);
    
    // Ricalcola la scala minima e ri-applica i vincoli
    minScale = height / mapImage.height;
    maxScale = minScale * zoomMultiplier;
    currentScale = constrain(currentScale, minScale, maxScale);
    constrainTranslation();

    if (selectedVolcano) {
        if (modalChart) {
            modalChart.remove();
        }

        let chartContainer = select("#modal-chart-container");
        let chartWidth = chartContainer.width;
        let chartHeight = chartContainer.height;

        if (chartWidth <= 0 || chartHeight <= 0) {
            console.error("Ridimensionamento modal fallito: dimensioni contenitore 0.");
            return;
        }

        // Ricrea il grafico
        modalChart = createGraphics(chartWidth, chartHeight);
        modalChart.style("display", "block");
        drawModalChart(modalChart, selectedVolcano); 
        modalChart.parent("modal-chart-container");
    }
}