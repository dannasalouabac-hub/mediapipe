// ===================================================
// 1. On récupère les éléments HTML qu'on va manipuler
// ===================================================
const video  = document.getElementById('camera');
const status = document.getElementById('status');
const info   = document.getElementById('info');
const courseContent = document.getElementById('course-content');

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
  // ET que les autres doigts sont tendus (main ouverte)
  const isCircleFormed = thumbIndexDist < palmSize * 0.15;
  const otherFingersExtended = isHandOpen(landmarks);
  
  return isCircleFormed && otherFingersExtended;
}

// ===================================================
// 5. Réagir aux résultats : on modifie le CSS
//    et on fait défiler la page.
// ===================================================
function onResults(results) {
  // Aucune main détectée
  if (!results.multiHandLandmarks ||
      results.multiHandLandmarks.length === 0) {
    status.textContent = '🙈 Aucune main';
    return;
  }

  const landmarks = results.multiHandLandmarks[0];

  // 👌 Geste OK → cacher TOUT le contenu du body
  if (isOkGesture(landmarks)) {
    courseContent.style.display = 'none';
    document.querySelector('h1').style.display = 'none';
    document.querySelector('p').style.display = 'none';
    info.style.display = 'none';
    status.textContent = '👌 Geste OK - Contenu effacé !';
    return;
  } else {
    // Réafficher le contenu si le geste OK n'est plus fait
    courseContent.style.display = 'block';
    document.querySelector('h1').style.display = 'block';
    document.querySelector('p').style.display = 'block';
  }

  // ✋ Main ouverte → on AFFICHE la boîte info
  // ✊ Sinon       → on la CACHE
  if (isHandOpen(landmarks)) {
    info.style.display = 'flex';
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