
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyACU3QfuTpW6PNRt3hHl9m1dy4Vso0GPoI",
    authDomain: "bologna-rugby-club.firebaseapp.com",
    projectId: "bologna-rugby-club",
    storageBucket: "bologna-rugby-club.firebasestorage.app",
    messagingSenderId: "641438144435",
    appId: "1:641438144435:web:e2a243bacd522fd1615dc6",
    measurementId: "G-9C66KXJ561"
};

const WIDTH = 1200;
const HEIGHT = 700;

const dom = {
    boardViewport: document.getElementById('boardViewport'),
    boardWrap: document.getElementById('boardWrap'),
    board: document.getElementById('board'),
    playersLayer: document.getElementById('players'),
    draw: document.getElementById('draw'),
    ball: document.getElementById('ball'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    btnPlay: document.getElementById('btnPlay'),
    frameInfo: document.getElementById('frameInfo'),
    playName: document.getElementById('playName')
};

const appState = {
    timeline: [],
    playIndex: 0,
    playing: false,
    rafId: null,
    segmentDuration: 800,
    layout: {
        scale: 1,
        tx: 0,
        ty: 0
    }
};

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}

const Layout = {
    fitBoard() {
        if (!dom.boardViewport || !dom.boardWrap) return;
        const vp = dom.boardViewport.getBoundingClientRect();
        const availW = vp.width;
        const availH = vp.height || window.innerHeight;

        const scale = Math.min(availW / WIDTH, availH / HEIGHT);
        appState.layout.scale = scale;

        const scaledW = WIDTH * scale;
        const scaledH = HEIGHT * scale;
        const tx = (availW - scaledW) / 2;
        const ty = (availH - scaledH) / 2;

        appState.layout.tx = tx;
        appState.layout.ty = ty;

        dom.boardWrap.style.transformOrigin = 'top left';
        dom.boardWrap.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
};

window.addEventListener('resize', () => Layout.fitBoard());

const Units = {
    createPlayersFromFrame(frame) {
        dom.playersLayer.innerHTML = '';
        if (!frame || !Array.isArray(frame.players)) return;

        frame.players.forEach(p => {
            const el = document.createElement('div');
            el.className = 'player';
            el.dataset.team = p.team;
            el.dataset.number = p.number;
            el.textContent = p.number;
            el.style.left = p.x + 'px';
            el.style.top = p.y + 'px';
            dom.playersLayer.appendChild(el);
        });

        if (frame.ball) {
            dom.ball.style.left = frame.ball.x + 'px';
            dom.ball.style.top = frame.ball.y + 'px';
        }
    },

    renderInterpolated(fromIndex, t) {
        const f0 = appState.timeline[fromIndex];
        const f1 = appState.timeline[fromIndex + 1];
        if (!f0 || !f1) return;

        const map = new Map();
        [...dom.playersLayer.children].forEach(el => {
            map.set(el.dataset.team + el.dataset.number, el);
        });

        f0.players.forEach(p0 => {
            const key = p0.team + p0.number;
            const el = map.get(key);
            const p1 = f1.players.find(pp => pp.team === p0.team && pp.number === p0.number) || p0;
            const x = lerp(p0.x, p1.x, t);
            const y = lerp(p0.y, p1.y, t);
            if (el) {
                el.style.left = x + 'px';
                el.style.top = y + 'px';
            }
        });

        if (f0.ball && f1.ball) {
            const bx = lerp(f0.ball.x, f1.ball.x, t);
            const by = lerp(f0.ball.y, f1.ball.y, t);
            dom.ball.style.left = bx + 'px';
            dom.ball.style.top = by + 'px';
        }
    },

    loadFrame(index) {
        if (!appState.timeline.length) return;
        index = clamp(index, 0, appState.timeline.length - 1);
        appState.playIndex = index;
        this.createPlayersFromFrame(appState.timeline[index]);
        dom.frameInfo.textContent = `${index + 1} / ${appState.timeline.length}`;
    }
};

const PlayerTimeline = {
    _startTime: null,
    _fromIndex: 0,

    play(timestamp) {
        if (!appState.playing || appState.timeline.length < 2) return;

        if (!PlayerTimeline._startTime) {
            PlayerTimeline._startTime = timestamp;
            PlayerTimeline._fromIndex = appState.playIndex;
        }

        const dur = appState.segmentDuration;
        const elapsed = timestamp - PlayerTimeline._startTime;
        const t = elapsed / dur;

        if (t >= 1) {
            Units.loadFrame(PlayerTimeline._fromIndex + 1);
            PlayerTimeline._fromIndex++;

            PlayerTimeline._startTime = timestamp;

            if (PlayerTimeline._fromIndex >= appState.timeline.length - 1) {
                appState.playing = false;
                PlayerTimeline._startTime = null;
                dom.btnPlay.textContent = 'Play';
                return;
            }
        } else {
            Units.renderInterpolated(PlayerTimeline._fromIndex, t);
        }

        appState.rafId = requestAnimationFrame(PlayerTimeline.play);
    },

    start() {
        if (appState.timeline.length < 2) return;
        appState.playing = true;
        PlayerTimeline._startTime = null;
        dom.btnPlay.textContent = 'Pause';
        cancelAnimationFrame(appState.rafId);
        appState.rafId = requestAnimationFrame(PlayerTimeline.play);
    },

    toggle() {
        if (!appState.playing) {
            PlayerTimeline.start();
        } else {
            appState.playing = false;
            dom.btnPlay.textContent = 'Play';
            cancelAnimationFrame(appState.rafId);
        }
    }
};

async function loadSharedPlay() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    if (!id) {
        alert('Link non valido: manca l\\'ID della giocata.');
        return;
    }

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    try {
        const snap = await getDoc(doc(db, 'sharedPlays', id));
        if (!snap.exists()) {
            alert('Giocata non trovata o link scaduto.');
            return;
        }

        const data = snap.data();
        appState.timeline = Array.isArray(data.timeline) ? data.timeline : [];
        dom.playName.textContent = data.name || '';

        if (!appState.timeline.length) {
            alert('Questa giocata non contiene frame.');
            return;
        }

        Units.createPlayersFromFrame(appState.timeline[0]);
        dom.frameInfo.textContent = `1 / ${appState.timeline.length}`;
        Layout.fitBoard();
    } catch (error) {
        console.error('Errore nel caricare la giocata condivisa:', error);
        alert('Errore nel caricare la giocata condivisa.');
    }
}

dom.btnPrev.addEventListener('click', () => {
    if (!appState.timeline.length) return;
    appState.playIndex = clamp(appState.playIndex - 1, 0, appState.timeline.length - 1);
    Units.loadFrame(appState.playIndex);
});

dom.btnNext.addEventListener('click', () => {
    if (!appState.timeline.length) return;
    appState.playIndex = clamp(appState.playIndex + 1, 0, appState.timeline.length - 1);
    Units.loadFrame(appState.playIndex);
});

dom.btnPlay.addEventListener('click', () => {
    PlayerTimeline.toggle();
});

loadSharedPlay();
