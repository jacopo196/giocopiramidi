export const state = {
    mode: '', // 'cpu' or 'online'
    username: '',
    roomCode: '',
    board: [[],[],[],[],[],[],[]], // 7 disks
    deck: [],
    p1Cards: [],
    p2Cards: [],
    turn: 1, // 1 (Host/P1) or 2 (Guest/P2)
    movesLeft: 2,
    timer: 10,
    timerInterval: null,
    selectedNode: null,
    selectedCardIndex: null,
    myPlayerId: 1,
    winner: null,
    hostUsername: '',
    guestUsername: '',
    authPeer: null,
    roomPeer: null,
    peerConn: null,
    isHost: true
};

export const COLORS = ['red', 'blue', 'black', 'white'];
export const SIZES = ['large', 'medium', 'small'];

export const nodes = [
    { id: 0, type: 'white', x: 50, y: 50 }, // Center
    { id: 1, type: 'white', x: 15, y: 50 }, // Left
    { id: 2, type: 'grey', x: 32.5, y: 15 }, // Top-Left
    { id: 3, type: 'white', x: 67.5, y: 15 }, // Top-Right
    { id: 4, type: 'grey', x: 85, y: 50 }, // Right
    { id: 5, type: 'white', x: 67.5, y: 85 }, // Bottom-Right
    { id: 6, type: 'grey', x: 32.5, y: 85 } // Bottom-Left
];

export const edges = [
    // Outer circle (clockwise)
    { from: 1, to: 2 },
    { from: 2, to: 3 },
    { from: 3, to: 4 },
    { from: 4, to: 5 },
    { from: 5, to: 6 },
    { from: 6, to: 1 },
    
    // Inner connections (bidirectional between Center and Grey nodes)
    { from: 0, to: 2 }, { from: 2, to: 0 },
    { from: 0, to: 4 }, { from: 4, to: 0 },
    { from: 0, to: 6 }, { from: 6, to: 0 }
];
