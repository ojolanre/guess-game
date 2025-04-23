const { v4: uuidv4 } = require('uuid');
const sessions = {};
const socketIdToSessionId = {};

function createSession(socketId, username) {
    const sessionId = uuidv4().substring(0, 8);
    const session = { id: sessionId, players: [], gameMaster: socketId, isActive: false, question: null, answer: null, roundTimer: null };
    sessions[sessionId] = session;
    addPlayer(socketId, sessionId, username);
    return session;
}

function addPlayer(socketId, sessionId, username) {
    const session = sessions[sessionId];
    if (!session) throw new Error('Session not found');
    if (session.players.some(p => p.username === username)) throw new Error(`Username "${username}" is already taken.`);
    const player = { id: socketId, username: username || `User_${socketId.substring(0, 4)}`, score: 0, attempts: 0 };
    session.players.push(player);
    socketIdToSessionId[socketId] = sessionId;
    return player;
}

function getSession(sessionId) {
    return sessions[sessionId];
}

function getSessionBySocketId(socketId) {
    const sessionId = socketIdToSessionId[socketId];
    return sessions[sessionId];
}

function removePlayer(socketId) {
    const sessionId = socketIdToSessionId[socketId];
    const session = sessions[sessionId];
    if (!session) return null;
    const playerIndex = session.players.findIndex(p => p.id === socketId);
    if (playerIndex === -1) return null;
    const [removedPlayer] = session.players.splice(playerIndex, 1);
    const wasGameMaster = session.gameMaster === socketId;
    delete socketIdToSessionId[socketId];
    if (session.players.length === 0) {
        console.log(`Session ${sessionId} is empty, deleting.`);
        clearTimeout(session.roundTimer);
        delete sessions[sessionId];
        return { removedPlayer, wasGameMaster, sessionDeleted: true, remainingPlayers: [] };
    }
    return { removedPlayer, wasGameMaster, sessionDeleted: false, remainingPlayers: session.players, sessionId };
}

function setGameMaster(sessionId, newGmId) {
     const session = sessions[sessionId];
    if (session) session.gameMaster = newGmId;
}

function setSessionActive(sessionId, isActive, question = null, answer = null) {
     const session = sessions[sessionId];
    if (session) {
        session.isActive = isActive;
        session.question = question;
        session.answer = answer;
        if (isActive) session.players.forEach(p => p.attempts = 0);
    }
}

function incrementPlayerAttempts(socketId) {
     const session = getSessionBySocketId(socketId);
    const player = session?.players.find(p => p.id === socketId);
    if (player && player.attempts < 3) {
        player.attempts += 1;
        return player.attempts;
    }
    return player?.attempts ?? 0;
}

function addPlayerScore(socketId, points) {
     const session = getSessionBySocketId(socketId);
    const player = session?.players.find(p => p.id === socketId);
    if (player) {
        player.score += points;
        return player.score;
    }
    return 0;
}

function setRoundTimer(sessionId, timerId) {
     const session = sessions[sessionId];
    if(session) {
        if(session.roundTimer) clearTimeout(session.roundTimer);
        session.roundTimer = timerId;
    }
}

function clearRoundTimer(sessionId) {
      const session = sessions[sessionId];
     if(session && session.roundTimer) {
         clearTimeout(session.roundTimer);
         session.roundTimer = null;
     }
}

module.exports = {
    createSession, addPlayer, getSession, getSessionBySocketId,
    removePlayer, setGameMaster, setSessionActive, incrementPlayerAttempts,
    addPlayerScore, setRoundTimer, clearRoundTimer,
};