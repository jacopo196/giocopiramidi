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
    { id: 0, type: 'grey', x: 50, y: 50 },
    { id: 1, type: 'white', x: 20, y: 15 },
    { id: 2, type: 'white', x: 80, y: 15 },
    { id: 3, type: 'grey', x: 20, y: 50 },
    { id: 4, type: 'grey', x: 80, y: 50 },
    { id: 5, type: 'white', x: 20, y: 85 },
    { id: 6, type: 'white', x: 80, y: 85 }
];

export const edges = [
    { from: 1, to: 2 },
    { from: 2, to: 4 },
    { from: 4, to: 6 },
    { from: 6, to: 5 },
    { from: 5, to: 3 },
    { from: 3, to: 1 },
    { from: 1, to: 0 },
    { from: 5, to: 0 },
    { from: 4, to: 0 },
    { from: 0, to: 2 },
    { from: 0, to: 6 },
    { from: 0, to: 3 }
];
