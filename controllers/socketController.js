const sessionManager = require('../managers/sessionManager');
const gameService = require('../services/gameService');
const { getSanitizedState, broadcastStateUpdate } = require('../utils/helpers');
let ioInstance;

function initialize(io) {
    ioInstance = io;
}

function registerSocketHandlers(socket) {
    if (!ioInstance) {
        console.error("Socket Controller not initialized with io instance!");
        return;
    }
    console.log(`Registering handlers for ${socket.id}`);

    socket.on('create_session', (username) => {
        try {
            const session = sessionManager.createSession(socket.id, username);
            socket.join(session.id);
            console.log(`Controller: User ${username} (${socket.id}) created session ${session.id}`);
            socket.emit('session_created', session.id, getSanitizedState(session));
            socket.emit('set-game-master', socket.id); 
        } catch (error) {
            console.error("Controller: Create session error:", error);
            socket.emit('creation_error', error.message || 'Failed to create session.');
        }
    });

    // --- Session Joining ---
    socket.on('join_session', ({ sessionId, username }) => {
        try {
            const session = sessionManager.getSession(sessionId);
            if (!session) throw new Error('Session not found.');
            if (session.isActive) throw new Error('Game is already in progress.');

            sessionManager.addPlayer(socket.id, sessionId, username);
            socket.join(sessionId);
            console.log(`Controller: User ${username} (${socket.id}) joined session ${sessionId}`);
            socket.emit('session_joined', sessionId, getSanitizedState(session));
            broadcastStateUpdate(ioInstance, sessionId, session); // Update everyone
        } catch (error) {
            console.error("Controller: Join session error:", error);
            socket.emit('join_error', error.message || 'Failed to join session.');
        }
    });

    // --- Game Start ---
    socket.on('start_game', ({ question, answer }) => {
        const session = sessionManager.getSessionBySocketId(socket.id);
        if (!session) return socket.emit('gm_error', 'Session not found.'); 
        if (session.gameMaster !== socket.id) return socket.emit('gm_error', 'Only the GM can start.');
        if (!question?.trim() || !answer?.trim()) return socket.emit('gm_error', 'Question/Answer empty.');

        try {
            const started = gameService.startGameRound(session.id, question.trim(), answer.trim(), endGameCallback); 
            if (started) {
                broadcastStateUpdate(ioInstance, session.id, session); 
            } else {
                 socket.emit('gm_error', 'Failed to start game round.');
            }
        } catch (error) {
             console.error("Controller: Start game error:", error);
             socket.emit('gm_error', error.message || 'Error starting game.');
        }
    });

    // --- Guess Submission ---
    socket.on('submit_guess', (guess, callback) => {
         if (typeof callback !== 'function') return;

        const session = sessionManager.getSessionBySocketId(socket.id);
        if (!session) return callback({ error: "Session invalid." });

        try {
            const result = gameService.handleGuess(session.id, socket.id, guess);

            callback({ isCorrect: result.isCorrect, attemptsLeft: result.attemptsLeft });

            if (result.shouldEndGame) {
                endGameCallback(session.id, result.winner); 
            }
        } catch (error) {
            console.error("Controller: Submit guess error:", error);
            callback({ error: error.message || "Failed to process guess." });
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`Controller: User ${socket.id} disconnected. Reason: ${reason}`);
        try {
            const removalInfo = sessionManager.removePlayer(socket.id);

            if (removalInfo && !removalInfo.sessionDeleted) {
                const { removedPlayer, wasGameMaster, remainingPlayers, sessionId } = removalInfo;
                console.log(`Controller: ${removedPlayer.username} left ${sessionId}. Remaining: ${remainingPlayers.length}`);

                const currentSession = sessionManager.getSession(sessionId);

                if (wasGameMaster && remainingPlayers.length > 0) {
                    console.log(`Controller: GM left ${sessionId}.`);
                    if (currentSession?.isActive) {
                         console.log(`Controller: Game was active, ending round.`);
                         endGameCallback(sessionId, null);
                    } else if (currentSession) {
                         rotateGameMasterAndNotify(sessionId);
                    } else {
                         console.error(`Controller: Session ${sessionId} not found after player removal (GM case).`);
                    }
                } else if (currentSession) {
                     broadcastStateUpdate(ioInstance, sessionId, currentSession);
                }
            } else if (removalInfo?.sessionDeleted) {
                 console.log(`Controller: Session was deleted after player ${socket.id} left.`);
            }
        } catch (error) {
            console.error(`Controller: Error handling disconnect for ${socket.id}:`, error);
        }
    });

}

function endGameCallback(sessionId, winner) {
    const session = sessionManager.getSession(sessionId);
    if (!session) return; 

    try {
        const { answer } = gameService.endGameRound(sessionId); 

        const resultPayload = {
            answer: answer,
            winner: winner ? { 
                id: winner.id,
                username: winner.username,
                score: winner.score
            } : null,

        };

        ioInstance.to(sessionId).emit('game-ended', resultPayload); // Notify clients


        setTimeout(() => {
            rotateGameMasterAndNotify(sessionId);
        }, 4000); 

    } catch (error) {
         console.error(`Controller: Error in endGameCallback for session ${sessionId}:`, error);
         
    }
}

// Helper to perform rotation and notify clients
function rotateGameMasterAndNotify(sessionId) {
     const session = sessionManager.getSession(sessionId);
     if (!session) {
         console.log(`Controller: Session ${sessionId} no longer exists, cannot rotate GM.`);
         return;
     }

     try {
         const newGmId = gameService.determineAndSetNextGm(sessionId); 
         if (newGmId) {
             ioInstance.to(newGmId).emit('set-game-master', newGmId);
         }

         broadcastStateUpdate(ioInstance, sessionId, session);
     } catch (error) {
          console.error(`Controller: Error rotating GM for session ${sessionId}:`, error);
       
     }
}


module.exports = {
    initialize,
    registerSocketHandlers
};