// --- IMPORTS FIREBASE ---
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, deleteDoc, collection, query, onSnapshot, getDoc, getDocs, where, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // --- CONFIGURAZIONE FIREBASE (Usando Bologna) ---
        const firebaseConfig = {
            apiKey: "AIzaSyACU3QfuTpW6PNRt3hHl9m1dy4Vso0GPoI",
            authDomain: "bologna-rugby-club.firebaseapp.com",
            projectId: "bologna-rugby-club",
            storageBucket: "bologna-rugby-club.firebasestorage.app",
            messagingSenderId: "641438144435",
            appId: "1:641438144435:web:e2a243bacd522fd1615dc6",
            measurementId: "G-9C66KXJ561"
        };

        // Variabili globali Firebase
        let app, db = null, auth;
        let isAuthorized = false;
        let currentUser = null;
        let firebaseConnected = false;

        // --- COSTANTI GLOBALI ---
        const WIDTH = 1200, HEIGHT = 700;
        const GRID_SIZE = 24;
        const TL_KEY = 'rugby-timeline-v2';
        const POS_KEY = 'rugby-positions-v3';
        const ARROW_KEY = 'rugby-arrows-v3';
        const STROKE_KEY = 'rugby-strokes-v1';
        const BALL_KEY = 'rugby-ball-v1';
        const PLAY_PREFIX = 'play-v3-';
        
        // URL DI STRIPE
        const STRIPE_URL = "https://buy.stripe.com/00w9AV2B9dohgpw1XxaR200"; 

        // --- STATO CENTRALIZZATO (appState) ---
        let appState = {
            isPremium: false, // false = Gratis, true = Pro
            layout: { mode: 'landscape', scale: 1, tx: 0, ty: 0, forceVertical: false },
            tool: 'select',
            arrows: [],
            strokes: [],
            drawingArrow: false,
            drawingStroke: false,
            startPoint: null,
            currentStroke: null,
            timeline: [],
            playing: false,
            paused: false,
            playIndex: 0,
            rafId: null,
            segmentStartTime: 0,
            segmentDuration: 800,
            fromFrame: null,
            toFrame: null,
            selectedPlayers: new Set(),
            playerCounter: { blue: 0, red: 0 }
        };

        // --- RIFERIMENTI DEL DOM ---
        const exportCanvasEl = document.getElementById('exportCanvas'); 
        
        const dom = {
            loginOverlay: document.getElementById('loginOverlay'),
            mainApp: document.getElementById('mainApp'),
            boardViewport: document.getElementById('boardViewport'),
            boardWrap: document.getElementById('boardWrap'),
            board: document.getElementById('board'),
            playersLayer: document.getElementById('players'),
            draw: document.getElementById('draw'),
            gridSvg: document.getElementById('grid'),
            ball: document.getElementById('ball'),
            exportCanvas: exportCanvasEl,
            ctx: exportCanvasEl ? exportCanvasEl.getContext('2d') : null,
            selectionBox: document.getElementById('selectionBox'),
            sidebar: document.getElementById('sidebar'),
            menuBtn: document.getElementById('menuBtn'),
            closeMenuBtn: document.getElementById('closeMenu'),
            scrim: document.getElementById('scrim'),
            
            loginEmail: document.getElementById('loginEmail'),
            loginPassword: document.getElementById('loginPassword'),
            btnLogin: document.getElementById('btnLogin'),
            btnRegister: document.getElementById('btnRegister'),
            btnGoogle: document.getElementById('btnGoogle'),
            
            loginMessage: document.getElementById('loginMessage'),
            btnAuthAction: document.getElementById('btnAuthAction'),
            authStatus: document.getElementById('authStatus'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            toggleLabelsBtn: document.getElementById('toggleLabels'),
            resetBtn: document.getElementById('reset'),
            snapToggle: document.getElementById('snapToggle'),
            verticalFieldChk: document.getElementById('verticalField'),
            toolSelectBtn: document.getElementById('toolSelect'),
            toolArrowsBtn: document.getElementById('toolArrows'),
            toolPenBtn: document.getElementById('toolPen'),
            undoGenericBtn: document.getElementById('undoGeneric'),
            clearArrowsBtn: document.getElementById('clearArrows'),
            clearAllBtn: document.getElementById('clearAll'),
            strokeColorSel: document.getElementById('strokeColor'),
            strokeWidthSel: document.getElementById('strokeWidth'),
            dashedToggle: document.getElementById('dashedToggle'),
            recordStepBtn: document.getElementById('recordStepBtn'),
            autoRecordChk: document.getElementById('autoRecord'),
            playBtn: document.getElementById('playBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            stopBtn: document.getElementById('stopBtn'),
            speedInput: document.getElementById('speedInput'),
            clearTimelineBtn: document.getElementById('clearTimelineBtn'),
            exportTimelineBtn: document.getElementById('exportTimelineBtn'),
            importTimelineBtn: document.getElementById('importTimelineBtn'),
            frameCountEl: document.getElementById('frameCount'),
            scrubber: document.getElementById('scrubber'),
            scrubberVal: document.getElementById('scrubberVal'),
            frameTotal: document.getElementById('frameTotal'),
            prevFrameBtn: document.getElementById('prevFrameBtn'),
            nextFrameBtn: document.getElementById('nextFrameBtn'),
            playNameInput: document.getElementById('playName'),
            loadPlaySel: document.getElementById('loadPlay'),
            savePlayBtn: document.getElementById('savePlay'),
            duplicatePlayBtn: document.getElementById('duplicatePlay'),
            deletePlayBtn: document.getElementById('deletePlay'),
            btnLoadPlay: document.getElementById('btnLoadPlay'),
            exportJpgBtn: document.getElementById('exportJpgBtn'),
            exportVideoBtn: document.getElementById('exportVideoBtn'),
            exportMp4Btn: document.getElementById('exportMp4Btn'),
            shareLinkBtn: document.getElementById('shareLinkBtn'),
            ffmpegStatus: document.getElementById('ffmpegStatus'),
            playerCount: document.getElementById('playerCount'),
            addPlayerBtn: document.getElementById('addPlayerBtn'),
            firebaseStatus: document.getElementById('firebaseStatus'),
            successPopup: document.getElementById('successPopup'),
            successMessage: document.getElementById('successMessage')
        };

        // --- GESTIONE PREMIUM ---
        const PremiumManager = {
            checkAndShowModal() {
                if (appState.isPremium) return true; 
                document.getElementById('premiumOverlay').style.display = 'flex';
                return false; 
            },
            initListeners() {
                document.getElementById('closePremium').addEventListener('click', () => {
                    document.getElementById('premiumOverlay').style.display = 'none';
                });
                document.getElementById('premiumOverlay').addEventListener('click', (e) => {
                    if (e.target.id === 'premiumOverlay') {
                        e.target.style.display = 'none';
                    }
                });
            }
        };

        // --- GESTIONE BRANDING (Colori e Logo) ---
        const BrandingManager = {
            init() {
                // Aplicar los colores iniciales desde el CSS :root
                const initialColorA = getComputedStyle(document.documentElement).getPropertyValue('--blue').trim() || '#0d6efd';
                const initialColorB = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#e63946';

                // 1. Cargar colores guardados de localStorage y aplicar (Persistencia)
                const savedColorA = localStorage.getItem('colorTeamA');
                if (savedColorA) {
                    document.documentElement.style.setProperty('--blue', savedColorA);
                }
                const savedColorB = localStorage.getItem('colorTeamB');
                if (savedColorB) {
                    document.documentElement.style.setProperty('--red', savedColorB);
                }
                
                // 2. Aplicar listeners a los inputs de color (Interacción)
                const colorTeamA = document.getElementById('colorTeamA');
                const colorTeamB = document.getElementById('colorTeamB');
                
                if(colorTeamA) {
                    colorTeamA.value = savedColorA || initialColorA; // Asegurar que el input refleje el color
                    colorTeamA.addEventListener('input', (e) => {
                        document.documentElement.style.setProperty('--blue', e.target.value);
                        localStorage.setItem('colorTeamA', e.target.value);
                    });
                }

                if(colorTeamB) {
                    colorTeamB.value = savedColorB || initialColorB;
                    colorTeamB.addEventListener('input', (e) => {
                        document.documentElement.style.setProperty('--red', e.target.value);
                        localStorage.setItem('colorTeamB', e.target.value);
                    });
                }
                

                // 3. LOGICA DE SUBIDA DE LOGO
                const logoUpload = document.getElementById('logoUpload');
                const removeLogoBtn = document.getElementById('removeLogoBtn');
                const clubLogoImg = document.getElementById('clubLogo');
                
                if(logoUpload) {
                    logoUpload.addEventListener('change', (e) => {
                        if (!appState.isPremium) {
                            document.getElementById('premiumOverlay').style.display = 'flex';
                            e.target.value = ''; // Pulisce input
                            return;
                        }
                        
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                if(clubLogoImg) clubLogoImg.src = ev.target.result;
                                if(clubLogoImg) clubLogoImg.style.display = 'block';
                                if(removeLogoBtn) removeLogoBtn.style.display = 'block';
                                localStorage.setItem('clubLogo', ev.target.result);
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                }

                // Rimuovi Logo
                if(removeLogoBtn) {
                    removeLogoBtn.addEventListener('click', () => {
                        if(clubLogoImg) clubLogoImg.src = '';
                        if(clubLogoImg) clubLogoImg.style.display = 'none';
                        removeLogoBtn.style.display = 'none';
                        localStorage.removeItem('clubLogo');
                        if(logoUpload) logoUpload.value = '';
                    });
                }

                // 4. Carica logo guardato si existe
                const savedLogo = localStorage.getItem('clubLogo');
                if (savedLogo && clubLogoImg) {
                    clubLogoImg.src = savedLogo;
                    clubLogoImg.style.display = 'block';
                    if(removeLogoBtn) removeLogoBtn.style.display = 'block';
                }
            }
        };


        const AuthManager = {
            async init() {
                try {
                    app = initializeApp(firebaseConfig);
                    db = getFirestore(app);
                    auth = getAuth(app);
                    
                    console.log('✅ Firebase inizializzato correttamente');
                    
                    onAuthStateChanged(auth, async (user) => {
                        currentUser = user;
                        if (user) {
                            isAuthorized = true;
                            AuthManager.showApp();
                            AuthManager.updateUI(true);
                            AuthManager.showStatus(`Benvenuto ${user.email}!`, 'success');
                            
                            const buyBtn = document.getElementById('btnBuyPremium');
                            if (buyBtn) {
                                buyBtn.onclick = () => {
                                    const checkoutUrl = `${STRIPE_URL}?client_reference_id=${user.uid}&prefilled_email=${user.email}`;
                                    window.open(checkoutUrl, '_blank');
                                };
                            }

                            const userRef = doc(db, "users", user.uid);
                            try {
                                const userSnap = await getDoc(userRef);
                                if (!userSnap.exists()) {
                                    await setDoc(userRef, { email: user.email, isPremium: false, createdAt: new Date() });
                                }
                            } catch (e) { console.log("Errore controllo utente", e); }

                            onSnapshot(userRef, (docSnap) => {
                                if (docSnap.exists()) {
                                    const data = docSnap.data();
                                    appState.isPremium = data.isPremium === true; 
                                    
                                    // CORRECCIÓN FIREBASE STATUS: Si la conexión es exitosa, ocultamos la alerta roja.
                                    AuthManager.updateFirebaseStatus(true); 

                                    const sidebarBtn = document.getElementById('btnSidebarPro');

                                    if (appState.isPremium) {
                                        console.log("🌟 UTENTE PREMIUM RILEVATO");
                                        document.getElementById('premiumOverlay').style.display = 'none'; 
                                        if (sidebarBtn) sidebarBtn.style.display = 'none';
                                        
                                        const uploadLabel = document.getElementById('btnUploadLogoLabel');
                                        if(uploadLabel) uploadLabel.classList.remove('alt');

                                    } else {
                                        if (sidebarBtn) sidebarBtn.style.display = 'flex';
                                        const uploadLabel = document.getElementById('btnUploadLogoLabel');
                                        if(uploadLabel) uploadLabel.classList.add('alt');
                                    }
                                }
                            });
                            
                            console.log('🔐 Utente autenticato, test connessione Firebase...');
                            await AuthManager.testFirebaseConnection(); 
                            
                            // Llamada a Branding Manager (CORREGIDA)
                            BrandingManager.init(); 

                            InteractionManager.enableSelectionBox();
                            InteractionManager.reinitializePlayerInteractions();
                            UnitsManager.enableDragBall(() => { 
                                StorageManager.saveBall(); 
                                if (dom.autoRecordChk.checked) {
                                    if (!PremiumManager.checkAndShowModal()) {
                                        dom.autoRecordChk.checked = false; 
                                        return;
                                    }
                                    TimelineManager.recordFrame(); 
                                }
                            });
                            StorageManager.updatePlaySelect();
                            DrawManager.enableDrawing();
                        } else {
                            isAuthorized = false;
                            firebaseConnected = false;
                            AuthManager.showLogin();
                            AuthManager.updateUI(false);
                        }
                    });
                    
                } catch (error) {
                    console.error("Firebase fallito:", error);
                    AuthManager.showLogin();
                    AuthManager.showStatus('Errore di connessione. Riprova più tardi.', 'error');
                    AuthManager.updateFirebaseStatus(false);
                }
            },

            async testFirebaseConnection() { 
                 try { 
                    const user = auth.currentUser; 
                    if (!user) return false; 
                    const testQuery = query(collection(db, "users", user.uid, "plays")); 
                    const querySnapshot = await getDocs(testQuery); 
                    firebaseConnected = true; 
                    AuthManager.updateFirebaseStatus(true); // Éxito en conexión
                    return true; 
                 } catch (error) { 
                    firebaseConnected = false; 
                    AuthManager.updateFirebaseStatus(false, error); 
                    return false; 
                 } 
            },
            updateFirebaseStatus(connected, error = null) { 
                firebaseConnected = connected; 
                if (connected) { 
                    dom.firebaseStatus.textContent = '✅ Firebase: Connesso e funzionante'; 
                    dom.firebaseStatus.className = 'firebase-status connected'; 
                } else { 
                    let errorMessage = '⚠️ Configura Firebase Console'; 
                    if (error) errorMessage += ` - ${error.code || 'Errore sconosciuto'}`; 
                    dom.firebaseStatus.innerHTML = `
                        <div style="background: var(--red); color: white; padding: 5px; border-radius: 5px;">
                           ${errorMessage}
                        </div>`;
                    dom.firebaseStatus.className = 'firebase-status disconnected'; 
                } 
            },
            showLogin() { dom.loginOverlay.style.display = 'flex'; dom.mainApp.style.display = 'none'; dom.menuBtn.style.display = 'none'; },
            showApp() { dom.loginOverlay.style.display = 'none'; dom.mainApp.style.display = 'grid'; if (window.innerWidth <= 900) dom.menuBtn.style.display = 'grid'; document.body.classList.add('main-app-visible'); },
            updateUI(isLoggedIn) { if (isLoggedIn && currentUser) { dom.btnAuthAction.style.display = 'block'; dom.btnAuthAction.textContent = 'Esci'; dom.statusDot.className = 'status-dot'; dom.statusText.textContent = currentUser.email; AuthManager.setControlsEnabled(true); } else { dom.btnAuthAction.style.display = 'none'; dom.statusDot.className = 'status-dot error'; dom.statusText.textContent = 'Non autenticato'; AuthManager.setControlsEnabled(false); } },
            setControlsEnabled(enabled) { const controls = [dom.resetBtn, dom.toolSelectBtn, dom.toolArrowsBtn, dom.toolPenBtn, dom.undoGenericBtn, dom.clearArrowsBtn, dom.clearAllBtn, dom.recordStepBtn, dom.savePlayBtn, dom.duplicatePlayBtn, dom.deletePlayBtn, dom.btnLoadPlay, dom.addPlayerBtn]; controls.forEach(control => { if (control) control.disabled = !enabled; }); if (dom.strokeColorSel) dom.strokeColorSel.disabled = !enabled; if (dom.strokeWidthSel) dom.strokeWidthSel.disabled = !enabled; if (dom.dashedToggle) dom.dashedToggle.disabled = !enabled; },
            async loginWithGoogle() { const provider = new GoogleAuthProvider(); try { await signInWithPopup(auth, provider); AuthManager.showMessage("Accesso Google riuscito", 'success'); } catch (error) { AuthManager.showMessage("Errore login Google: " + error.message, 'error'); } },
            async registerWithEmail() { const email = dom.loginEmail.value; const password = dom.loginPassword.value; if (!email || !password) { AuthManager.showMessage("Inserisci email e password.", 'error'); return; } dom.btnLogin.disabled = true; dom.btnRegister.disabled = true; try { await createUserWithEmailAndPassword(auth, email, password); AuthManager.showMessage("Account creato!", 'success'); } catch (error) { AuthManager.showMessage("Errore registrazione: " + error.code, 'error'); } finally { dom.btnLogin.disabled = false; dom.btnRegister.disabled = false; } },
            async login() { const email = dom.loginEmail.value; const password = dom.loginPassword.value; if (!email || !password) { AuthManager.showMessage("Inserisci email e password.", 'error'); return; } dom.btnLogin.disabled = true; AuthManager.showMessage("Accesso in corso...", 'info'); try { await signInWithEmailAndPassword(auth, email, password); AuthManager.showMessage("", 'success'); } catch (error) { AuthManager.showMessage("Credenziali non valide.", 'error'); } finally { dom.btnLogin.disabled = false; } },
            async logout() { try { await signOut(auth); AuthManager.showMessage('Sessione chiusa', 'info'); AuthManager.showLogin(); } catch (error) { console.error(error); } },
            showMessage(message, type = 'info') { dom.loginMessage.textContent = message; dom.loginMessage.className = 'login-message'; if (type === 'error') dom.loginMessage.classList.add('login-error'); if (type === 'success') dom.loginMessage.classList.add('login-success'); },
            showStatus(message, type = 'info') { console.log(`[${type.toUpperCase()}] ${message}`); }
        };

        // --- UTILITÀ (El resto de funciones se mantienen igual) ---

        function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); }
        function centerOf(el) { return { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 }; }
        function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
        function lerp(a, b, t) { return a + (b - a) * t; }
        function ballOverPlayer(playerEl, threshold = 28) { const b = centerOf(dom.ball); const p = centerOf(playerEl); return dist(b.x, b.y, p.x, p.y) < threshold; }
        function snap(val) { return Math.round(val / GRID_SIZE) * GRID_SIZE; }

        const PopupManager = {
            showSuccess(message) { dom.successMessage.textContent = message; dom.successPopup.classList.remove('hide'); dom.successPopup.classList.add('show'); setTimeout(() => { PopupManager.hideSuccess(); }, 3000); },
            hideSuccess() { dom.successPopup.classList.remove('show'); dom.successPopup.classList.add('hide'); }
        };

        const LayoutManager = {
            isPortraitLike() { if (appState.layout.forceVertical) return true; const mq = window.matchMedia('(orientation: portrait)'); return (mq && mq.matches) || (window.innerHeight > window.innerWidth); },
            applyUprightTransforms() { const rotatePlayers = (appState.layout.mode === 'portrait'); [...dom.playersLayer.children].forEach(el => { el.style.transform = rotatePlayers ? 'translate(-50%, -50%) rotate(-90deg)' : 'translate(-50%, -50%)'; }); },
            fitBoard() {
                const vp = dom.boardViewport.getBoundingClientRect(); const availW = vp.width; const availH = vp.height;
                if (!LayoutManager.isPortraitLike()) { appState.layout.mode = 'landscape'; appState.layout.scale = Math.min(availW / WIDTH, availH / HEIGHT); const scaledW = WIDTH * appState.layout.scale; const scaledH = HEIGHT * appState.layout.scale; appState.layout.tx = (availW - scaledW) / 2; appState.layout.ty = (availH - scaledH) / 2; dom.boardWrap.style.transform = `translate(${appState.layout.tx}px, ${appState.layout.ty}px) rotate(0deg) scale(${appState.layout.scale})`; dom.boardWrap.style.transformOrigin = 'top left'; } 
                else { appState.layout.mode = 'portrait'; const rotW = HEIGHT; const rotH = WIDTH; appState.layout.scale = Math.min(availW / rotW, availH / rotH); const contentW = rotW * appState.layout.scale; const contentH = rotH * appState.layout.scale; const txCenter = (availW - contentW) / 2; const tyCenter = (availH - contentH) / 2; appState.layout.tx = txCenter + contentW; appState.layout.ty = tyCenter; dom.boardWrap.style.transform = `translate(${appState.layout.tx}px, ${appState.layout.ty}px) rotate(90deg) scale(${appState.layout.scale})`; dom.boardWrap.style.transformOrigin = 'top left'; }
                LayoutManager.applyUprightTransforms();
            },
            clientToBoard(e) {
                const vp = dom.boardViewport.getBoundingClientRect(); const cx = e.clientX - vp.left; const cy = e.clientY - vp.top;
                if (appState.layout.mode === 'portrait') { const x_raw = (cx - appState.layout.tx); const y_raw = (cy - appState.layout.ty); const px = y_raw / appState.layout.scale; const py = -x_raw / appState.layout.scale; return { x: clamp(px, 0, WIDTH), y: clamp(py, 0, HEIGHT) }; } 
                else { const x = (e.clientX - vp.left - appState.layout.tx) / appState.layout.scale; const y = (e.clientY - vp.top - appState.layout.ty) / appState.layout.scale; return { x: clamp(x, 0, WIDTH), y: clamp(y, 0, HEIGHT) }; }
            },
            deltaToBoard(dxClient, dyClient) {
                if (appState.layout.mode === 'portrait') { return { dx: dyClient / appState.layout.scale, dy: -dxClient / appState.layout.scale }; } 
                else { const rect = dom.board.getBoundingClientRect(); const scale = rect.width / WIDTH; return { dx: dxClient / scale, dy: dyClient / scale }; }
            },
            renderGrid() {
                const s = GRID_SIZE; dom.gridSvg.innerHTML = ''; const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                for (let x = s; x < WIDTH; x += s) { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('x1', x); l.setAttribute('y1', 0); l.setAttribute('x2', x); l.setAttribute('y2', HEIGHT); l.setAttribute('stroke', 'var(--grid)'); l.setAttribute('stroke-width', '1'); g.appendChild(l); }
                for (let y = s; y < HEIGHT; y += s) { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('x1', 0); l.setAttribute('y1', y); l.setAttribute('x2', WIDTH); l.setAttribute('y2', y); l.setAttribute('stroke', 'var(--grid)'); l.setAttribute('stroke-width', '1'); g.appendChild(l); }
                dom.gridSvg.appendChild(g); dom.gridSvg.classList.toggle('active', dom.snapToggle.checked);
            }
        };

        const UnitsManager = {
            initialPositions: (function () { const positions = []; for (let i = 1; i <= 15; i++) positions.push({ team: 'blue', number: i, x: WIDTH * 0.18, y: HEIGHT * (0.1 + (i - 1) * (0.8 / 14)) }); for (let i = 1; i <= 15; i++) positions.push({ team: 'red', number: i, x: WIDTH * 0.82, y: HEIGHT * (0.1 + (i - 1) * (0.8 / 14)) }); return positions; })(),
            countPlayers() { const players = [...dom.playersLayer.children]; const blueCount = players.filter(p => p.dataset.team === 'blue').length; const redCount = players.filter(p => p.dataset.team === 'red').length; appState.playerCounter.blue = blueCount; appState.playerCounter.red = redCount; const total = blueCount + redCount; dom.playerCount.textContent = total; dom.addPlayerBtn.disabled = total >= 30; dom.addPlayerBtn.textContent = total >= 30 ? 'Massimo 15 giocatori' : '+ Aggiungi Giocatore'; return { blue: blueCount, red: redCount, total }; },
            addPlayer() { const counts = this.countPlayers(); if (counts.total >= 30) { alert('Massimo 30 giocatori raggiunto! (15 blu + 15 rossi)'); return null; } const team = counts.blue <= counts.red ? 'blue' : 'red'; const newNumber = counts[team] + 1; const x = team === 'blue' ? WIDTH * 0.18 : WIDTH * 0.82; const y = HEIGHT * 0.5; const playerEl = this.createPlayerElement(team, newNumber, x, y); dom.playersLayer.appendChild(playerEl); this.countPlayers(); StorageManager.savePositions(); return playerEl; },
            createPlayerElement(team, number, x, y) { const el = document.createElement('div'); el.className = `player ${team}`; el.textContent = number; el.style.left = x + 'px'; el.style.top = y + 'px'; el.dataset.number = number; el.dataset.team = team; this.enableDragPlayer(el, () => { StorageManager.savePositions(); if (dom.autoRecordChk.checked) TimelineManager.recordFrame(); }); return el; },
            createPlayers() { dom.playersLayer.innerHTML = ''; this.initialPositions.forEach(p => { dom.playersLayer.appendChild(this.createPlayerElement(p.team, p.number, p.x, p.y)); }); this.countPlayers(); LayoutManager.applyUprightTransforms(); },
            enableDragPlayer(playerEl, onDrop) {
                if (!isAuthorized) return; let pointerId = null, startX = 0, startY = 0, origL = 0, origT = 0; let lockBallToPlayer = false; let offX = 0, offY = 0; let isGroupMove = false; let playerOffsets = []; let isDragging = false; const onDown = e => { if (appState.tool !== 'select') return; pointerId = e.pointerId; playerEl.setPointerCapture(pointerId); e.preventDefault(); startX = e.clientX; startY = e.clientY; origL = parseFloat(playerEl.style.left) || 0; origT = parseFloat(playerEl.style.top) || 0; isDragging = false; if (e.ctrlKey || e.shiftKey) { if (playerEl.classList.contains('selected')) { playerEl.classList.remove('selected'); appState.selectedPlayers.delete(playerEl); } else { playerEl.classList.add('selected'); appState.selectedPlayers.add(playerEl); } } else if (!playerEl.classList.contains('selected')) { InteractionManager.clearSelection(); playerEl.classList.add('selected'); appState.selectedPlayers.add(playerEl); } isGroupMove = appState.selectedPlayers.size > 1; if (isGroupMove) { playerOffsets = Array.from(appState.selectedPlayers).map(el => ({ el, initialX: parseFloat(el.style.left), initialY: parseFloat(el.style.top) })); } lockBallToPlayer = ballOverPlayer(playerEl); if (lockBallToPlayer) { const p0 = { x: origL, y: origT }; const b0 = centerOf(dom.ball); offX = b0.x - p0.x; offY = b0.y - p0.y; } const onMove = ev => { if (ev.pointerId !== pointerId) return; ev.preventDefault(); isDragging = true; const { dx, dy } = LayoutManager.deltaToBoard(ev.clientX - startX, ev.clientY - startY); if (isGroupMove) { playerOffsets.forEach(pl => { pl.el.style.left = clamp(pl.initialX + dx, 0, WIDTH) + 'px'; pl.el.style.top = clamp(pl.initialY + dy, 0, HEIGHT) + 'px'; }); } else { playerEl.style.left = clamp(origL + dx, 0, WIDTH) + 'px'; playerEl.style.top = clamp(origT + dy, 0, HEIGHT) + 'px'; } if (lockBallToPlayer) { const newPlayerPos = centerOf(playerEl); const bx = clamp(newPlayerPos.x + offX, 0, WIDTH); const by = clamp(newPlayerPos.y + offY, 0, HEIGHT); dom.ball.style.left = bx + 'px'; dom.ball.style.top = by + 'px'; } }; const onUp = ev => { if (ev.pointerId !== pointerId) return; try { playerEl.releasePointerCapture(pointerId); } catch { } document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); if (isDragging) { if (dom.snapToggle.checked) { const finalizePosition = (el) => { const px = snap(parseFloat(el.style.left)); const py = snap(parseFloat(el.style.top)); el.style.left = px + 'px'; el.style.top = py + 'px'; return { x: px, y: py }; }; if (isGroupMove) { playerOffsets.forEach(pl => finalizePosition(pl.el)); if (lockBallToPlayer) { const playerPos = centerOf(playerEl); const sbx = clamp(snap(playerPos.x + offX), 0, WIDTH); const sby = clamp(snap(playerPos.y + offY), 0, HEIGHT); dom.ball.style.left = sbx + 'px'; dom.ball.style.top = sby + 'px'; } } else { finalizePosition(playerEl); if (lockBallToPlayer) { const playerPos = centerOf(playerEl); const sbx = clamp(snap(playerPos.x + offX), 0, WIDTH); const sby = clamp(snap(playerPos.y + offY), 0, HEIGHT); dom.ball.style.left = sbx + 'px'; dom.ball.style.top = sby + 'px'; } } } (onDrop || (() => { }))(isGroupMove); } else { if (!e.ctrlKey && !e.shiftKey && appState.selectedPlayers.size > 1) { InteractionManager.clearSelection(); playerEl.classList.add('selected'); appState.selectedPlayers.add(playerEl); } } }; document.addEventListener('pointermove', onMove, { passive: false }); document.addEventListener('pointerup', onUp, { passive: false }); }; playerEl.addEventListener('pointerdown', onDown, { passive: false }); playerEl.ondragstart = () => false; },
            placeBall(x = WIDTH * 0.5, y = HEIGHT * 0.5) { dom.ball.style.left = x + 'px'; dom.ball.style.top = y + 'px'; dom.ball.style.transform = 'translate(-50%, -50%) rotate(-15deg)'; },
            enableDragBall(onDrop) { if (!isAuthorized) return; let pointerId = null, startX = 0, startY = 0, origL = 0, origT = 0; let passerEl = null; const onDown = e => { if (appState.tool !== 'select') return; pointerId = e.pointerId; dom.ball.setPointerCapture(pointerId); e.preventDefault(); startX = e.clientX; startY = e.clientY; origL = parseFloat(dom.ball.style.left) || 0; origT = parseFloat(dom.ball.style.top) || 0; InteractionManager.clearSelection(); const b0 = centerOf(dom.ball); passerEl = (function () { let best = null, bestD = Infinity; for (const el of dom.playersLayer.children) { const p = centerOf(el); const d = dist(b0.x, b0.y, p.x, p.y); if (d < 28 && d < bestD) { best = el; bestD = d; } } return best; })(); if (passerEl) { const p = centerOf(passerEl); UnitsManager.setPassPreview(p.x, p.y, b0.x, b0.y); } const onMove = ev => { if (ev.pointerId !== pointerId) return; ev.preventDefault(); const { dx, dy } = LayoutManager.deltaToBoard(ev.clientX - startX, ev.clientY - startY); let nx = clamp(origL + dx, 0, WIDTH); let ny = clamp(origT + dy, 0, HEIGHT); dom.ball.style.left = nx + 'px'; dom.ball.style.top = ny + 'px'; if (passerEl) { const p = centerOf(passerEl); UnitsManager.setPassPreview(p.x, p.y, nx, ny); } }; const onUp = ev => { if (ev.pointerId !== pointerId) return; try { dom.ball.releasePointerCapture(pointerId); } catch { } document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); UnitsManager.clearPassPreview(); if (dom.snapToggle.checked) { dom.ball.style.left = snap(parseFloat(dom.ball.style.left)) + 'px'; dom.ball.style.top = snap(parseFloat(dom.ball.style.top)) + 'px'; } (onDrop || (() => { }))(); }; document.addEventListener('pointermove', onMove, { passive: false }); document.addEventListener('pointerup', onUp, { passive: false }); }; dom.ball.addEventListener('pointerdown', onDown, { passive: false }); dom.ball.ondragstart = () => false; },
            setPassPreview(x1, y1, x2, y2) { let passEl = document.getElementById('passPreview'); if (!passEl) { passEl = document.createElementNS('http://www.w3.org/2000/svg', 'line'); passEl.id = 'passPreview'; passEl.setAttribute('stroke', 'var(--yellow)'); passEl.setAttribute('stroke-width', '5'); passEl.setAttribute('stroke-dasharray', '12 8'); passEl.style.pointerEvents = 'none'; dom.draw.prepend(passEl); } passEl.setAttribute('x1', x1); passEl.setAttribute('y1', y1); passEl.setAttribute('x2', x2); passEl.setAttribute('y2', y2); },
            clearPassPreview() { const passEl = document.getElementById('passPreview'); if (passEl) passEl.remove(); }
        };

        const InteractionManager = { enableSelectionBox() { if (!isAuthorized) return; let selectionPid = null; let selectionStart = null; let hasMoved = false; dom.board.addEventListener('pointerdown', (e) => { if (appState.tool !== 'select') return; if (e.target.closest('.player') || e.target.closest('#ball')) return; selectionPid = e.pointerId; dom.board.setPointerCapture(selectionPid); e.preventDefault(); selectionStart = LayoutManager.clientToBoard(e); hasMoved = false; dom.selectionBox.style.left = selectionStart.x + 'px'; dom.selectionBox.style.top = selectionStart.y + 'px'; dom.selectionBox.style.width = '0'; dom.selectionBox.style.height = '0'; if (!e.ctrlKey && !e.shiftKey) InteractionManager.clearSelection(); const onMove = (ev) => { if (ev.pointerId !== selectionPid) return; ev.preventDefault(); hasMoved = true; dom.selectionBox.style.display = 'block'; const current = LayoutManager.clientToBoard(ev); const left = Math.min(selectionStart.x, current.x); const top = Math.min(selectionStart.y, current.y); const right = Math.max(selectionStart.x, current.x); const bottom = Math.max(selectionStart.y, current.y); dom.selectionBox.style.left = left + 'px'; dom.selectionBox.style.top = top + 'px'; dom.selectionBox.style.width = (right - left) + 'px'; dom.selectionBox.style.height = (bottom - top) + 'px'; InteractionManager.selectPlayersInArea(left, top, right, bottom, e.ctrlKey || e.shiftKey); }; const onUp = (ev) => { if (ev.pointerId !== selectionPid) return; try { dom.board.releasePointerCapture(selectionPid); } catch {} document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); dom.selectionBox.style.display = 'none'; selectionPid = null; if (!hasMoved) InteractionManager.clearSelection(); }; document.addEventListener('pointermove', onMove, { passive: false }); document.addEventListener('pointerup', onUp, { passive: false }); }); }, selectPlayersInArea(left, top, right, bottom, additive = false) { if (!additive) { appState.selectedPlayers.forEach(player => player.classList.remove('selected')); appState.selectedPlayers.clear(); } [...dom.playersLayer.children].forEach(player => { const playerX = parseFloat(player.style.left); const playerY = parseFloat(player.style.top); const radius = 20; const isOver = (playerX + radius >= left && playerX - radius <= right && playerY + radius >= top && playerY - radius <= bottom); if (isOver) { if (!player.classList.contains('selected')) { player.classList.add('selected'); appState.selectedPlayers.add(player); } } else if (!additive) { if (player.classList.contains('selected')) { player.classList.remove('selected'); appState.selectedPlayers.delete(player); } } }); }, clearSelection() { appState.selectedPlayers.forEach(player => player.classList.remove('selected')); appState.selectedPlayers.clear(); }, reinitializePlayerInteractions() { if (!isAuthorized) return; [...dom.playersLayer.children].forEach(player => { const newPlayer = player.cloneNode(true); player.parentNode.replaceChild(newPlayer, player); UnitsManager.enableDragPlayer(newPlayer, (isGroupMove) => { StorageManager.savePositions(); if (dom.autoRecordChk.checked && !isGroupMove) TimelineManager.recordFrame(); }); }); } };
        const ToolManager = { setTool(tool) { if (!isAuthorized) return; appState.tool = tool; dom.toolSelectBtn.classList.remove('active', 'alt'); dom.toolArrowsBtn.classList.remove('active', 'alt'); dom.toolPenBtn.classList.remove('active', 'alt'); if (tool === 'select') { dom.toolSelectBtn.classList.add('active'); dom.toolArrowsBtn.classList.add('alt'); dom.toolPenBtn.classList.add('alt'); dom.toolSelectBtn.textContent = 'Selezione: Attivo'; dom.toolArrowsBtn.textContent = 'Frecce'; dom.toolPenBtn.textContent = 'Matita'; dom.draw.style.pointerEvents = 'none'; } else if (tool === 'arrows') { dom.toolArrowsBtn.classList.add('active'); dom.toolSelectBtn.classList.add('alt'); dom.toolPenBtn.classList.add('alt'); dom.toolArrowsBtn.textContent = 'Frecce: Attivo'; dom.toolSelectBtn.textContent = 'Selezione'; dom.toolPenBtn.textContent = 'Matita'; dom.draw.style.pointerEvents = 'auto'; } else if (tool === 'pen') { dom.toolPenBtn.classList.add('active'); dom.toolSelectBtn.classList.add('alt'); dom.toolArrowsBtn.classList.add('alt'); dom.toolPenBtn.textContent = 'Matita: Attiva'; dom.toolSelectBtn.textContent = 'Selezione'; dom.toolArrowsBtn.textContent = 'Frecce'; dom.draw.style.pointerEvents = 'auto'; } if (tool !== 'select') InteractionManager.clearSelection(); console.log(`🛠️ Strumento cambiado a: ${tool}`); } };
        const DrawManager = { clearDraw() { if (!isAuthorized) return; dom.draw.innerHTML = ''; appState.arrows = []; appState.strokes = []; StorageManager.saveArrows(); StorageManager.saveStrokes(); }, clearArrows() { if (!isAuthorized) return; appState.arrows = []; DrawManager.renderDraw(); StorageManager.saveArrows(); }, clearStrokes() { if (!isAuthorized) return; appState.strokes = []; DrawManager.renderDraw(); StorageManager.saveStrokes(); }, undoLast() { if (!isAuthorized) return; const lastArrow = appState.arrows[appState.arrows.length - 1]; const lastStroke = appState.strokes[appState.strokes.length - 1]; const lastArrowTime = lastArrow ? lastArrow.timestamp || 0 : 0; const lastStrokeTime = lastStroke ? lastStroke.timestamp || 0 : 0; if (lastArrowTime > lastStrokeTime) { appState.arrows.pop(); StorageManager.saveArrows(); } else if (lastStrokeTime > 0) { appState.strokes.pop(); StorageManager.saveStrokes(); } DrawManager.renderDraw(); }, renderDraw() { dom.draw.innerHTML = ''; let defs = dom.draw.querySelector('defs'); if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); dom.draw.appendChild(defs); } defs.innerHTML = ''; appState.strokes.forEach(stroke => { const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); const points = stroke.points.map(p => `${p.x},${p.y}`).join(' '); polyline.setAttribute('points', points); polyline.setAttribute('fill', 'none'); polyline.setAttribute('stroke', stroke.color); polyline.setAttribute('stroke-width', stroke.width); polyline.setAttribute('stroke-linecap', 'round'); polyline.setAttribute('stroke-linejoin', 'round'); if (stroke.dashed) polyline.setAttribute('stroke-dasharray', '12 8'); dom.draw.appendChild(polyline); }); appState.arrows.forEach((arrow, index) => { const markerId = `arrowHead-${arrow.color.replace('#', '')}-${arrow.width}`; if (!defs.querySelector(`#${markerId}`)) { const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker'); marker.setAttribute('id', markerId); marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '10'); marker.setAttribute('refY', '5'); marker.setAttribute('markerUnits', 'strokeWidth'); marker.setAttribute('markerWidth', parseFloat(arrow.width) * 0.7); marker.setAttribute('markerHeight', parseFloat(arrow.width) * 0.7); marker.setAttribute('orient', 'auto-start-reverse'); const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); path.setAttribute('fill', arrow.color); marker.appendChild(path); defs.appendChild(marker); } const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); line.setAttribute('x1', arrow.x1); line.setAttribute('y1', arrow.y1); line.setAttribute('x2', arrow.x2); line.setAttribute('y2', arrow.y2); line.setAttribute('stroke', arrow.color); line.setAttribute('stroke-width', arrow.width); line.setAttribute('stroke-linecap', 'round'); if (arrow.dashed) line.setAttribute('stroke-dasharray', '12 8'); line.setAttribute('marker-end', `url(#${markerId})`); dom.draw.appendChild(line); }); UnitsManager.clearPassPreview(); }, enableDrawing() { dom.draw.removeEventListener('pointerdown', DrawManager.onPointerDown, { passive: false }); dom.draw.removeEventListener('pointerup', DrawManager.onPointerUp, { passive: false }); dom.draw.addEventListener('pointerdown', DrawManager.onPointerDown, { passive: false }); dom.draw.addEventListener('pointerup', DrawManager.onPointerUp, { passive: false }); }, onPointerDown(e) { if (!isAuthorized) return; if (e.button !== 0) return; if (appState.tool === 'select') return; if (e.target.closest('.player') || e.target.closest('#ball')) return; e.preventDefault(); let pointerId = e.pointerId; let startPoint = LayoutManager.clientToBoard(e); if (appState.tool === 'arrows') { appState.drawingArrow = true; DrawManager.drawArrowPreview(startPoint.x, startPoint.y, startPoint.x, startPoint.y); } else if (appState.tool === 'pen') { appState.drawingStroke = true; appState.currentStroke = { points: [{ x: startPoint.x, y: startPoint.y }], color: dom.strokeColorSel.value, width: dom.strokeWidthSel.value, dashed: dom.dashedToggle.checked, timestamp: Date.now() }; } dom.draw.setPointerCapture(pointerId); const onMove = ev => { if (ev.pointerId !== pointerId) return; ev.preventDefault(); const { x, y } = LayoutManager.clientToBoard(ev); const currX = clamp(x, 0, WIDTH); const currY = clamp(y, 0, HEIGHT); if (appState.tool === 'arrows' && appState.drawingArrow) { DrawManager.drawArrowPreview(startPoint.x, startPoint.y, currX, currY); } else if (appState.tool === 'pen' && appState.drawingStroke) { const lastPoint = appState.currentStroke.points[appState.currentStroke.points.length - 1]; if (dist(lastPoint.x, lastPoint.y, currX, currY) > 5) { appState.currentStroke.points.push({ x: currX, y: currY }); DrawManager.drawStrokePreview(appState.currentStroke); } } }; const onUp = ev => { if (ev.pointerId !== pointerId) return; try { dom.draw.releasePointerCapture(pointerId); } catch {} dom.draw.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); dom.draw.removeEventListener('pointerleave', onUp); DrawManager.clearPreview(); const { x, y } = LayoutManager.clientToBoard(ev); const endX = clamp(x, 0, WIDTH); const endY = clamp(y, 0, HEIGHT); if (appState.tool === 'arrows' && appState.drawingArrow) { if (dist(startPoint.x, startPoint.y, endX, endY) > 10) { appState.arrows.push({ x1: startPoint.x, y1: startPoint.y, x2: endX, y2: endY, color: dom.strokeColorSel.value, width: dom.strokeWidthSel.value, dashed: dom.dashedToggle.checked, timestamp: Date.now() }); StorageManager.saveArrows(); } appState.drawingArrow = false; } else if (appState.tool === 'pen' && appState.drawingStroke) { if (appState.currentStroke.points.length > 1) { appState.strokes.push(appState.currentStroke); StorageManager.saveStrokes(); } appState.drawingStroke = false; appState.currentStroke = null; } DrawManager.renderDraw(); if (dom.autoRecordChk.checked) { if (!PremiumManager.checkAndShowModal()) { dom.autoRecordChk.checked = false; return; } TimelineManager.recordFrame(); } }; dom.draw.addEventListener('pointermove', onMove, { passive: false }); dom.draw.addEventListener('pointerup', onUp, { passive: false }); dom.draw.addEventListener('pointerleave', onUp, { passive: false }); }, drawArrowPreview(x1, y1, x2, y2) { let line = document.getElementById('arrowPreviewLine'); let head = document.getElementById('arrowPreviewHead'); if (!line) { line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); head = document.createElementNS('http://www.w3.org/2000/svg', 'polygon'); line.id = 'arrowPreviewLine'; head.id = 'arrowPreviewHead'; dom.draw.appendChild(line); dom.draw.appendChild(head); } const color = dom.strokeColorSel.value; const width = parseFloat(dom.strokeWidthSel.value); const dashed = dom.dashedToggle.checked; line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2); line.setAttribute('stroke', color); line.setAttribute('stroke-width', width); line.setAttribute('stroke-linecap', 'round'); if (dashed) line.setAttribute('stroke-dasharray', '12 8'); else line.removeAttribute('stroke-dasharray'); line.removeAttribute('marker-end'); const angle = Math.atan2(y2 - y1, x2 - x1); const size = width * 2.5; const points = [ `${x2},${y2}`, `${x2 - size * Math.cos(angle - Math.PI / 6)},${y2 - size * Math.sin(angle - Math.PI / 6)}`, `${x2 - size * Math.cos(angle + Math.PI / 6)},${y2 - size * Math.sin(angle + Math.PI / 6)}` ]; head.setAttribute('points', points.join(' ')); head.setAttribute('fill', color); }, drawStrokePreview(stroke) { let polyline = document.getElementById('strokePreview'); if (!polyline) { polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); polyline.id = 'strokePreview'; dom.draw.appendChild(polyline); } const points = stroke.points.map(p => `${p.x},${p.y}`).join(' '); polyline.setAttribute('points', points); polyline.setAttribute('fill', 'none'); polyline.setAttribute('stroke', stroke.color); polyline.setAttribute('stroke-width', stroke.width); polyline.setAttribute('stroke-linecap', 'round'); polyline.setAttribute('stroke-linejoin', 'round'); if (stroke.dashed) polyline.setAttribute('stroke-dasharray', '12 8'); else polyline.removeAttribute('stroke-dasharray'); }, clearPreview() { const arr = document.getElementById('arrowPreviewLine'); if (arr) arr.remove(); const head = document.getElementById('arrowPreviewHead'); if (head) head.remove(); const strk = document.getElementById('strokePreview'); if (strk) strk.remove(); }, onPointerUp(e) { } };
        const TimelineManager = { recordFrame() { if (!isAuthorized) return; const players = [...dom.playersLayer.children].map(el => ({ team: el.dataset.team, number: +el.dataset.number, x: parseFloat(el.style.left), y: parseFloat(el.style.top) })); const ball = { x: parseFloat(dom.ball.style.left) || WIDTH / 2, y: parseFloat(dom.ball.style.top) || HEIGHT / 2 }; const arrows = JSON.parse(JSON.stringify(appState.arrows)); const strokes = JSON.parse(JSON.stringify(appState.strokes)); const newFrame = { players, ball, arrows, strokes }; if (appState.playing) { appState.timeline.push(newFrame); appState.playIndex = appState.timeline.length - 1; } else if (appState.playIndex < appState.timeline.length) { appState.timeline.splice(appState.playIndex + 1, appState.timeline.length, newFrame); appState.playIndex++; } else { appState.timeline.push(newFrame); appState.playIndex = appState.timeline.length - 1; } TimelineManager.updateScrubber(); StorageManager.saveTimeline(); }, clearTimeline() { if (!isAuthorized) return; if (!confirm('¿Estás seguro de que quieres eliminar la animación?')) return; appState.timeline = []; appState.playIndex = 0; TimelineManager.updateScrubber(); StorageManager.saveTimeline(); }, renderInterpolatedFrame(fromIndex, t) { if (isNaN(t)) t = 0; if (t < 0) t = 0; if (t > 1) t = 1; const f0 = appState.timeline[fromIndex]; const f1 = appState.timeline[fromIndex + 1]; if (!f0 || !f1) { if (f0) TimelineManager.loadFrame(fromIndex); return; } const playersMap = new Map(); [...dom.playersLayer.children].forEach(el => playersMap.set(el.dataset.team + el.dataset.number, el)); f0.players.forEach(p0 => { const el = playersMap.get(p0.team + p0.number); if (el) { const p1 = f1.players.find(pp => pp.team === p0.team && pp.number === p0.number) || p0; const ix = lerp(p0.x, p1.x, t); const iy = lerp(p0.y, p1.y, t); el.style.left = ix + 'px'; el.style.top = iy + 'px'; } }); const bx = lerp(f0.ball.x, f1.ball.x, t); const by = lerp(f0.ball.y, f1.ball.y, t); UnitsManager.placeBall(bx, by); appState.arrows = JSON.parse(JSON.stringify(f0.arrows)); appState.strokes = JSON.parse(JSON.stringify(f0.strokes)); DrawManager.renderDraw(); appState.playIndex = fromIndex; TimelineManager.updateScrubber(); LayoutManager.applyUprightTransforms(); }, loadFrame(index) { index = clamp(index, 0, appState.timeline.length > 0 ? appState.timeline.length - 1 : 0); const frame = appState.timeline[index]; if (!frame) return; const playersMap = new Map(); [...dom.playersLayer.children].forEach(el => playersMap.set(el.dataset.team + el.dataset.number, el)); frame.players.forEach(p => { const el = playersMap.get(p.team + p.number); if (el) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; } }); UnitsManager.placeBall(frame.ball.x, frame.ball.y); appState.arrows = JSON.parse(JSON.stringify(frame.arrows)); appState.strokes = JSON.parse(JSON.stringify(frame.strokes)); DrawManager.renderDraw(); appState.playIndex = index; TimelineManager.updateScrubber(); LayoutManager.applyUprightTransforms(); if (!appState.playing) { StorageManager.savePositions(); StorageManager.saveBall(); StorageManager.saveArrows(); StorageManager.saveStrokes(); } }, updateScrubber() { const count = appState.timeline.length; dom.frameCountEl.textContent = count; dom.frameTotal.textContent = count; dom.scrubber.max = Math.max(0, count - 1); dom.scrubber.value = appState.playIndex; dom.scrubberVal.textContent = appState.playIndex; if (count === 0) dom.scrubber.value = 0; }, handleScrubberChange(e) { const index = parseInt(e.target.value); if (index < appState.timeline.length) { TimelineManager.loadFrame(index); } }, play(timestamp) { if (!appState.playing || appState.timeline.length < 2) { appState.playing = false; appState.paused = false; dom.playBtn.textContent = 'Play'; return; } if (appState.paused) return; const dur = (isNaN(appState.segmentDuration) || appState.segmentDuration < 16) ? 800 : appState.segmentDuration; if (appState.fromFrame == null) { if (isNaN(appState.playIndex) || appState.playIndex < 0 || appState.playIndex >= appState.timeline.length - 1) { appState.playIndex = 0; } appState.fromFrame = appState.playIndex; appState.segmentStartTime = timestamp; TimelineManager.loadFrame(appState.fromFrame); } if (appState.fromFrame >= appState.timeline.length - 1) { appState.playing = false; appState.paused = false; appState.fromFrame = null; dom.playBtn.textContent = 'Play'; TimelineManager.updateScrubber(); return; } const elapsed = timestamp - appState.segmentStartTime; let t = elapsed / dur; if (t >= 1) { appState.fromFrame += 1; appState.playIndex = appState.fromFrame; appState.segmentStartTime = timestamp; if (appState.fromFrame >= appState.timeline.length - 1) { TimelineManager.loadFrame(appState.fromFrame); appState.playing = false; appState.paused = false; appState.fromFrame = null; dom.playBtn.textContent = 'Play'; TimelineManager.updateScrubber(); return; } else { TimelineManager.renderInterpolatedFrame(appState.fromFrame, 0); } } else { TimelineManager.renderInterpolatedFrame(appState.fromFrame, t); } appState.rafId = requestAnimationFrame(TimelineManager.play); }, startPlay() { if (appState.timeline.length < 2) return; const val = parseInt(dom.speedInput.value); appState.segmentDuration = (isNaN(val) || val < 16) ? 800 : val; appState.playing = true; appState.paused = false; if (appState.fromFrame === null) appState.playIndex = 0; appState.fromFrame = null; dom.playBtn.textContent = 'Playing...'; dom.pauseBtn.textContent = 'Pausa'; cancelAnimationFrame(appState.rafId); appState.rafId = requestAnimationFrame(TimelineManager.play); }, pausePlay() { if (!appState.playing) return; appState.paused = true; try { cancelAnimationFrame(appState.rafId); } catch (e) {} dom.playBtn.textContent = 'Riprendi'; dom.pauseBtn.textContent = 'Pausa: Attiva'; }, stopPlay() { appState.playing = false; appState.paused = false; appState.fromFrame = null; try { cancelAnimationFrame(appState.rafId); } catch (e) {} appState.fromFrame = null; dom.playBtn.textContent = 'Play'; dom.pauseBtn.textContent = 'Pausa'; cancelAnimationFrame(appState.rafId); TimelineManager.loadFrame(0); } };
        const StorageManager = { async savePlay() { if (!isAuthorized || !currentUser) { alert('🔴 Usuario no autenticado'); return; } const name = dom.playNameInput.value?.trim(); if (!name) { alert('❌ Inserisci un nome per la giocata.'); return; } if (appState.timeline.length === 0) { alert('❌ Aggiungi almeno un frame all\'animazione.'); return; } const playData = { name, timeline: appState.timeline, arrows: appState.arrows, strokes: appState.strokes, positions: [...dom.playersLayer.children].map(el => ({ team: el.dataset.team, number: +el.dataset.number, x: parseFloat(el.style.left), y: parseFloat(el.style.top) })), ball: centerOf(dom.ball), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: currentUser.uid, email: currentUser.email }; if (firebaseConnected && db) { try { const playRef = doc(db, "users", currentUser.uid, "plays", name); await setDoc(playRef, playData); PopupManager.showSuccess(`✅ Giocata "${name}" salvata in Firebase!`); StorageManager.updatePlaySelect(); return; } catch (error) { if (error.code === 'permission-denied') { firebaseConnected = false; AuthManager.updateFirebaseStatus(false, error); } } } try { localStorage.setItem(PLAY_PREFIX + name, JSON.stringify(playData)); PopupManager.showSuccess(`💾 Giocata "${name}" salvata localmente`); } catch (localError) { alert('❌ Error grave: No se pudo guardar la jugada.'); return; } StorageManager.updatePlaySelect(); }, async loadPlay(name) { try { let playData; if (db && currentUser) { try { const docRef = doc(db, "users", currentUser.uid, "plays", name); const docSnap = await getDoc(docRef); if (docSnap.exists()) { playData = docSnap.data(); localStorage.setItem(PLAY_PREFIX + name, JSON.stringify(playData)); } else { throw new Error('Documento no existe en Firebase'); } } catch (firebaseError) { if (firebaseError.code === 'permission-denied' || firebaseError.code === 'permissions-denied') { firebaseConnected = false; AuthManager.updateFirebaseStatus(false, firebaseError); } const rawData = localStorage.getItem(PLAY_PREFIX + name); if (!rawData) { alert("Giocata non trovata: " + name); return; } playData = JSON.parse(rawData); } } else { const rawData = localStorage.getItem(PLAY_PREFIX + name); if (!rawData) { alert("Giocata non trovata: " + name); return; } playData = JSON.parse(rawData); } await this.processPlayData(playData, name); } catch (error) { alert('Errore nel caricamento della giocata: ' + error.message); } }, async processPlayData(playData, name) { appState.timeline = playData.timeline || []; TimelineManager.updateScrubber(); appState.arrows = playData.arrows || []; appState.strokes = playData.strokes || []; if (appState.timeline.length > 0) { TimelineManager.loadFrame(0); } else if (playData.positions) { const playersMap = new Map(); UnitsManager.createPlayers(); [...dom.playersLayer.children].forEach(el => playersMap.set(el.dataset.team + el.dataset.number, el)); playData.positions.forEach(p => { const el = playersMap.get(p.team + p.number); if (el) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; } }); UnitsManager.placeBall(playData.ball.x, playData.ball.y); DrawManager.renderDraw(); } else { DrawManager.renderDraw(); } dom.playNameInput.value = name; StorageManager.saveTimeline(); StorageManager.saveArrows(); StorageManager.saveStrokes(); StorageManager.savePositions(); StorageManager.saveBall(); LayoutManager.applyUprightTransforms(); PopupManager.showSuccess(`✅ Giocata "${name}" caricata correttamente!`); }, async deletePlay() { if (!isAuthorized || !currentUser) return; const name = dom.loadPlaySel.value; if (name && confirm(`¿Estás seguro de que quieres eliminar la giocata "${name}"?`)) { try { if (db && firebaseConnected) await deleteDoc(doc(db, "users", currentUser.uid, "plays", name)); localStorage.removeItem(PLAY_PREFIX + name); StorageManager.updatePlaySelect(); dom.playNameInput.value = ''; PopupManager.showSuccess(`✅ Giocata "${name}" eliminata correttamente!`); } catch (error) { localStorage.removeItem(PLAY_PREFIX + name); StorageManager.updatePlaySelect(); dom.playNameInput.value = ''; PopupManager.showSuccess(`⚠️ Giocata "${name}" eliminata localmente`); } } }, async updatePlaySelect() { dom.loadPlaySel.innerHTML = '<option value="">-- Carica giocata salvata --</option>'; try { let plays = []; for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith(PLAY_PREFIX)) { const playName = key.substring(PLAY_PREFIX.length); if (!plays.includes(playName)) plays.push(playName); } } if (db && currentUser && isAuthorized) { try { const q = query(collection(db, "users", currentUser.uid, "plays"), orderBy("updatedAt", "desc")); const querySnapshot = await getDocs(q); querySnapshot.forEach((doc) => { const playName = doc.id; if (!plays.includes(playName)) plays.push(playName); }); } catch (firebaseError) { } } plays.sort().forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; dom.loadPlaySel.appendChild(option); }); } catch (error) { StorageManager.loadFromLocalStorageOnly(); } }, loadFromLocalStorageOnly() { dom.loadPlaySel.innerHTML = '<option value="">-- Carica giocata salvata --</option>'; for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith(PLAY_PREFIX)) { const option = document.createElement('option'); option.value = key.substring(PLAY_PREFIX.length); option.textContent = key.substring(PLAY_PREFIX.length); dom.loadPlaySel.appendChild(option); } } }, savePositions() { const positions = [...dom.playersLayer.children].map(el => ({ team: el.dataset.team, number: +el.dataset.number, x: parseFloat(el.style.left), y: parseFloat(el.style.top) })); localStorage.setItem(POS_KEY, JSON.stringify(positions)); }, loadPositions() { const saved = localStorage.getItem(POS_KEY); if (!saved) { UnitsManager.createPlayers(); return; } const positions = JSON.parse(saved); const playersMap = new Map(); UnitsManager.createPlayers(); [...dom.playersLayer.children].forEach(el => playersMap.set(el.dataset.team + el.dataset.number, el)); positions.forEach(p => { const el = playersMap.get(p.team + p.number); if (el) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; } }); UnitsManager.countPlayers(); LayoutManager.applyUprightTransforms(); }, saveBall() { const ball = centerOf(dom.ball); localStorage.setItem(BALL_KEY, JSON.stringify(ball)); }, loadBall() { const saved = localStorage.getItem(BALL_KEY); if (!saved) return; const pos = JSON.parse(saved); UnitsManager.placeBall(pos.x, pos.y); }, saveArrows() { localStorage.setItem(ARROW_KEY, JSON.stringify(appState.arrows)); }, loadArrows() { const saved = localStorage.getItem(ARROW_KEY); if (saved) appState.arrows = JSON.parse(saved); }, saveStrokes() { localStorage.setItem(STROKE_KEY, JSON.stringify(appState.strokes)); }, loadStrokes() { const saved = localStorage.getItem(STROKE_KEY); if (saved) appState.strokes = JSON.parse(saved); }, saveTimeline() { localStorage.setItem(TL_KEY, JSON.stringify(appState.timeline)); }, loadTimeline() { const saved = localStorage.getItem(TL_KEY); if (saved) appState.timeline = JSON.parse(saved); TimelineManager.updateScrubber(); }, exportTimeline() { const json = JSON.stringify(appState.timeline, null, 2); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = (dom.playNameInput.value?.trim() || 'lavagna') + '_animazione.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }, importTimeline() { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.onchange = e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = e => { try { const json = e.target.result; const timeline = JSON.parse(json); if (Array.isArray(timeline) && timeline.every(f => f.players && f.ball)) { appState.timeline = timeline; StorageManager.saveTimeline(); TimelineManager.loadFrame(0); alert(`Animazione importada: ${timeline.length} frames.`); } else { throw new Error("Formato JSON non valido per la timeline."); } } catch (err) { alert(`Errore nell'importazione: ${err.message}`); } }; reader.readAsText(file); }; input.click(); }, duplicatePlay() { if (!isAuthorized) return; const originalName = dom.playNameInput.value?.trim(); if (!originalName) { alert('Carica prima una giocata per duplicarla.'); return; } const newName = prompt(`Duplicar "${originalName}" como:`); if (newName && newName.trim()) { const rawData = localStorage.getItem(PLAY_PREFIX + originalName); if (rawData) { localStorage.setItem(PLAY_PREFIX + newName.trim(), rawData); dom.playNameInput.value = newName.trim(); StorageManager.savePlay(); StorageManager.updatePlaySelect(); dom.loadPlaySel.value = newName.trim(); PopupManager.showSuccess(`✅ Giocata duplicada como "${newName.trim()}".`); } else { alert(`❌ Giocata "${originalName}" non trovata in local storage.`); } } },
            async shareCurrentPlay() {
                if (!isAuthorized || !currentUser) {
                    alert('Devi effettuare il login per condividere una giocata.');
                    return;
                }
                if (!appState.isPremium) {
                    PremiumManager.checkAndShowModal();
                    return;
                }
                const name = dom.playNameInput.value?.trim();
                if (!name) {
                    alert('Dai un nome alla giocata prima di condividerla.');
                    return;
                }
                if (!Array.isArray(appState.timeline) || appState.timeline.length === 0) {
                    alert('Aggiungi almeno un frame alla giocata prima di condividerla.');
                    return;
                }

                const payload = {
                    name,
                    timeline: appState.timeline,
                    createdBy: currentUser.uid,
                    email: currentUser.email,
                    createdAt: new Date().toISOString()
                };

                try {
                    if (!db) throw new Error('Firestore non inizializzato');
                    const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
                    await setDoc(doc(db, 'sharedPlays', id), payload);
                    const url = `${window.location.origin}/viewer.html?id=${encodeURIComponent(id)}`;
                    try {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(url);
                            PopupManager.showSuccess('Link copiato negli appunti!');
                        }
                    } catch (e) {
                        console.warn('Clipboard non disponibile', e);
                    }
                    alert(`Link giocata:\n\n${url}`);
                } catch (error) {
                    console.error('Errore nella condivisione:', error);
                    alert('Errore nel creare il link condivisibile. Controlla la connessione o Firebase.');
                }
            }
 };
        const ExportManager = { async drawPitch(ctx) { ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.fillStyle = '#137a46'; ctx.fillRect(0, 0, WIDTH, HEIGHT); const svgEl = dom.board.querySelector('.lines').cloneNode(true); const drawEl = dom.draw.cloneNode(true); let tempLabels = []; if (dom.toggleLabelsBtn.classList.contains('active')) { [...dom.playersLayer.children].forEach(el => { const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.classList.add('label'); label.setAttribute('x', parseFloat(el.style.left)); label.setAttribute('y', parseFloat(el.style.top) + 20 + 5); label.setAttribute('text-anchor', 'middle'); label.setAttribute('alignment-baseline', 'central'); label.textContent = el.textContent; svgEl.appendChild(label); tempLabels.push(label); }); } while (drawEl.firstChild) { svgEl.appendChild(drawEl.firstChild); } const defs = dom.draw.querySelector('defs'); if (defs) { svgEl.prepend(defs.cloneNode(true)); } const svgData = new XMLSerializer().serializeToString(svgEl); const img = new Image(); return new Promise(resolve => { img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); }; img.onerror = (e) => { console.error("Error cargando SVG del campo en canvas:", e); resolve(); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData); }); }, drawPlayer(ctx, p) { const size = 40; const radius = size / 2; const font = 'bold 14px system-ui'; ctx.save(); ctx.translate(p.x, p.y); ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2, true); ctx.fillStyle = (p.team === 'blue' ? '#0d6efd' : '#e63946'); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.number, 0, 1); ctx.restore(); }, drawBall(ctx, b) { const W = 50; const H = 30; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-15 * Math.PI / 180); ctx.beginPath(); ctx.ellipse(0, 0, W / 2, H / 2, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffd400'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.setLineDash([8, 6]); ctx.ellipse(0, 0, W / 2 - 6, H / 2 - 6, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }, getCurrentPlayersFromDOM() { return [...dom.playersLayer.children].map(el => ({ team: el.dataset.team, number: +el.dataset.number, x: parseFloat(el.style.left), y: parseFloat(el.style.top) })); }, getCurrentBallFromDOM() { return { x: parseFloat(dom.ball.style.left) || WIDTH / 2, y: parseFloat(dom.ball.style.top) || HEIGHT / 2 }; }, async renderFrameToCanvas(frameData, includeOverlays = true) { dom.ctx.clearRect(0, 0, WIDTH, HEIGHT); await ExportManager.drawPitch(dom.ctx); frameData.players.forEach(p => ExportManager.drawPlayer(dom.ctx, p)); ExportManager.drawBall(dom.ctx, frameData.ball); }, setupExportUI() { if (!window.FFmpeg) { dom.exportMp4Btn.disabled = true; dom.exportMp4Btn.textContent = 'Exportar MP4 (instalar ffmpeg.wasm)'; } dom.exportJpgBtn.addEventListener('click', async () => { const playersNow = ExportManager.getCurrentPlayersFromDOM(); const ballNow = ExportManager.getCurrentBallFromDOM(); await ExportManager.renderFrameToCanvas({ players: playersNow, ball: ballNow }, true); const url = dom.exportCanvas.toDataURL('image/jpeg', 0.95); const a = document.createElement('a'); a.href = url; a.download = (dom.playNameInput.value?.trim() || 'lavagna') + '_frame.jpg'; document.body.appendChild(a); a.click(); a.remove(); }); dom.exportVideoBtn.addEventListener('click', async () => { if (appState.timeline.length < 2) { alert('Añade al menos 2 frames a la animación para exportar video.'); return; } if (!dom.exportCanvas.captureStream) { alert('Tu navegador no soporta Canvas.captureStream para exportar WebM.'); return; } dom.exportVideoBtn.textContent = 'Grabando... (Pulsa Stop para cancelar)'; dom.exportVideoBtn.disabled = true; TimelineManager.loadFrame(0); const duration = parseInt(dom.speedInput.value); const totalFrames = appState.timeline.length; let currentFrameIndex = 0; let isRecording = true; const finalizeExport = (chunks) => { const blob = new Blob(chunks, { type: 'video/webm' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = (dom.playNameInput.value?.trim() || 'lavagna') + '_animazione.webm'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); dom.exportVideoBtn.textContent = 'Exportar video (WebM)'; dom.exportVideoBtn.disabled = false; TimelineManager.loadFrame(0); }; const stream = dom.exportCanvas.captureStream(30); const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' }); const chunks = []; recorder.ondataavailable = e => chunks.push(e.data); recorder.onstop = () => finalizeExport(chunks); recorder.start(); const runFrame = async () => { if (currentFrameIndex >= totalFrames || !isRecording) { recorder.stop(); return; } TimelineManager.loadFrame(currentFrameIndex); await ExportManager.renderFrameToCanvas({ players: ExportManager.getCurrentPlayersFromDOM(), ball: ExportManager.getCurrentBallFromDOM() }, true); currentFrameIndex++; setTimeout(runFrame, duration); }; runFrame(); }); dom.exportMp4Btn.addEventListener('click', () => { const win = window.open('exporter_mp4.html', '_blank', 'noopener'); if (!win) { alert('No pude abrir el exportador (popup bloqueado). Permití popups para este sitio.'); return; } const payload = { timeline: appState.timeline, width: WIDTH, height: HEIGHT, segmentDuration: (isNaN(appState.segmentDuration) ? 800 : appState.segmentDuration), name: (dom.playNameInput?.value?.trim() || 'lavagna') }; function onReady(e){ if (e.source === win && e.data === 'EXPORTER_READY'){ window.removeEventListener('message', onReady); win.postMessage(payload, '*'); } } window.addEventListener('message', onReady); }); }, };

        // ===== INIT =====
        
        const UIManager = {
            setupEventListeners() {
                if (dom.shareLinkBtn) {
                    dom.shareLinkBtn.addEventListener('click', () => {
                        StorageManager.shareCurrentPlay();
                    });
                }
            }
        };

async function init(){
            try {
                await AuthManager.init();
                
                if (isAuthorized && currentUser) {
                    console.log('🎯 Inicializando pizarra...');
                    
                    LayoutManager.renderGrid(); 
                    ToolManager.setTool('select');
                    UnitsManager.createPlayers(); 
                    StorageManager.loadPositions();
                    StorageManager.loadArrows(); 
                    StorageManager.loadStrokes(); 
                    DrawManager.renderDraw();
                    UnitsManager.placeBall(WIDTH/2, HEIGHT/2); 
                    StorageManager.loadBall();
                    StorageManager.loadTimeline(); 
                    TimelineManager.updateScrubber();
                    
                    if (!Array.isArray(appState.timeline) || appState.timeline.length === 0) {
                        TimelineManager.recordFrame();
                        appState.playIndex = 0;
                        TimelineManager.updateScrubber();
                        StorageManager.saveTimeline();
                    }

                    // Habilitar el dibujo
                    DrawManager.enableDrawing();
                    
                    UnitsManager.enableDragBall(() => { 
                        StorageManager.saveBall(); 
                        if (dom.autoRecordChk.checked) TimelineManager.recordFrame(); 
                    });
                    StorageManager.updatePlaySelect();
                    LayoutManager.fitBoard();
                    
                    InteractionManager.enableSelectionBox();
                    
                    console.log('✅ Pizarra inicializada correctamente');
                }
                
                UIManager.setupEventListeners();
                console.log('✅ Event listeners configurados');
                
            } catch (error) {
                console.error('❌ Error crítico en inicialización:', error);
                alert('Error crítico al inicializar la aplicación. Recarga la página.');
            }
        }

        // Funciones de debug (sin cambios)
        window.testFirebaseDebug = async function() {
            console.log('=== DEBUG FIREBASE ===');
            console.log('App:', app);
            console.log('DB:', db);
            console.log('Auth:', auth);
            console.log('Usuario:', currentUser);
            console.log('Conectado:', firebaseConnected);
            
            try {
                if (db && currentUser) {
                    const testDoc = doc(db, "users", currentUser.uid, "plays", "test-debug");
                    await setDoc(testDoc, { 
                        test: "debug", 
                        timestamp: new Date(),
                        user: currentUser.email 
                    });
                    console.log('✅ Escritura testeada');
                    await deleteDoc(testDoc);
                    console.log('✅ Borrado testeado');
                    alert('✅ Firebase funcionando correctamente');
                } else {
                    alert('❌ Firebase no disponible');
                }
            } catch (error) {
                console.error('❌ Error en test:', error);
                alert('❌ Error: ' + error.message);
            }
        };

        window.showFirebaseStatus = function() {
            const status = {
                'App inicializada': !!app,
                'DB inicializada': !!db,
                'Auth inicializado': !!auth,
                'Usuario autenticado': !!currentUser,
                'Usuario email': currentUser?.email || 'No',
                'Firebase conectado': firebaseConnected,
                'Autorizado': isAuthorized
            };
            
            console.table(status);
            alert('Revisa la consola para el estado completo');
        };

        window.diagnoseFirebaseIssue = async function() {
            console.log('=== DIAGNÓSTICO FIREBASE DETALLADO ===');
            
            if (!currentUser) {
                console.log('❌ No hay usuario autenticado');
                return;
            }
            
            console.log('👤 Usuario:', currentUser.email);
            console.log('🔑 UID:', currentUser.uid);
            
            const testOperations = [
                { name: 'Listar jugadas', operation: () => getDocs(query(collection(db, "users", currentUser.uid, "plays"))) },
                { name: 'Leer jugada específica', operation: () => getDoc(doc(db, "users", currentUser.uid, "plays", "SCRUM")) },
                { name: 'Escribir test', operation: () => setDoc(doc(db, "users", currentUser.uid, "plays", "test-diagnostic"), { test: true, timestamp: new Date() }) }
            ];
            
            for (const op of testOperations) {
                try {
                    console.log(`🧪 Probando: ${op.name}...`);
                    const result = await op.operation();
                    console.log(`✅ ${op.name}: OK`);
                    
                    if (op.name === 'Listar jugadas' && result) {
                        console.log(`    📊 Documentos encontrados: ${result.size}`);
                        result.forEach(doc => {
                            console.log(`    - ${doc.id}:`, doc.data().name || 'sin nombre');
                        });
                    }
                } catch (error) {
                    console.error(`❌ ${op.name}:`, error.code, error.message);
                    
                    if (error.code === 'permission-denied') {
                        console.error('    🔥 PROBLEMA DE PERMISOS EN:', op.name);
                        console.error('    💡 Solución: Actualiza las reglas de Firebase para permitir:', op.name.split(' ')[0].toLowerCase());
                    }
                }
            }
            
            console.log('=== FIN DIAGNÓSTICO ===');
        };

        window.fixFirebaseConnection = async function() {
            console.log('🔄 Intentando reconectar a Firebase...');
            firebaseConnected = false;
            AuthManager.updateFirebaseStatus(false);
            
            setTimeout(async () => {
                const connected = await AuthManager.testFirebaseConnection();
                if (connected) {
                    alert('✅ Conexión a Firebase restaurada!');
                    StorageManager.updatePlaySelect();
                } else {
                    alert('❌ No se pudo conectar a Firebase. Verifica las reglas de seguridad.');
                }
            }, 1000);
        };

        init();
