document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); 

    // --- DOM Elements (Remain the same) ---
    const loginScreen = document.getElementById('login-screen');
    const gameScreen = document.getElementById('game-screen');
    const nicknameInput = document.getElementById('nickname-input');
    const sessionIdInput = document.getElementById('session-id-input');
    const joinCreateBtn = document.getElementById('join-create-btn');
    const loginError = document.getElementById('login-error');
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

    let myNickname = null;
    let myUserId = null; 
    let currentSessionId = null;
    let isGM = false;
    let players = {}; 
    let gameState = 'LOBBY'; 
    let currentQuestion = '';
    let attemptsLeft = 3; 
    let timerInterval = null;
    let timeLeft = 60;

    const showScreen = (screenName) => {
        loginScreen.classList.remove('active');
        gameScreen.classList.remove('active');
        document.getElementById(screenName)?.classList.add('active'); 
    };
    const showLoginError = (message) => { loginError.textContent = message; };
    const showGmError = (message) => { gmError.textContent = message; };
    const showStatusMessage = (message) => {
        statusMessage.textContent = message;
        statusMessage.classList.remove('hidden');
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
            if (!player) return; 
            const li = document.createElement('li');
            li.textContent = `${player.nickname} (Score: ${player.score})`;
            if (player.isGM) {
                li.textContent += ' (GM)';
                li.classList.add('is-gm');
            }
            playerListUl.appendChild(li);
        });

        if (isGM) {
            const qaTentativelySet = setQaBtn.disabled; 
            startGameBtn.disabled = !qaTentativelySet;
            startGameBtn.title = qaTentativelySet ? "Start the game" : "Set Question & Answer first";
        }
    };

    const resetRoundState = () => {
        clearInterval(timerInterval);
        timerInterval = null;
        timeLeft = 60;
        attemptsLeft = 3; 
        currentQuestion = '';
        questionInput.value = '';
        answerInput.value = '';
        guessInput.value = '';
        guessFeedback.textContent = '';
        gmError.textContent = '';
        timerDisplay.textContent = timeLeft;
        attemptsLeftSpan.textContent = attemptsLeft; 
        questionInput.disabled = false;
        answerInput.disabled = false;
        setQaBtn.disabled = false;
        startGameBtn.disabled = true; 
        startGameBtn.title = "Set Question & Answer first";
    };

    const updateUIForGameState = () => {
        statusMessage.classList.add('hidden');
        gmControls.classList.add('hidden');
        questionDisplay.classList.add('hidden');
        guessInputArea.classList.add('hidden');
        roundOverInfo.classList.add('hidden');

        gmIndicator.classList.toggle('visible', isGM);

        switch (gameState) { 
            case 'LOBBY':
            case 'WAITING_FOR_QUESTION':
                if (isGM) {
                    gmControls.classList.remove('hidden');
                    const qaTentativelySet = setQaBtn.disabled;
                    questionInput.disabled = qaTentativelySet;
                    answerInput.disabled = qaTentativelySet;
                    setQaBtn.disabled = qaTentativelySet;
                    startGameBtn.disabled = !qaTentativelySet; 
                    startGameBtn.title = qaTentativelySet ? "Start the game" : "Set Question & Answer first";
                } else {
                    const gmNickname = Object.values(players).find(p => p?.isGM)?.nickname || 'Game Master'; 
                    showStatusMessage(`Waiting for ${gmNickname} to set Q&A and start...`);
                }
                break;

            case 'GUESSING':
                questionDisplay.classList.remove('hidden');
                questionText.textContent = currentQuestion; 
                attemptsLeftSpan.textContent = attemptsLeft; 
                timerDisplay.textContent = timeLeft; 
                if (!isGM) {
                    guessInputArea.classList.remove('hidden');
                    guessInput.disabled = (attemptsLeft <= 0);
                    submitGuessBtn.disabled = (attemptsLeft <= 0);
                     if (attemptsLeft > 0 && !guessInput.disabled) guessInput.focus();
                } else {
                    showStatusMessage("Game started! Waiting for players to guess.");
                }
                startTimer();
                break;

            case 'ROUND_OVER':
                roundOverInfo.classList.remove('hidden');
                guessInput.disabled = true;
                submitGuessBtn.disabled = true;
                break;
        }
         updatePlayerList(); 
    };


     const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval); 
        timerDisplay.textContent = timeLeft;

        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = Math.max(0, timeLeft);
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                console.log("Client timer expired. Server handles timeout.");
            }
        }, 1000);
    };

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

         if (requestedSessionId) {
             socket.emit('join_session', { sessionId: requestedSessionId, username: myNickname });
         } else {
             socket.emit('create_session', myNickname);
         }
    });

    leaveBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave?')) {
            socket.disconnect();
            resetToLogin(); 
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
        console.log("Q&A tentatively set client-side.");
        questionInput.disabled = true;
        answerInput.disabled = true;
        setQaBtn.disabled = true;
        startGameBtn.disabled = false; 
        startGameBtn.title = "Start the game";
    });

     startGameBtn.addEventListener('click', () => {
        const question = questionInput.value.trim();
        const answer = answerInput.value.trim();
        if (!question || !answer || !isGM || startGameBtn.disabled) {
            showGmError('Cannot start game. Ensure Q&A is set.');
            return;
        }
        showGmError('');
        socket.emit('start_game', { question, answer });
        startGameBtn.disabled = true; 
        showStatusMessage('Starting game...');
    });

    submitGuessBtn.addEventListener('click', () => {
        const guess = guessInput.value.trim();
        if (!guess || submitGuessBtn.disabled) return;

        guessFeedback.textContent = 'Checking...'; 
        submitGuessBtn.disabled = true; 

        socket.emit('submit_guess', guess, (response) => {
            if (!response) { 
                guessFeedback.textContent = 'Error: No response from server.';
                submitGuessBtn.disabled = false; 
                return;
            }
            if (response.error) {
                guessFeedback.textContent = `Error: ${response.error}`;
                submitGuessBtn.disabled = false; 
                return;
            }

            attemptsLeft = response.attemptsLeft;
            attemptsLeftSpan.textContent = attemptsLeft; 

            if (response.isCorrect) {
                guessFeedback.textContent = 'Correct!';
                guessInput.disabled = true;
            } else {
                guessFeedback.textContent = `Incorrect.`;
                if (attemptsLeft <= 0) {
                    guessFeedback.textContent += ' No attempts left.';
                    guessInput.disabled = true;
                } else {
                    submitGuessBtn.disabled = false; 
                    guessInput.focus();
                }
            }
        });
        guessInput.value = ''; 
    });

    guessInput.addEventListener('keypress', (e) => {
         if (e.key === 'Enter' && !submitGuessBtn.disabled) {
            submitGuessBtn.click();
        }
    });

    socket.on('connect', () => {
        console.log('Connected to server!', socket.id);
    });

    socket.on('session_created', (sessionId, initialState) => {
        console.log('Event: session_created', sessionId, initialState);
        myUserId = socket.id; 
        currentSessionId = sessionId;
        isGM = true; 
        players = initialState.players.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}); 
        myNicknameDisplay.textContent = myNickname;
        showScreen('game-screen');
        gameState = 'LOBBY'; 
        showStatusMessage(`Session ${sessionId} created. Set Q&A to start.`);
        updateUIForGameState();
        joinCreateBtn.disabled = false; 
        joinCreateBtn.textContent = 'Join / Create Game';
    });

    socket.on('session_joined', (sessionId, initialState) => {
        console.log('Event: session_joined', sessionId, initialState);
        myUserId = socket.id;
        currentSessionId = sessionId;
        isGM = (initialState.gameMaster === socket.id);
        players = initialState.players.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
        myNicknameDisplay.textContent = myNickname;
        showScreen('game-screen');
        gameState = initialState.isActive ? 'GUESSING' : 'LOBBY'; 
        showStatusMessage(`Joined session ${sessionId}. ${initialState.isActive ? 'Game in progress.' : 'Waiting for game...'}`);
        updateUIForGameState(); 
        joinCreateBtn.disabled = false; 
        joinCreateBtn.textContent = 'Join / Create Game';
    });

    socket.on('join_error', (message) => {
        console.error('Event: join_error', message);
        alert(`Could not join session: ${message}`);
        showLoginError(message);
        joinCreateBtn.disabled = false; 
        joinCreateBtn.textContent = 'Join / Create Game';
        showScreen('login-screen'); 
    });

    socket.on('creation_error', (message) => { 
        console.error('Event: creation_error', message);
        alert(`Could not create session: ${message}`);
        showLoginError(message);
        joinCreateBtn.disabled = false; 
        joinCreateBtn.textContent = 'Join / Create Game';
        showScreen('session-setup');
    });


    socket.on('session_update', (state) => {
        console.log('Event: session_update', state);
        if (!state) return; 
        isGM = (state.gameMaster === socket.id);
        players = state.players.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}); 
        gameState = state.isActive ? 'GUESSING' : (state.question ? 'WAITING_FOR_START' : 'WAITING_FOR_QUESTION');
        gameState = state.isActive ? 'GUESSING' : 'WAITING_FOR_QUESTION'; 
        currentQuestion = state.question || ''; 
        const myPlayerData = players[socket.id];
        if (myPlayerData) {
            attemptsLeft = 3 - myPlayerData.attempts;
        } else {
            attemptsLeft = 0; 
        }
        updateUIForGameState();
    });

     socket.on('set-game-master', (gmId) => {
         console.log('Event: set-game-master', gmId);
         isGM = (socket.id === gmId);
         gmIndicator.classList.toggle('visible', isGM); 
     });

    socket.on('game_ended', (result) => {
        console.log('Event: game_ended', result);
        gameState = 'ROUND_OVER';
        clearInterval(timerInterval); 
        roundOverTitle.textContent = result.winner ? "Winner!" : "Time's Up!";
        roundOverResult.textContent = result.winner ? `${result.winner.username} guessed correctly! (+${result.pointsAwarded || 10} points)` : `Nobody guessed correctly.`;
        correctAnswerDisplay.textContent = result.answer;
        nextGmInfo.textContent = ''; 
        updateUIForGameState(); 
    });

    socket.on('server_error', (message) => { 
        console.error('Event: server_error', message);
        statusMessage.textContent = `Server Error: ${message}`;
        statusMessage.classList.remove('hidden');
        statusMessage.style.color = 'red';
    });
     socket.on('gm_error', (message) => { 
        console.error('Event: gm_error', message);
        showGmError(message);
        setQaBtn.disabled = false;
        startGameBtn.disabled = true; 
    });


    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        alert('Disconnected from server: ' + reason);
        resetToLogin();
    });

    const resetToLogin = () => {
        myNickname = null; myUserId = null; currentSessionId = null; isGM = false;
        players = {}; gameState = 'LOBBY'; resetRoundState(); 
        playerListUl.innerHTML = ''; playerCountSpan.textContent = '0'; 
        loginError.textContent = ''; gmError.textContent = ''; 
        nicknameInput.value = ''; sessionIdInput.value = ''; 
        joinCreateBtn.disabled = false; joinCreateBtn.textContent = 'Join / Create Game'; 
        clearInterval(timerInterval); timerInterval = null; 
        showScreen('login-screen'); 
    };

    showScreen('login-screen'); 

}); 