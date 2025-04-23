document.addEventListener('DOMContentLoaded', () => {
    // --- Initialize Socket.IO Connection ---
    // Connects to the server the HTML was served from, or specify URL e.g., io("http://localhost:3000")
    const socket = io(); 

    // --- DOM Elements (Remain the same) ---
    const loginScreen = document.getElementById('login-screen');
    const gameScreen = document.getElementById('game-screen');
    const nicknameInput = document.getElementById('nickname-input');
    const sessionIdInput = document.getElementById('session-id-input');
    const joinCreateBtn = document.getElementById('join-create-btn');
    const loginError = document.getElementById('login-error');

    const sessionIdDisplay = document.getElementById('session-id-display');
    const myNicknameDisplay = document.getElementById('my-nickname-display');
    const gmIndicator = document.getElementById('gm-indicator');
    const leaveBtn = document.getElementById('leave-btn');

    const playerListUl = document.getElementById('players-ul');
    const playerCountSpan = document.getElementById('player-count');

    const gameStatusArea = document.getElementById('game-status-area');
    const statusMessage = document.getElementById('status-message');
    const gmControls = document.getElementById('gm-controls');
    const questionInput = document.getElementById('question-input');
    const answerInput = document.getElementById('answer-input');
    const setQaBtn = document.getElementById('set-qa-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    const gmError = document.getElementById('gm-error');

    const questionDisplay = document.getElementById('question-display');
    const questionText = document.getElementById('question-text');
    const timerDisplay = document.getElementById('timer-display');
    const attemptsLeftSpan = document.getElementById('attempts-left');

    const guessInputArea = document.getElementById('guess-input-area');
    const guessInput = document.getElementById('guess-input');
    const submitGuessBtn = document.getElementById('submit-guess-btn');
    const guessFeedback = document.getElementById('guess-feedback');

    const roundOverInfo = document.getElementById('round-over-info');
    const roundOverTitle = document.getElementById('round-over-title');
    const roundOverResult = document.getElementById('round-over-result');
    const correctAnswerDisplay = document.getElementById('correct-answer-display');
    const nextGmInfo = document.getElementById('next-gm-info');

    // --- Game State (Remain the same) ---
    let myNickname = null;
    let myUserId = null; // Provided by server via socket.id potentially
    let currentSessionId = null;
    let isGM = false;
    let players = {}; // Populated by server messages
    let gameState = 'LOBBY'; // Updated based on server state
    let currentQuestion = ''; // Populated by server messages
    let attemptsLeft = 3; // Updated based on server messages/feedback
    let timerInterval = null;
    let timeLeft = 60;

    // REMOVED: connectWebSocket simulation function
    // REMOVED: sendMessageToServer simulation function

    // --- UI Helper Functions (Remain the same) ---
    const showScreen = (screenName) => {
        loginScreen.classList.remove('active');
        gameScreen.classList.remove('active');
        document.getElementById(screenName)?.classList.add('active'); // Add null check
    };
    const showLoginError = (message) => { loginError.textContent = message; };
    const showGmError = (message) => { gmError.textContent = message; };
    const showStatusMessage = (message) => {
        statusMessage.textContent = message;
        statusMessage.classList.remove('hidden');
        // Hide specific areas when showing general status
        gmControls.classList.add('hidden');
        questionDisplay.classList.add('hidden');
        guessInputArea.classList.add('hidden');
        roundOverInfo.classList.add('hidden');
    }

    const updatePlayerList = () => {
        playerListUl.innerHTML = '';
        const playerIds = Object.keys(players);
        playerCountSpan.textContent = playerIds.length;

        playerIds.forEach(pId => {
            const player = players[pId];
            if (!player) return; // Add check for safety
            const li = document.createElement('li');
            li.textContent = `${player.nickname} (Score: ${player.score})`;
            if (player.isGM) {
                li.textContent += ' (GM)';
                li.classList.add('is-gm');
            }
            playerListUl.appendChild(li);
        });

        // Update start button based on client-side 'Q&A set' state
        if (isGM) {
            // Start button enabled state depends on whether user has clicked 'Set Q&A' button client side
            const qaTentativelySet = setQaBtn.disabled; // Use button state as indicator
            startGameBtn.disabled = !qaTentativelySet;
            startGameBtn.title = qaTentativelySet ? "Start the game" : "Set Question & Answer first";
        }
    };

    const resetRoundState = () => {
        clearInterval(timerInterval);
        timerInterval = null;
        timeLeft = 60;
        attemptsLeft = 3; // Reset client-side counter too
        currentQuestion = '';
        questionInput.value = '';
        answerInput.value = '';
        guessInput.value = '';
        guessFeedback.textContent = '';
        gmError.textContent = '';
        timerDisplay.textContent = timeLeft;
        attemptsLeftSpan.textContent = attemptsLeft; // Update display

        // Reset GM controls state
        questionInput.disabled = false;
        answerInput.disabled = false;
        setQaBtn.disabled = false;
        startGameBtn.disabled = true; // Disable start until Q&A is set again
        startGameBtn.title = "Set Question & Answer first";
    };

    const updateUIForGameState = () => {
        // Hide all conditional elements first
        statusMessage.classList.add('hidden');
        gmControls.classList.add('hidden');
        questionDisplay.classList.add('hidden');
        guessInputArea.classList.add('hidden');
        roundOverInfo.classList.add('hidden');

        gmIndicator.classList.toggle('visible', isGM);

        // Show the correct elements based on STATE RECEIVED FROM SERVER
        switch (gameState) { // gameState should be updated by handleServerMessage
            case 'LOBBY':
            case 'WAITING_FOR_QUESTION':
                if (isGM) {
                    gmControls.classList.remove('hidden');
                    // Check if Q&A button is disabled (meaning user clicked it)
                    const qaTentativelySet = setQaBtn.disabled;
                    questionInput.disabled = qaTentativelySet;
                    answerInput.disabled = qaTentativelySet;
                    setQaBtn.disabled = qaTentativelySet;
                    startGameBtn.disabled = !qaTentativelySet; // Enable Start only if Set was clicked
                    startGameBtn.title = qaTentativelySet ? "Start the game" : "Set Question & Answer first";
                } else {
                    const gmNickname = Object.values(players).find(p => p?.isGM)?.nickname || 'Game Master'; // Add null check
                    showStatusMessage(`Waiting for ${gmNickname} to set Q&A and start...`);
                }
                break;

            case 'GUESSING':
                questionDisplay.classList.remove('hidden');
                questionText.textContent = currentQuestion; // Set from server state
                attemptsLeftSpan.textContent = attemptsLeft; // Set from server state/feedback
                timerDisplay.textContent = timeLeft; // Updated by timer
                if (!isGM) {
                    guessInputArea.classList.remove('hidden');
                    guessInput.disabled = (attemptsLeft <= 0);
                    submitGuessBtn.disabled = (attemptsLeft <= 0);
                    // guessFeedback.textContent = ''; // Clear feedback only when needed
                     if (attemptsLeft > 0 && !guessInput.disabled) guessInput.focus();
                } else {
                    // GM view during active game
                    showStatusMessage("Game started! Waiting for players to guess.");
                }
                startTimer(); // Start timer if GUESSING state
                break;

            case 'ROUND_OVER':
                roundOverInfo.classList.remove('hidden');
                 // Disable guess input just in case
                guessInput.disabled = true;
                submitGuessBtn.disabled = true;
                break;
        }
         updatePlayerList(); // Update player list display
    };


     const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval); // Clear existing timer
        // timeLeft should be set by game_started or resetRoundState
        timerDisplay.textContent = timeLeft;

        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = Math.max(0, timeLeft);
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                // REMOVED: Simulation of timeout message
                console.log("Client timer expired. Server handles timeout.");
                // Server will send 'round_over_timeout' event
            }
        }, 1000);
    };

    // --- Event Listeners (Using socket.emit) ---
    joinCreateBtn.addEventListener('click', () => {
         myNickname = nicknameInput.value.trim();
         const requestedSessionId = sessionIdInput.value.trim();

         if (!myNickname) { showLoginError('Please enter a nickname.'); return; }
         if (/\s/.test(myNickname)) { showLoginError('Nickname cannot contain spaces.'); return; }
         if (myNickname.length > 15) { showLoginError('Nickname too long (max 15 chars).'); return; }
         if (requestedSessionId && !/^[a-zA-Z0-9-]+$/.test(requestedSessionId)){ showLoginError('Session ID invalid.'); return; }

         showLoginError('');
         joinCreateBtn.disabled = true;
         joinCreateBtn.textContent = 'Connecting...';

         // Emit event to server
         if (requestedSessionId) {
             socket.emit('join_session', { sessionId: requestedSessionId, username: myNickname });
         } else {
             socket.emit('create_session', myNickname);
         }
         // Server response ('session_created' or 'session_joined' or 'join_error') will handle UI change
    });

    leaveBtn.addEventListener('click', () => {
        // Disconnect will trigger server cleanup and client 'disconnect' handler
        if (confirm('Are you sure you want to leave?')) {
            socket.disconnect();
            resetToLogin(); // Reset UI immediately
        }
    });

    setQaBtn.addEventListener('click', () => {
        const question = questionInput.value.trim();
        const answer = answerInput.value.trim();
        if (!question || !answer) {
            showGmError('Please enter both question and answer.');
            return;
        }
        showGmError('');
        // --- NO SERVER EMIT NEEDED HERE if Q&A sent with Start ---
        // Just update UI to allow starting
        console.log("Q&A tentatively set client-side.");
        questionInput.disabled = true;
        answerInput.disabled = true;
        setQaBtn.disabled = true;
        startGameBtn.disabled = false; // Enable start
        startGameBtn.title = "Start the game";
    });

     startGameBtn.addEventListener('click', () => {
        const question = questionInput.value.trim();
        const answer = answerInput.value.trim();
        // Re-check here in case inputs were re-enabled somehow, or just rely on server validation
        if (!question || !answer || !isGM || startGameBtn.disabled) {
            showGmError('Cannot start game. Ensure Q&A is set.');
            return;
        }
        showGmError('');
        socket.emit('start_game', { question, answer });
        startGameBtn.disabled = true; // Prevent double clicks
        showStatusMessage('Starting game...');
    });

    submitGuessBtn.addEventListener('click', () => {
        const guess = guessInput.value.trim();
        if (!guess || submitGuessBtn.disabled) return;

        guessFeedback.textContent = 'Checking...'; // Provide immediate feedback
        submitGuessBtn.disabled = true; // Disable until response

        // Emit guess and handle response in callback
        socket.emit('submit_guess', guess, (response) => {
            if (!response) { // Handle case where server doesn't send response
                guessFeedback.textContent = 'Error: No response from server.';
                submitGuessBtn.disabled = false; // Re-enable
                return;
            }
            if (response.error) {
                guessFeedback.textContent = `Error: ${response.error}`;
                submitGuessBtn.disabled = false; // Re-enable after error
                return;
            }

            // Update based on server response
            attemptsLeft = response.attemptsLeft;
            attemptsLeftSpan.textContent = attemptsLeft; // Update display

            if (response.isCorrect) {
                guessFeedback.textContent = 'Correct!';
                guessInput.disabled = true;
                // submitGuessBtn remains disabled, server sends game_ended
            } else {
                guessFeedback.textContent = `Incorrect.`;
                if (attemptsLeft <= 0) {
                    guessFeedback.textContent += ' No attempts left.';
                    guessInput.disabled = true;
                    // submitGuessBtn remains disabled
                } else {
                    submitGuessBtn.disabled = false; // Re-enable for next guess
                    guessInput.focus();
                }
            }
        });
        guessInput.value = ''; // Clear input immediately
    });

    guessInput.addEventListener('keypress', (e) => {
         if (e.key === 'Enter' && !submitGuessBtn.disabled) {
            submitGuessBtn.click();
        }
    });


    // --- Socket.IO Event Handlers (Receiving from Server) ---

    // Use 'handleServerMessage' name convention or use direct listeners
    // Let's use direct listeners for clarity with real sockets

    socket.on('connect', () => {
        console.log('Connected to server!', socket.id);
        // If reconnecting, might need logic here or on server to rejoin session
    });

    socket.on('session_created', (sessionId, initialState) => {
        console.log('Event: session_created', sessionId, initialState);
        myUserId = socket.id; // Use socket.id as user ID on client
        currentSessionId = sessionId;
        isGM = true; // Creator is GM
        players = initialState.players.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}); // Convert array to map
        myNicknameDisplay.textContent = myNickname;
        //sessionIdDisplay.textContent = currentSessionId; // Display session ID if needed
        showScreen('game-screen');
        gameState = 'LOBBY'; // Game starts inactive
        showStatusMessage(`Session ${sessionId} created. Set Q&A to start.`);
        updateUIForGameState();
        joinCreateBtn.disabled = false; // Re-enable button on login screen
        joinCreateBtn.textContent = 'Join / Create Game';
    });

    socket.on('session_joined', (sessionId, initialState) => {
        console.log('Event: session_joined', sessionId, initialState);
        myUserId = socket.id;
        currentSessionId = sessionId;
        isGM = (initialState.gameMaster === socket.id);
        players = initialState.players.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
        myNicknameDisplay.textContent = myNickname;
        //sessionIdDisplay.textContent = currentSessionId;
        showScreen('game-screen');
        gameState = initialState.isActive ? 'GUESSING' : 'LOBBY'; // Set initial state
        showStatusMessage(`Joined session ${sessionId}. ${initialState.isActive ? 'Game in progress.' : 'Waiting for game...'}`);
        updateUIForGameState(); // Update UI based on initial state
        joinCreateBtn.disabled = false; // Re-enable button on login screen
        joinCreateBtn.textContent = 'Join / Create Game';
    });

    socket.on('join_error', (message) => {
        console.error('Event: join_error', message);
        alert(`Could not join session: ${message}`);
        showLoginError(message);
        joinCreateBtn.disabled = false; // Re-enable button
        joinCreateBtn.textContent = 'Join / Create Game';
        showScreen('login-screen'); // Stay on login screen
    });

    socket.on('creation_error', (message) => { // Handle creation errors too
        console.error('Event: creation_error', message);
        alert(`Could not create session: ${message}`);
        showLoginError(message);
        joinCreateBtn.disabled = false; // Re-enable button
        joinCreateBtn.textContent = 'Join / Create Game';
        showScreen('session-setup');
    });


    socket.on('session_update', (state) => {
        console.log('Event: session_update', state);
        if (!state) return; // Ignore empty updates
        // Update local state based on server truth
        isGM = (state.gameMaster === socket.id);
        players = state.players.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}); // Update players map
        gameState = state.isActive ? 'GUESSING' : (state.question ? 'WAITING_FOR_START' : 'WAITING_FOR_QUESTION'); // More granular state? Or keep simple? Let's keep simple based on isActive for now
        gameState = state.isActive ? 'GUESSING' : 'WAITING_FOR_QUESTION'; // Or LOBBY if no question set? Server state dictates.
        currentQuestion = state.question || ''; // Update question
        // Update attempts left based on *my* player data from server
        const myPlayerData = players[socket.id];
        if (myPlayerData) {
            attemptsLeft = 3 - myPlayerData.attempts;
        } else {
            attemptsLeft = 0; // Or handle appropriately if player data missing
        }

        // Refresh the entire UI based on the new state
        updateUIForGameState();
    });

     // Optional: Handle explicit GM change event if server sends it
     socket.on('set-game-master', (gmId) => {
         console.log('Event: set-game-master', gmId);
         isGM = (socket.id === gmId);
         // Update UI immediately or wait for session_update? Waiting is usually safer.
         // updateUIForGameState();
         gmIndicator.classList.toggle('visible', isGM); // Update indicator directly
     });

    socket.on('game_ended', (result) => {
        console.log('Event: game_ended', result);
        gameState = 'ROUND_OVER';
        clearInterval(timerInterval); // Stop timer
        // Update scores based on winner info if needed (or wait for session_update)
        // const winnerData = result.winner;
        // if (winnerData && players[winnerData.id]) {
        //     players[winnerData.id].score = winnerData.score;
        // }
        // Populate round over info display
        roundOverTitle.textContent = result.winner ? "Winner!" : "Time's Up!";
        roundOverResult.textContent = result.winner ? `${result.winner.username} guessed correctly! (+${result.pointsAwarded || 10} points)` : `Nobody guessed correctly.`;
        correctAnswerDisplay.textContent = result.answer;
        nextGmInfo.textContent = ''; // Clear next GM info (wait for next round start)
        updateUIForGameState(); // Show the round over section
        // Server should send a session_update soon to transition to WAITING_FOR_QUESTION state
    });

    // Handle server-side errors (other than join/create/guess)
     socket.on('server_error', (message) => { // Define a general server error event
        console.error('Event: server_error', message);
        statusMessage.textContent = `Server Error: ${message}`;
        statusMessage.classList.remove('hidden');
        statusMessage.style.color = 'red';
    });
     socket.on('gm_error', (message) => { // Handle errors specific to GM actions
        console.error('Event: gm_error', message);
        showGmError(message);
        // Re-enable buttons if appropriate after GM error
        setQaBtn.disabled = false;
        startGameBtn.disabled = true; // Keep start disabled unless Q&A is confirmed set
    });


    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        alert('Disconnected from server: ' + reason);
        resetToLogin();
    });

    // --- Utility Functions ---
    const resetToLogin = () => {
        myNickname = null; myUserId = null; currentSessionId = null; isGM = false;
        players = {}; gameState = 'LOBBY'; resetRoundState(); // Reset state vars
        playerListUl.innerHTML = ''; playerCountSpan.textContent = '0'; // Clear UI lists
        loginError.textContent = ''; gmError.textContent = ''; // Clear errors
        nicknameInput.value = ''; sessionIdInput.value = ''; // Clear inputs
        joinCreateBtn.disabled = false; joinCreateBtn.textContent = 'Join / Create Game'; // Reset button
        clearInterval(timerInterval); timerInterval = null; // Clear timer
        showScreen('login-screen'); // Show login
    };

    // --- Initial Setup ---
    showScreen('login-screen'); // Start on the login screen

}); // End DOMContentLoaded