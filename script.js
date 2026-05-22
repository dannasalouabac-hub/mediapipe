// ===================================================
// 1. On récupère les éléments HTML qu'on va manipuler
// ===================================================
const video  = document.getElementById('camera');
const status = document.getElementById('status');
const info   = document.getElementById('info');
const courseContent = document.getElementById('course-content');
const mainTitle = document.querySelector('#main-page h1');
const mainParagraph = document.querySelector('#main-page > p');
const mainPage = document.getElementById('main-page');
const thumbPage = document.getElementById('thumb-page');

// ===================================================
// 2. On crée l'objet "Hands" de MediaPipe.
//    Il sait analyser une image et trouver les mains.
// ===================================================
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

// Options : 1 seule main, qualité moyenne
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5
});

// À chaque image analysée, MediaPipe appelle "onResults"
hands.onResults(onResults);

// ===================================================
// 3. On allume la webcam et on envoie chaque frame
//    à MediaPipe pour analyse.
// ===================================================
const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});
camera.start();

// ===================================================
// 4. Détecter les gestes de la main
// ===================================================
function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isHandOpen(landmarks) {
  const wrist = landmarks[0];
  const tips  = [8, 12, 16, 20];
  const pips  = [6, 10, 14, 18];
  let extended = 0;
  for (let i = 0; i < tips.length; i++) {
    if (distance(landmarks[tips[i]], wrist) >
        distance(landmarks[pips[i]], wrist)) {
      extended++;
    }
  }
  return extended >= 3; // main ouverte = au moins 3 doigts tendus
}

function isHandClosed(landmarks) {
  const wrist = landmarks[0];
  const tips  = [8, 12, 16, 20];
  const pips  = [6, 10, 14, 18];
  let folded = 0;
  for (let i = 0; i < tips.length; i++) {
    if (distance(landmarks[tips[i]], wrist) <
        distance(landmarks[pips[i]], wrist)) {
      folded++;
    }
  }
  return folded >= 4; // poing fermé = tous les doigts repliés
}

// Geste de scroll : POUCE + INDEX repliés
function isThumbAndIndexClosed(landmarks) {
  const wrist = landmarks[0];

  const indexFolded =
    distance(landmarks[8], wrist) < distance(landmarks[6], wrist);

  const palmSize    = distance(landmarks[0], landmarks[5]);
  const thumbFolded = distance(landmarks[4], landmarks[5]) < palmSize * 0.6;

  return indexFolded && thumbFolded;
}

// 👌 Geste OK : pouce et index se touchent (formant un cercle)
function isOkGesture(landmarks) {
  const thumbTip = landmarks[4];   // bout du pouce
  const indexTip = landmarks[8];   // bout de l'index
  
  // Distance entre le pouce et l'index
  const thumbIndexDist = distance(thumbTip, indexTip);
  
  // Distance de référence : taille de la paume
  const palmSize = distance(landmarks[0], landmarks[5]);
  
  // Si le pouce et l'index sont très proches (moins de 15% de la taille de la paume)
  // ET que les autres doigts sont tendus
  const isCircleFormed = thumbIndexDist < palmSize * 0.15;
  const otherFingersExtended = isHandOpen(landmarks);
  
  return isCircleFormed && otherFingersExtended;
}

// 👍 Geste Pouce levé : seul le pouce est tendu vers le haut
function isThumbsUp(landmarks) {
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];    // bout du pouce
  const thumbIp = landmarks[3];     // articulation du pouce
  const indexTip = landmarks[8];    // bout de l'index
  const indexPip = landmarks[6];    // articulation de l'index
  
  // Le pouce doit être tendu (plus loin du poignet que son articulation)
  const thumbExtended = distance(thumbTip, wrist) > distance(thumbIp, wrist);
  
  // Les autres doigts doivent être repliés (poing fermé)
  const indexFolded = distance(indexTip, wrist) < distance(indexPip, wrist);
  
  // Le pouce doit pointer vers le haut (y plus petit que le poignet = vers le haut de l'image)
  const thumbPointingUp = thumbTip.y < wrist.y - 0.05;
  
  // Vérifier que les autres doigts sont repliés
  const otherFingersFolded = isHandClosed(landmarks);
  
  return thumbExtended && thumbPointingUp && otherFingersFolded;
}

// Fonction pour afficher la page principale
function showMainPage() {
  mainPage.style.display = 'block';
  thumbPage.style.display = 'none';
  document.body.style.background = ''; // Réinitialiser le fond
}

// Fonction pour afficher la page pouce levé
function showThumbPage() {
  mainPage.style.display = 'none';
  thumbPage.style.display = 'flex';
  document.body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}

// ===================================================
// 5. Réagir aux résultats : on modifie le CSS
// ===================================================
function onResults(results) {
  // 🙈 Aucune main détectée → afficher la page principale
  if (!results.multiHandLandmarks ||
      results.multiHandLandmarks.length === 0) {
    status.textContent = '🙈 Aucune main - Retour au cours';
    showMainPage();
    // Réafficher tout le contenu
    courseContent.style.display = 'block';
    mainTitle.style.display = 'block';
    if (mainParagraph) mainParagraph.style.display = 'block';
    info.style.display = 'none';
    return;
  }

  const landmarks = results.multiHandLandmarks[0];

  // 👍 Pouce levé → afficher la page spéciale
  if (isThumbsUp(landmarks)) {
    status.textContent = '👍 Pouce levé détecté !';
    showThumbPage();
    return;
  }

  // Si on n'est pas en mode pouce levé, s'assurer qu'on est sur la page principale
  showMainPage();

  // ✊ Poing fermé → cacher TOUT le contenu
  if (isHandClosed(landmarks)) {
    courseContent.style.display = 'none';
    mainTitle.style.display = 'none';
    if (mainParagraph) mainParagraph.style.display = 'none';
    info.style.display = 'none';
    status.textContent = '✊ Poing fermé - Contenu caché !';
    return;
  }

  // 👌 Geste OK → réafficher TOUT le contenu
  if (isOkGesture(landmarks)) {
    courseContent.style.display = 'block';
    mainTitle.style.display = 'block';
    if (mainParagraph) mainParagraph.style.display = 'block';
    status.textContent = '👌 Geste OK - Contenu réaffiché !';
    return;
  }

  // ✋ Main ouverte → on AFFICHE la boîte info
  // Sinon → on la CACHE
  if (isHandOpen(landmarks)) {
    info.style.display = 'flex';
    // Réafficher le contenu si c'était caché
    courseContent.style.display = 'block';
    mainTitle.style.display = 'block';
    if (mainParagraph) mainParagraph.style.display = 'block';
  } else {
    info.style.display = 'none';
  }

  // 🤏 Si POUCE + INDEX sont fermés → on fait défiler la page
  if (isThumbAndIndexClosed(landmarks)) {
    const y = landmarks[0].y;
    if (y < 0.4) {
      status.textContent = '🤏⬆️ Scroll haut';
      window.scrollBy({ top: -20, behavior: 'auto' });
    } else if (y > 0.6) {
      status.textContent = '🤏⬇️ Scroll bas';
      window.scrollBy({ top: 20, behavior: 'auto' });
    } else {
      status.textContent = '🤏 Pouce + index fermés (zone morte)';
    }
  } else if (isHandOpen(landmarks)) {
    status.textContent = '✋ Main ouverte';
  } else {
    status.textContent = '✊ Main fermée';
  }
}