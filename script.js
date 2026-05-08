const TOLERANCE = 40;
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultCanvas = document.getElementById('result-canvas');
const status = document.getElementById('status');
const progressWrap = document.getElementById('progress-wrap');
const progressBar = document.getElementById('progress-bar');

// Gestion de l'upload
fileInput.onchange = e => { 
    if(e.target.files[0]) loadFile(e.target.files[0]); 
};

function loadFile(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => process(img);
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function colorDist(r1, g1, b1, r2, g2, b2) {
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function process(img) {
    progressWrap.style.display = 'block';
    progressBar.style.width = '30%';
    status.textContent = "Analyse de l'image...";
    
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = W; 
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, W, H);
    const data = imageData.data;
    
    // 1. Détection fond (basée sur un pixel du coin)
    const bgR = data[0], bgG = data[1], bgB = data[2];

    // 2. Masquage alpha (suppression du fond coloré)
    for(let i = 0; i < W * H; i++) {
        const d = colorDist(data[i*4], data[i*4+1], data[i*4+2], bgR, bgG, bgB);
        data[i*4+3] = d < TOLERANCE ? 0 : 255;
    }
    ctx.putImageData(imageData, 0, 0);
    progressBar.style.width = '60%';

    // 3. Logique de Crop (Isolation du ticket vs logo du haut)
    const rowDensity = new Float32Array(H);
    for(let y = 0; y < H; y++) {
        let count = 0;
        for(let x = 0; x < W; x++) { 
            if(data[(y * W + x) * 4 + 3] > 50) count++; 
        }
        rowDensity[y] = count / W;
    }

    let ticketTop = 0;
    for(let y = 0; y < H; y++) {
        let denseArea = 0;
        // On cherche une zone de 20px de haut qui est remplie à plus de 30%
        for(let k = y; k < Math.min(H, y + 20); k++) { 
            if(rowDensity[k] > 0.3) denseArea++; 
        }
        if(denseArea > 15) { 
            ticketTop = y; 
            break; 
        }
    }

    // 4. Calcul des bordures finales pour le recadrage
    let minX = W, maxX = 0, minY = H, maxY = 0;
    for(let y = ticketTop; y < H; y++) {
        for(let x = 0; x < W; x++) {
            if(data[(y * W + x) * 4 + 3] > 50) {
                if(x < minX) minX = x; if(x > maxX) maxX = x;
                if(y < minY) minY = y; if(y > maxY) maxY = y;
            }
        }
    }

    // Marges de sécurité
    minY = Math.max(0, minY + 2);
    minX = Math.max(0, minX - 5); // Donne 10px de marge à gauche
    maxX = Math.min(W, maxX + 5); // Donne 10px de marge à droite
    
    const cW = maxX - minX;
    const cH = maxY - minY;

    // Dessin du résultat final recadré
    resultCanvas.width = cW; 
    resultCanvas.height = cH;
    resultCanvas.getContext('2d').drawImage(canvas, minX, minY, cW, cH, 0, 0, cW, cH);

    // Affichage de l'aperçu
    document.getElementById('crop-meta').textContent = `${cW} × ${cH} px`;
    document.getElementById('result-section').style.display = 'block';
    progressBar.style.width = '100%';
    status.textContent = "✓ Ticket extrait avec succès";

    // Gestion du téléchargement
    document.getElementById('btn-download').onclick = () => {
        const a = document.createElement('a');
        a.download = 'ticket_ugc_transparent.png';
        a.href = resultCanvas.toDataURL('image/png');
        a.click();
    };
}