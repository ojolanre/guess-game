const sessionManager = require('../managers/sessionManager');
const ROUND_DURATION_MS = 60 * 1000; // 60 seconds
const POINTS_PER_WIN = 10;
const MAX_ATTEMPTS = 3;

function startGameRound(sessionId, question, answer, onRoundEnd) {
    const session = sessionManager.getSession(sessionId);
    if (!session) return false;

    sessionManager.setSessionActive(sessionId, true, question, answer);
    console.log(`GameService: Starting round for ${sessionId}. Q: ${question}`);

    // Start the server-side timer
    const timerId = setTimeout(() => {
        handleRoundTimeout(sessionId, onRoundEnd);
    }, ROUND_DURATION_MS);

    sessionManager.setRoundTimer(sessionId, timerId);
    return true;
}

function handleGuess(sessionId, playerId, guess) {
    const session = sessionManager.getSession(sessionId);
    if (!session || !session.isActive) throw new Error("Game is not active.");
    if (session.gameMaster === playerId) throw new Error("Game Master cannot guess.");

    const player = session.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found.");
    if (player.attempts >= MAX_ATTEMPTS) throw new Error("No attempts left.");

    const attemptsMade = sessionManager.incrementPlayerAttempts(playerId);
    const attemptsLeft = MAX_ATTEMPTS - attemptsMade;
    const isCorrect = guess.trim().toLowerCase() === (session.answer || '').toLowerCase();

    console.log(`GameService: Guess processed for ${player.username} in ${sessionId}. Correct: ${isCorrect}`);

    let winnerData = null;
    if (isCorrect) {
        const finalScore = sessionManager.addPlayerScore(playerId, POINTS_PER_WIN);
        winnerData = { ...player, score: finalScore }; // Return updated player data as winner
    }

    return {
        isCorrect: isCorrect,
        attemptsLeft: attemptsLeft,
        shouldEndGame: isCorrect, // End game only if correct
        winner: winnerData
    };
}

function endGameRound(sessionId) {
    const session = sessionManager.getSession(sessionId);
    if (!session) return { answer: null };

    console.log(`GameService: Ending round for ${sessionId}`);
    const correctAnswer = session.answer; // Capture before clearing
    sessionManager.clearRoundTimer(sessionId);
    sessionManager.setSessionActive(sessionId, false); // Sets inactive, clears Q&A
    return { answer: correctAnswer };
}

function determineAndSetNextGm(sessionId) {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.players.length === 0) return null;

    let nextGmId = null;
    if (session.players.length === 1) {
        nextGmId = session.players[0].id;
    } else {
        const currentIndex = session.players.findIndex(p => p.id === session.gameMaster);
        const nextIndex = (currentIndex === -1) ? 0 : (currentIndex + 1) % session.players.length;
        nextGmId = session.players[nextIndex].id;
    }

    if (nextGmId) {
        sessionManager.setGameMaster(sessionId, nextGmId);
        console.log(`GameService: Set next GM for ${sessionId} to ${nextGmId}`);
    }
    return nextGmId;
}

function handleRoundTimeout(sessionId, onRoundEnd) {
    const session = sessionManager.getSession(sessionId);
    if (session && session.isActive) {
        console.log(`GameService: Round timed out for ${sessionId}`);
        onRoundEnd(sessionId, null); // Trigger end game callback with no winner
    }
}


module.exports = {
    startGameRound,
    handleGuess,
    endGameRound,
    determineAndSetNextGm,
};