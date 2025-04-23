# Real-time Guessing Game

A live multiplayer guessing game built with Node.js and Socket.IO where players try to guess a secret word set by the Game Master.

## Core Features

*   Real-time gameplay via WebSockets (Socket.IO).
*   Create or join game sessions.
*   Game Master sets a question and answer each round.
*   Players have limited attempts and time to guess.
*   Scoring for correct guesses.
*   Game Master role rotates after each round.
*   Solo Game Master can start a game.

## Tech Stack

*   **Backend:** Node.js, Express, Socket.IO
*   **Frontend:** HTML, CSS, Vanilla JavaScript, Socket.IO Client

## Getting Started

### Prerequisites

*   Node.js and npm installed.

### Setup

1.  **Clone:** `git clone <your-repository-url>`
2.  **Install Dependencies:** `cd guessing-game-backend` && `npm install`
3.  **Configure:** Create a `.env` file in the root directory. Add `PORT=3000` and `ALLOWED_ORIGINS=http://localhost:3000` (adjust port and origins as needed for development/production - separate multiple origins with commas).

## Running the Application

1.  **Start Backend:** `node server.js` (or `npm run dev` if using nodemon)
2.  **Access Frontend:** Open your browser and navigate to `http://localhost:3000` (or the appropriate URL where the frontend is served).

## How to Play

1.  One player creates a session and enters a nickname (becomes GM).
2.  Other players join using the Session ID and their nickname.
3.  The GM sets a question and answer.
4.  The GM starts the game.
5.  Players guess the answer within the time/attempt limits.
6.  The round ends on a correct guess or timeout.
7.  The GM role rotates, and the next round begins.
