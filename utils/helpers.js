function getSanitizedState(session) {
    if (!session) return null;
    return {
        id: session.id,
        players: session.players.map(p => ({
            id: p.id,
            username: p.username,
            score: p.score,
            attempts: p.attempts
        })),
        gameMaster: session.gameMaster,
        isActive: session.isActive,
        question: session.question,
    };
}

function broadcastStateUpdate(io, sessionId, session) {
    if (session) {
        const state = getSanitizedState(session);
        io.to(sessionId).emit('session-update', state);
    }
}

module.exports = {
    getSanitizedState,
    broadcastStateUpdate
};