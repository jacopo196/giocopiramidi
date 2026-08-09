import { state, COLORS, nodes, edges } from './state.js';
import { updateUI, renderBoard, showScreen, showError, showGameOver } from './ui.js';

export function setupGame() {
    // Network Event Handlers setup in ui.js during login
}

function shuffle(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function initGameData() {
    let allCards = [];
    for (let c of COLORS) {
        allCards.push({ color: c, pieces: ['large', 'medium', 'small'] });
        allCards.push({ color: c, pieces: ['small', 'medium', 'large'] });
    }
    allCards = shuffle(allCards);
    
    state.p1Cards = [allCards[0], allCards[1]];
    state.p2Cards = [allCards[2], allCards[3]];
    state.deck = [allCards[4], allCards[5], allCards[6], allCards[7]];
    
    let valid = false;
    let piles = [];
    while(!valid) {
        let lColors = shuffle([...COLORS]);
        let mColors = shuffle([...COLORS]);
        let sColors = shuffle([...COLORS]);
        valid = true;
        piles = [];
        for(let i=0; i<4; i++) {
            if(lColors[i] === mColors[i] || lColors[i] === sColors[i] || mColors[i] === sColors[i]) {
                valid = false;
                break;
            }
            piles.push([
                { color: lColors[i], size: 'large' },
                { color: mColors[i], size: 'medium' },
                { color: sColors[i], size: 'small' }
            ]);
        }
    }
    
    state.board = [[],[],[],[],[],[],[]];
    state.board[0] = piles[0];
    state.board[1] = piles[1];
    state.board[3] = piles[2];
    state.board[5] = piles[3];
    
    state.turn = Math.random() < 0.5 ? 1 : 2;
    state.movesLeft = 2;
    state.winner = null;
    state.selectedNode = null;
    state.selectedCardIndex = null;
}

export function getSyncState() {
    return {
        board: state.board,
        deck: state.deck,
        p1Cards: state.p1Cards,
        p2Cards: state.p2Cards,
        turn: state.turn,
        movesLeft: state.movesLeft,
        timer: state.timer,
        hostUsername: state.hostUsername,
        guestUsername: state.guestUsername
    };
}

export function applySyncState(s) {
    state.board = s.board;
    state.deck = s.deck;
    state.p1Cards = s.p1Cards;
    state.p2Cards = s.p2Cards;
    state.turn = s.turn;
    state.movesLeft = s.movesLeft;
    state.timer = s.timer;
    if(s.hostUsername) state.hostUsername = s.hostUsername;
    if(s.guestUsername) state.guestUsername = s.guestUsername;
}

export function startGameLoop() {
    state.timer = 10;
    state.movesLeft = 2;
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.timer--;
        updateUI();
        if (state.timer <= 0) {
            switchTurn();
        }
    }, 1000);
    updateUI();
    renderBoard();
    checkCPU();
}

export function switchTurn() {
    state.turn = state.turn === 1 ? 2 : 1;
    state.movesLeft = 2;
    state.selectedNode = null;
    state.selectedCardIndex = null;
    
    if (state.mode === 'online' && state.peerConn && state.isHost) {
        state.peerConn.send({ type: 'STATE_SYNC', state: getSyncState() });
    }
    
    startGameLoop();
}

function checkWinCondition(playerId) {
    const cards = playerId === 1 ? state.p1Cards : state.p2Cards;
    for (let card of cards) {
        for (let pile of state.board) {
            if (pile.length < 3) continue;
            for (let i = 0; i <= pile.length - 3; i++) {
                if (
                    pile[i].color === card.color && pile[i].size === card.pieces[0] &&
                    pile[i+1].color === card.color && pile[i+1].size === card.pieces[1] &&
                    pile[i+2].color === card.color && pile[i+2].size === card.pieces[2]
                ) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function handleMovePiece(from, to) {
    if (state.turn !== state.myPlayerId) return;
    if (state.movesLeft <= 0) return;
    
    let validTargets = edges.filter(e => e.from === from).map(e => e.to);
    if (!validTargets.includes(to)) return;
    
    if (state.board[from].length === 0) return;
    
    let piece = state.board[from].pop();
    state.board[to].push(piece);
    state.movesLeft--;
    
    if (state.mode === 'online' && state.peerConn) {
        state.peerConn.send({ type: 'MOVE_PIECE', from, to });
    }
    
    postMoveCheck();
}

export function handleSwapCard(cardIndex) {
    if (state.turn !== state.myPlayerId) return;
    if (state.movesLeft <= 0) return;
    
    let cards = state.myPlayerId === 1 ? state.p1Cards : state.p2Cards;
    let oldCard = cards[cardIndex];
    let newCard = state.deck.shift();
    cards[cardIndex] = newCard;
    state.deck.push(oldCard);
    
    state.movesLeft--;
    
    if (state.mode === 'online' && state.peerConn) {
        state.peerConn.send({ type: 'SWAP_CARD', cardIndex });
    }
    
    postMoveCheck();
}

export function postMoveCheck() {
    state.selectedNode = null;
    state.selectedCardIndex = null;
    
    if (checkWinCondition(state.turn)) {
        clearInterval(state.timerInterval);
        state.winner = state.turn;
        showGameOver(state.winner);
        
        if (state.mode === 'online' && state.peerConn && state.isHost) {
            state.peerConn.send({ type: 'GAME_OVER', winner: state.winner });
        }
        return;
    }
    
    if (state.movesLeft <= 0) {
        switchTurn();
    } else {
        updateUI();
        renderBoard();
        checkCPU();
    }
}

// Applies move received from network
export function applyNetMovePiece(from, to) {
    let piece = state.board[from].pop();
    state.board[to].push(piece);
    state.movesLeft--;
    postMoveCheck();
}

export function applyNetSwapCard(playerId, cardIndex) {
    let cards = playerId === 1 ? state.p1Cards : state.p2Cards;
    let oldCard = cards[cardIndex];
    let newCard = state.deck.shift();
    cards[cardIndex] = newCard;
    state.deck.push(oldCard);
    state.movesLeft--;
    postMoveCheck();
}

function checkCPU() {
    if (state.mode === 'cpu' && state.turn === 2 && !state.winner) {
        setTimeout(makeCPUMove, 1000);
    }
}

function makeCPUMove() {
    if (state.turn !== 2 || state.winner || state.movesLeft <= 0) return;
    
    let movable = [];
    for (let i = 0; i < 7; i++) {
        if (state.board[i].length > 0) movable.push(i);
    }
    movable = shuffle(movable);
    
    for (let from of movable) {
        let targets = edges.filter(e => e.from === from).map(e => e.to);
        if (targets.length > 0) {
            let to = targets[Math.floor(Math.random() * targets.length)];
            let piece = state.board[from].pop();
            state.board[to].push(piece);
            state.movesLeft--;
            postMoveCheck();
            return;
        }
    }
    
    // Fallback: swap card
    let cards = state.p2Cards;
    let oldCard = cards[0];
    let newCard = state.deck.shift();
    cards[0] = newCard;
    state.deck.push(oldCard);
    state.movesLeft--;
    postMoveCheck();
}
