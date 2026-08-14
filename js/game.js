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
        maxTime: state.maxTime,
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
    if(s.maxTime) state.maxTime = s.maxTime;
    if(s.hostUsername) state.hostUsername = s.hostUsername;
    if(s.guestUsername) state.guestUsername = s.guestUsername;
}

export function startGameLoop() {
    state.timer = state.maxTime;
    state.movesLeft = 2;
    clearInterval(state.timerInterval);
    if (state.timer !== 'infinite') {
        state.timerInterval = setInterval(() => {
            state.timer--;
            updateUI();
            if (state.timer <= 0) {
                switchTurn();
            }
        }, 1000);
    }
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

function getValidActions(simState, playerId) {
    let actions = [];
    for (let from = 0; from < 7; from++) {
        if (simState.board[from].length > 0) {
            let targets = edges.filter(e => e.from === from).map(e => e.to);
            for (let to of targets) {
                actions.push({ type: 'move', from, to });
            }
        }
    }
    actions.push({ type: 'swap', index: 0 });
    actions.push({ type: 'swap', index: 1 });
    return actions;
}

function applyAction(simState, action, playerId) {
    if (action.type === 'move') {
        let p = simState.board[action.from].pop();
        simState.board[action.to].push(p);
        return null;
    } else {
        let cards = playerId === 1 ? simState.p1Cards : simState.p2Cards;
        let oldCard = cards[action.index];
        let newCard = simState.deck.shift();
        cards[action.index] = newCard;
        simState.deck.push(oldCard);
        return { oldCard, newCard };
    }
}

function undoAction(simState, action, playerId, undoData) {
    if (action.type === 'move') {
        let p = simState.board[action.to].pop();
        simState.board[action.from].push(p);
    } else {
        let cards = playerId === 1 ? simState.p1Cards : simState.p2Cards;
        simState.deck.pop(); 
        simState.deck.unshift(undoData.newCard); 
        cards[action.index] = undoData.oldCard;
    }
}

function checkSimWin(simState, playerId) {
    const cards = playerId === 1 ? simState.p1Cards : simState.p2Cards;
    for (let card of cards) {
        for (let pile of simState.board) {
            if (pile.length < 3) continue;
            for (let i = 0; i <= pile.length - 3; i++) {
                if (
                    pile[i].color === card.color && pile[i].size === card.pieces[0] &&
                    pile[i+1].color === card.color && pile[i+1].size === card.pieces[1] &&
                    pile[i+2].color === card.color && pile[i+2].size === card.pieces[2]
                ) return true;
            }
        }
    }
    return false;
}

function evaluateSim(simState) {
    let score = 0;
    const scorePartial = (cards, mult) => {
        let s = 0;
        for (let card of cards) {
            let p1_ready = false;
            let p2_ready = false;
            
            for (let pile of simState.board) {
                let n = pile.length;
                if (n === 0) continue;
                
                let top1 = pile[n - 1]; 
                let top2 = n >= 2 ? pile[n - 2] : null; 
                
                if (n >= 2 && 
                    top2.color === card.color && top2.size === card.pieces[0] &&
                    top1.color === card.color && top1.size === card.pieces[1]) {
                    s += 100 * mult;
                }
                else if (top1.color === card.color && top1.size === card.pieces[0]) {
                    s += 20 * mult;
                }
                
                if (top1.color === card.color) {
                    if (top1.size === card.pieces[1]) p1_ready = true;
                    if (top1.size === card.pieces[2]) p2_ready = true;
                }
            }
            
            if (p1_ready) s += 5 * mult;
            if (p2_ready) s += 5 * mult;
        }
        return s;
    };
    
    score += scorePartial(simState.p2Cards, 1);
    score -= scorePartial(simState.p1Cards, 1.2); 
    return score;
}

function minimax(simState, depth, alpha, beta, isMaximizing, movesLeft) {
    let p2Win = checkSimWin(simState, 2);
    let p1Win = checkSimWin(simState, 1);
    
    if (p2Win) return 10000 + depth;
    if (p1Win) return -10000 - depth;
    if (depth === 0) return evaluateSim(simState);
    
    let currentPlayer = isMaximizing ? 2 : 1;
    let actions = getValidActions(simState, currentPlayer);
    
    if (isMaximizing) {
        let maxEval = -Infinity;
        for (let action of actions) {
            let undoData = applyAction(simState, action, currentPlayer);
            
            let nextMovesLeft = movesLeft - 1;
            let nextIsMax = isMaximizing;
            if (nextMovesLeft === 0) {
                nextMovesLeft = 2;
                nextIsMax = !isMaximizing;
            }
            
            let ev = minimax(simState, depth - 1, alpha, beta, nextIsMax, nextMovesLeft);
            undoAction(simState, action, currentPlayer, undoData);
            
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let action of actions) {
            let undoData = applyAction(simState, action, currentPlayer);
            
            let nextMovesLeft = movesLeft - 1;
            let nextIsMax = isMaximizing;
            if (nextMovesLeft === 0) {
                nextMovesLeft = 2;
                nextIsMax = !isMaximizing;
            }
            
            let ev = minimax(simState, depth - 1, alpha, beta, nextIsMax, nextMovesLeft);
            undoAction(simState, action, currentPlayer, undoData);
            
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function findBestMove(difficulty) {
    let depth = 1;
    if (difficulty === 'medium') depth = state.movesLeft;
    if (difficulty === 'hard') depth = state.movesLeft + 2;
    
    let simState = {
        board: state.board.map(pile => pile.map(p => ({...p}))),
        deck: state.deck.map(c => ({...c})),
        p1Cards: state.p1Cards.map(c => ({...c})),
        p2Cards: state.p2Cards.map(c => ({...c}))
    };
    
    let bestEval = -Infinity;
    let bestActions = [];
    let actions = getValidActions(simState, 2);
    actions = shuffle(actions);
    
    for (let action of actions) {
        let undoData = applyAction(simState, action, 2);
        
        let nextMovesLeft = state.movesLeft - 1;
        let nextIsMax = true;
        if (nextMovesLeft === 0) {
            nextMovesLeft = 2;
            nextIsMax = false;
        }
        
        let ev = minimax(simState, depth - 1, -Infinity, Infinity, nextIsMax, nextMovesLeft);
        undoAction(simState, action, 2, undoData);
        
        if (ev > bestEval) {
            bestEval = ev;
            bestActions = [action];
        } else if (ev === bestEval) {
            bestActions.push(action);
        }
    }
    
    if (bestActions.length > 0) {
        return bestActions[Math.floor(Math.random() * bestActions.length)];
    }
    return null;
}

function doRandomMove() {
    let actions = getValidActions(state, 2);
    let action = actions[Math.floor(Math.random() * actions.length)];
    executeCPUAction(action);
}

function executeCPUAction(action) {
    if (action.type === 'move') {
        let piece = state.board[action.from].pop();
        state.board[action.to].push(piece);
    } else {
        let cards = state.p2Cards;
        let oldCard = cards[action.index];
        let newCard = state.deck.shift();
        cards[action.index] = newCard;
        state.deck.push(oldCard);
    }
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
    
    if (state.difficulty === 'easy' && Math.random() < 0.5) {
        doRandomMove();
        return;
    }
    
    let bestAction = findBestMove(state.difficulty);
    if (!bestAction) {
        doRandomMove();
    } else {
        executeCPUAction(bestAction);
    }
}
