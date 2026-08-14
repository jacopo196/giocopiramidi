import { state, nodes, edges } from './state.js';
import { initGameData, getSyncState, applySyncState, handleMovePiece, handleSwapCard, startGameLoop, applyNetMovePiece, applyNetSwapCard } from './game.js';

export function setupUI() {
    document.getElementById('btn-login').addEventListener('click', onLogin);
    document.getElementById('btn-cpu').addEventListener('click', onCpuMode);
    document.getElementById('btn-create-room').addEventListener('click', onOnlineMode);
    document.getElementById('btn-join-room').addEventListener('click', onJoinRoom);
    document.getElementById('btn-cambia').addEventListener('click', onSwapCardClick);
    document.getElementById('btn-back-menu').addEventListener('click', () => {
        document.getElementById('game-over-banner').style.display = 'none';
        showScreen('screen-menu');
    });
    document.getElementById('btn-start-game').addEventListener('click', onStartGameSettings);
    document.getElementById('btn-back-settings').addEventListener('click', () => {
        showScreen('screen-menu');
    });
}

let pendingMode = '';

export function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

export function showError(id, msg) {
    document.getElementById(id).innerText = msg;
}

function onLogin() {
    let un = document.getElementById('username').value.trim();
    if(un.length < 3) {
        showError('login-error', 'Username troppo corto');
        return;
    }
    
    state.username = un;
    state.authPeer = new Peer('stackgame_user_' + un.toLowerCase());
    
    state.authPeer.on('open', (id) => {
        showScreen('screen-menu');
    });
    
    state.authPeer.on('error', (err) => {
        if(err.type === 'unavailable-id') {
            showError('login-error', 'Username già in uso, sceglierne un altro.');
        } else {
            showError('login-error', 'Errore di connessione: ' + err.type);
        }
    });
}

function onCpuMode() {
    pendingMode = 'cpu';
    document.getElementById('settings-difficulty').style.display = 'block';
    showScreen('screen-settings');
}

function onOnlineMode() {
    pendingMode = 'online';
    document.getElementById('settings-difficulty').style.display = 'none';
    showScreen('screen-settings');
}

function onStartGameSettings() {
    let t = document.getElementById('select-time').value;
    state.maxTime = t === 'infinite' ? 'infinite' : parseInt(t);
    state.difficulty = document.getElementById('select-difficulty').value;
    
    if (pendingMode === 'cpu') {
        startCpuMode();
    } else if (pendingMode === 'online') {
        onCreateRoom();
    }
}

function startCpuMode() {
    state.mode = 'cpu';
    state.isHost = true;
    state.myPlayerId = 1;
    state.hostUsername = state.username;
    state.guestUsername = 'Computer';
    document.getElementById('game-over-banner').style.display = 'none';
    initGameData();
    showScreen('screen-game');
    startGameLoop();
}

function onCreateRoom() {
    state.mode = 'online';
    state.isHost = true;
    state.myPlayerId = 1;
    state.hostUsername = state.username;
    
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    state.roomCode = '';
    for(let i=0; i<3; i++) state.roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
    
    document.getElementById('menu-error').innerText = 'Codice Stanza: ' + state.roomCode + ' (in attesa...)';
    
    state.roomPeer = new Peer('stackgame_room_' + state.roomCode);
    
    state.roomPeer.on('connection', (conn) => {
        state.peerConn = conn;
        setupHostConnection();
    });
}

function onJoinRoom() {
    let code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if(code.length !== 3) {
        showError('menu-error', 'Il codice deve essere di 3 caratteri');
        return;
    }
    
    state.mode = 'online';
    state.isHost = false;
    state.myPlayerId = 2;
    state.guestUsername = state.username;
    
    document.getElementById('menu-error').innerText = 'Connessione in corso...';
    
    state.roomPeer = new Peer();
    state.roomPeer.on('open', () => {
        state.peerConn = state.roomPeer.connect('stackgame_room_' + code, { metadata: { username: state.username } });
        setupGuestConnection();
    });
    state.roomPeer.on('error', (err) => {
        showError('menu-error', 'Errore: impossibile trovare la stanza');
    });
}

function setupHostConnection() {
    state.peerConn.on('open', () => {
        state.guestUsername = state.peerConn.metadata.username || 'Avversario';
        document.getElementById('game-over-banner').style.display = 'none';
        initGameData();
        state.peerConn.send({ type: 'START_GAME', state: getSyncState() });
        showScreen('screen-game');
        startGameLoop();
    });
    
    state.peerConn.on('data', (data) => {
        handleNetworkData(data);
    });
}

function setupGuestConnection() {
    state.peerConn.on('open', () => {
        document.getElementById('menu-error').innerText = 'Connesso! In attesa di avvio...';
    });
    
    state.peerConn.on('data', (data) => {
        handleNetworkData(data);
    });
}

function handleNetworkData(data) {
    if (data.type === 'START_GAME') {
        document.getElementById('game-over-banner').style.display = 'none';
        applySyncState(data.state);
        showScreen('screen-game');
        startGameLoop();
    } else if (data.type === 'STATE_SYNC') {
        applySyncState(data.state);
        updateUI();
        renderBoard();
    } else if (data.type === 'MOVE_PIECE') {
        applyNetMovePiece(data.from, data.to);
    } else if (data.type === 'SWAP_CARD') {
        applyNetSwapCard(state.myPlayerId === 1 ? 2 : 1, data.cardIndex);
    } else if (data.type === 'GAME_OVER') {
        state.winner = data.winner;
        showGameOver(state.winner);
    }
}

export function updateUI() {
    document.getElementById('timer-display').innerText = state.timer === 'infinite' ? '∞' : state.timer;
    
    let isMyTurn = state.turn === state.myPlayerId;
    
    if (state.myPlayerId === 1) {
        document.getElementById('p1-name').innerText = state.hostUsername + (isMyTurn ? ' (Tuo Turno)' : '');
        document.getElementById('p2-name').innerText = state.guestUsername + (!isMyTurn ? ' (Suo Turno)' : '');
    } else {
        document.getElementById('p1-name').innerText = state.guestUsername + (isMyTurn ? ' (Tuo Turno)' : '');
        document.getElementById('p2-name').innerText = state.hostUsername + (!isMyTurn ? ' (Suo Turno)' : '');
    }
    
    let myCards = state.myPlayerId === 1 ? state.p1Cards : state.p2Cards;
    
    let p1CardsHtml = '';
    myCards.forEach((c, i) => {
        let isSel = state.selectedCardIndex === i ? 'selected' : '';
        let piecesHtml = '';
        c.pieces.forEach(s => {
            piecesHtml += `<div class="card-piece ${s} bg-${c.color}"></div>`;
        });
        p1CardsHtml += `<div class="obj-card ${isSel}" onclick="window.onCardClick(${i})">
            ${piecesHtml}
        </div>`;
    });
    document.getElementById('p1-cards').innerHTML = p1CardsHtml;
    
    let dots = '';
    for(let i=0; i<2; i++) {
        dots += `<div class="move-dot ${i < state.movesLeft ? 'active' : ''}"></div>`;
    }
    document.getElementById('moves-box').innerHTML = dots;
    
    if (state.selectedCardIndex !== null && isMyTurn) {
        document.getElementById('action-bar').classList.add('visible');
    } else {
        document.getElementById('action-bar').classList.remove('visible');
    }
}

window.onCardClick = function(index) {
    if (state.turn !== state.myPlayerId || state.movesLeft <= 0 || state.winner) return;
    if (state.selectedCardIndex === index) {
        state.selectedCardIndex = null;
    } else {
        state.selectedNode = null;
        state.selectedCardIndex = index;
    }
    updateUI();
    renderBoard();
}

function onSwapCardClick() {
    if (state.selectedCardIndex !== null) {
        handleSwapCard(state.selectedCardIndex);
    }
}

export function renderBoard() {
    let boardEl = document.getElementById('board');
    
    // Create or get SVG container to ensure cross-browser parsing (fixes iOS/Safari missing arrows)
    let svgContainer = document.getElementById('svg-container');
    if (!svgContainer) {
        svgContainer = document.createElement('div');
        svgContainer.id = 'svg-container';
        svgContainer.style.position = 'absolute';
        svgContainer.style.top = '0';
        svgContainer.style.left = '0';
        svgContainer.style.width = '100%';
        svgContainer.style.height = '100%';
        svgContainer.style.pointerEvents = 'none';
        svgContainer.style.zIndex = '1';
        boardEl.appendChild(svgContainer);
    }
    
    // Clear old disks (but keep the container)
    boardEl.querySelectorAll('.disk').forEach(d => d.remove());
    
    let svgHtml = `<svg width="100%" height="100%">`;
    svgHtml += `
        <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="rgba(255, 255, 255, 0.5)" />
            </marker>
        </defs>
    `;
    let boardWidth = boardEl.clientWidth || 320;
    let boardHeight = boardEl.clientHeight || 400;

    edges.forEach(e => {
        let n1 = nodes[e.from];
        let n2 = nodes[e.to];
        
        let x1 = (n1.x / 100) * boardWidth;
        let y1 = (n1.y / 100) * boardHeight;
        let x2 = (n2.x / 100) * boardWidth;
        let y2 = (n2.y / 100) * boardHeight;
        
        let dx = x2 - x1;
        let dy = y2 - y1;
        let dist = Math.sqrt(dx*dx + dy*dy);
        
        // Disks are 70px diameter (r=35px). We leave some padding for the arrowhead.
        let padding = 40; 
        
        if (dist > padding) {
            let pX = x1 + (dx / dist) * 35; // Start from edge of source disk
            let pY = y1 + (dy / dist) * 35;
            let qX = x2 - (dx / dist) * padding; // End a bit before target disk for arrowhead
            let qY = y2 - (dy / dist) * padding;
            
            svgHtml += `
                <path d="M ${pX} ${pY} L ${qX} ${qY}" stroke="rgba(255, 255, 255, 0.5)" stroke-width="1.5" fill="none" marker-end="url(#arrowhead)"/>
            `;
        }
    });
    svgHtml += `</svg>`;
    svgContainer.innerHTML = svgHtml;
    
    let validTargets = state.selectedNode !== null ? edges.filter(e => e.from === state.selectedNode).map(e => e.to) : [];
    
    nodes.forEach(n => {
        let disk = document.createElement('div');
        disk.className = `disk ${n.type}`;
        disk.style.left = n.x + '%';
        disk.style.top = n.y + '%';
        
        if (state.selectedNode === n.id) disk.classList.add('highlight');
        if (validTargets.includes(n.id)) disk.classList.add('valid-target');
        
        disk.onclick = () => window.onNodeClick(n.id);
        
        let pile = state.board[n.id];
        if (pile) {
            pile.forEach((p, index) => {
                let pEl = document.createElement('div');
                pEl.className = `piece ${p.size} bg-${p.color}`;
                if (state.selectedNode === n.id && index === pile.length - 1) {
                    pEl.classList.add('selected');
                }
                disk.appendChild(pEl);
            });
        }
        
        boardEl.appendChild(disk);
    });
}

window.onNodeClick = function(id) {
    if (state.turn !== state.myPlayerId || state.movesLeft <= 0 || state.winner) return;
    
    if (state.selectedNode === null) {
        if (state.board[id] && state.board[id].length > 0) {
            state.selectedCardIndex = null;
            state.selectedNode = id;
        }
    } else {
        if (state.selectedNode === id) {
            state.selectedNode = null;
        } else {
            let validTargets = edges.filter(e => e.from === state.selectedNode).map(e => e.to);
            if (validTargets.includes(id)) {
                handleMovePiece(state.selectedNode, id);
            } else if (state.board[id] && state.board[id].length > 0) {
                state.selectedNode = id;
            } else {
                state.selectedNode = null;
            }
        }
    }
    updateUI();
    renderBoard();
}

export function showGameOver(winnerId) {
    document.getElementById('game-over-banner').style.display = 'block';
    let text = "";
    if (winnerId === state.myPlayerId) {
        text = "Hai Vinto!";
    } else {
        text = "Hai Perso!";
    }
    document.getElementById('winner-text').innerText = text;
}

// Ensure board resizes correctly
window.addEventListener('resize', () => {
    if (document.getElementById('screen-game').classList.contains('active')) {
        renderBoard();
    }
});
