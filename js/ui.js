import { state, nodes, edges } from './state.js';
import { initGameData, getSyncState, applySyncState, handleMovePiece, handleSwapCard, startGameLoop, applyNetMovePiece, applyNetSwapCard } from './game.js';

export function setupUI() {
    document.getElementById('btn-login').addEventListener('click', onLogin);
    document.getElementById('btn-cpu').addEventListener('click', onCpuMode);
    document.getElementById('btn-create-room').addEventListener('click', onCreateRoom);
    document.getElementById('btn-join-room').addEventListener('click', onJoinRoom);
    document.getElementById('btn-cambia').addEventListener('click', onSwapCardClick);
    document.getElementById('btn-back-menu').addEventListener('click', () => {
        document.getElementById('game-over-banner').style.display = 'none';
        showScreen('screen-menu');
    });
}

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
    document.getElementById('timer-display').innerText = state.timer;
    
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
    let svg = document.getElementById('arrows-svg');
    
    boardEl.querySelectorAll('.disk').forEach(d => d.remove());
    
    let svgHtml = '';
    svgHtml += `
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" class="arrow-head" />
            </marker>
        </defs>
    `;
    edges.forEach(e => {
        let n1 = nodes[e.from];
        let n2 = nodes[e.to];
        svgHtml += `
            <path d="M ${n1.x}% ${n1.y}% L ${n2.x}% ${n2.y}%" class="arrow-path" marker-end="url(#arrowhead)"/>
        `;
    });
    svg.innerHTML = svgHtml;
    
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
