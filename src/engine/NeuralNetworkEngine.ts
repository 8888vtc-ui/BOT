import * as tf from '@tensorflow/tfjs';

export interface Position {
    board: number[]; // 28 points (0-23 board, 24 bar white, 25 bar black, 26 off white, 27 off black)
    bar: { white: number; black: number };
    borneOff: { white: number; black: number };
    currentPlayer: 'white' | 'black';
    dice: number[];
}

export interface Move {
    from: number;
    to: number;
    die: number;
}

export interface Evaluation {
    winProbability: number;
    gammonProbability: number;
    backgammonProbability: number;
    bestMoves: Move[];
    equity: number;
}

interface TurnSequence {
    moves: Move[];
    finalPosition: Position;
    dieSum: number;
}

export class NeuralNetworkEngine {
    private model: tf.LayersModel | null = null;
    private isInitialized = false;

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        console.log('Initializing Neural Network Engine...');
        // Mock initialization for now
        this.isInitialized = true;
        console.log('Neural Network Engine initialized');
    }

    async evaluatePosition(position: Position): Promise<Evaluation> {
        if (!this.isInitialized) await this.initialize();

        const bestMoves = this.findBestMoves(position);

        // Apply best moves to get predicted final state for equity calculation
        let currentPos = this.clonePosition(position);
        for (const move of bestMoves) {
            currentPos = this.applyMove(currentPos, move);
        }

        const equity = this.heuristicEvaluation(currentPos);
        const winProb = 0.5 + (equity / 2);

        return {
            winProbability: winProb,
            gammonProbability: winProb * 0.2,
            backgammonProbability: winProb * 0.05,
            bestMoves,
            equity
        };
    }

    private heuristicEvaluation(position: Position): number {
        // Expert Heuristic Evaluation
        // Positive score favors White, Negative score favors Black

        let score = 0;

        // 1. Pip Count (Race) - Weight: 1.0
        // Lower is better. 
        let pipWhite = 0;
        let pipBlack = 0;

        // 2. Board Structure & Primes - Weight: 0.5 per point in prime
        let primeWhite = 0;
        let primeBlack = 0;

        // 3. Blot Safety (Vulnerability) - Weight: -0.8 per blot
        let blotsWhite = 0;
        let blotsBlack = 0;

        // 4. Anchors (Defense) - Weight: 0.6 per anchor in opponent home
        let anchorsWhite = 0;
        let anchorsBlack = 0;

        for (let i = 0; i < 24; i++) {
            const count = position.board[i];

            // Pip Count Calculation
            if (count > 0) pipWhite += count * (24 - i);
            if (count < 0) pipBlack += Math.abs(count) * (i + 1);

            // Blot Detection (Single checker vulnerability)
            // Penalty is higher in home board
            if (count === 1) {
                // White blot
                const penalty = i > 17 ? 1.5 : 0.8; // Higher penalty in home board (18-23)
                blotsWhite += penalty;
            }
            if (count === -1) {
                // Black blot
                const penalty = i < 6 ? 1.5 : 0.8; // Higher penalty in home board (0-5)
                blotsBlack += penalty;
            }

            // Anchor Detection (2+ checkers in opponent's home board)
            if (count >= 2 && i < 6) {
                // White anchor in Black's home
                anchorsWhite += 1;
            }
            if (count <= -2 && i > 17) {
                // Black anchor in White's home
                anchorsBlack += 1;
            }
        }

        // Prime Detection (Consecutive points with 2+ checkers)
        // We scan for blocks of length 2 to 6
        primeWhite = this.calculatePrimeScore(position.board, 1);
        primeBlack = this.calculatePrimeScore(position.board, -1);

        // --- Scoring ---

        // 1. Race Score (Normalized)
        // 100 pips diff = 1.0 score
        score += (pipBlack - pipWhite) / 100.0;

        // 2. Prime Score
        score += (primeWhite - primeBlack) * 0.2;

        // 3. Blot Penalty (Negative impact)
        score -= (blotsWhite * 0.15); // Penalize White blots
        score += (blotsBlack * 0.15); // Penalize Black blots (add to score because Black wants negative)

        // 4. Anchor Bonus
        score += (anchorsWhite * 0.25);
        score -= (anchorsBlack * 0.25);

        // 5. Hit Bonus (Opponent on bar)
        score += (position.bar.black * 0.6); // Black on bar is good for White
        score -= (position.bar.white * 0.6); // White on bar is good for Black

        // 6. Bear Off Bonus
        score += (position.borneOff.white * 0.3);
        score -= (position.borneOff.black * 0.3);

        return score;
    }

    private calculatePrimeScore(board: number[], playerSign: number): number {
        let maxPrimeLength = 0;
        let currentRun = 0;
        let primeScore = 0;

        for (let i = 0; i < 24; i++) {
            const count = board[i];
            const isPointMade = (playerSign === 1 && count >= 2) || (playerSign === -1 && count <= -2);

            if (isPointMade) {
                currentRun++;
            } else {
                if (currentRun > 0) {
                    // Reward longer primes exponentially
                    // 2 pts = 0.2, 3 pts = 0.5, 4 pts = 1.0, 5 pts = 2.0, 6 pts = 4.0
                    if (currentRun >= 2) primeScore += Math.pow(1.5, currentRun - 1);
                    maxPrimeLength = Math.max(maxPrimeLength, currentRun);
                }
                currentRun = 0;
            }
        }
        // Capture last run
        if (currentRun >= 2) primeScore += Math.pow(1.5, currentRun - 1);

        return primeScore;
    }

    private findBestMoves(position: Position): Move[] {
        // 1. Generate all legal full-turn sequences (Candidate Moves)
        const sortedDice = [...position.dice].sort((a, b) => b - a);
        const sequences = this.generateTurnSequences(position, sortedDice);

        if (sequences.length === 0) return [];

        // 2. Filter by Rule: Maximize number of moves
        const maxMoves = Math.max(...sequences.map(s => s.moves.length));
        let candidates = sequences.filter(s => s.moves.length === maxMoves);

        // 3. Filter by Rule: Maximize die value if not all used
        if (maxMoves < position.dice.length && position.dice.length === 2 && position.dice[0] !== position.dice[1]) {
            const maxDieSum = Math.max(...candidates.map(s => s.dieSum));
            candidates = candidates.filter(s => s.dieSum === maxDieSum);
        }

        // Optimization: Prune candidates if too many (keep top 5 based on 1-ply eval)
        // This keeps the 2-ply search fast enough for real-time play.
        if (candidates.length > 5) {
            candidates.sort((a, b) => {
                const eqA = this.heuristicEvaluation(a.finalPosition);
                const eqB = this.heuristicEvaluation(b.finalPosition);
                // If current player is White, higher is better.
                return position.currentPlayer === 'white' ? eqB - eqA : eqA - eqB;
            });
            candidates = candidates.slice(0, 5);
        }

        // 4. 2-Ply Expectiminimax Search
        // For each candidate, we calculate the "Equity" by averaging the opponent's best replies.

        let bestSequence: TurnSequence | null = null;
        let bestEquity = -Infinity; // Always maximizing "My Equity"

        const isWhite = position.currentPlayer === 'white';

        for (const seq of candidates) {
            // Calculate Expectiminimax Equity
            // We want to know: How bad will the opponent hurt me after this move?
            const deepEquity = this.calculateDeepEquity(seq.finalPosition);

            // Convert to "My Perspective"
            // calculateDeepEquity returns the equity of the resulting position.
            // If I am White, the resulting position has Black to play.
            // The heuristic returns + for White adv.
            // So if I am White, I want the result to be Max Positive.

            // However, calculateDeepEquity simulates Black's turn.
            // Black will try to minimize the score (make it negative).
            // So deepEquity will be the "Best possible score Black can achieve".
            // As White, I want to choose the move where "Black's best score" is as high (positive) as possible (i.e., least bad for me).

            const score = isWhite ? deepEquity : -deepEquity;

            if (score > bestEquity) {
                bestEquity = score;
                bestSequence = seq;
            }
        }

        return bestSequence ? bestSequence.moves : [];
    }

    // Simulates the opponent's turn (Chance Node -> Min/Max Node)
    private calculateDeepEquity(position: Position): number {
        // 1. Get all 21 dice rolls
        const rolls = this.getAllDiceRolls();
        let totalEquity = 0;
        let totalProbability = 0;

        // The position passed here has the *previous* player as current.
        // We need to switch perspective for the simulation.
        const nextPlayer = position.currentPlayer === 'white' ? 'black' : 'white';
        const isNextWhite = nextPlayer === 'white';

        for (const roll of rolls) {
            // Setup hypothetical position for opponent
            const simPosition: Position = {
                ...position,
                currentPlayer: nextPlayer,
                dice: roll.dice
            };

            // 2. Find Opponent's Best Move (1-ply) for this roll
            // We use the same generation logic but just pick the best heuristic static score.
            const moves = this.findBestMoves1Ply(simPosition);

            // Apply the move to get the leaf node
            let leafPos = this.clonePosition(simPosition);
            for (const m of moves) {
                leafPos = this.applyMove(leafPos, m);
            }

            // 3. Evaluate Leaf Node
            const equity = this.heuristicEvaluation(leafPos);

            // Add to weighted average
            totalEquity += equity * roll.probability;
            totalProbability += roll.probability;
        }

        return totalEquity / totalProbability;
    }

    // Helper for the inner loop (fast 1-ply search)
    private findBestMoves1Ply(position: Position): Move[] {
        const sortedDice = [...position.dice].sort((a, b) => b - a);
        const sequences = this.generateTurnSequences(position, sortedDice);
        if (sequences.length === 0) return [];

        const maxMoves = Math.max(...sequences.map(s => s.moves.length));
        let candidates = sequences.filter(s => s.moves.length === maxMoves);

        if (maxMoves < position.dice.length && position.dice.length === 2 && position.dice[0] !== position.dice[1]) {
            const maxDieSum = Math.max(...candidates.map(s => s.dieSum));
            candidates = candidates.filter(s => s.dieSum === maxDieSum);
        }

        // Pick best static evaluation
        let bestSeq = candidates[0];
        let bestEq = -Infinity;
        const isWhite = position.currentPlayer === 'white';

        for (const seq of candidates) {
            const eq = this.heuristicEvaluation(seq.finalPosition);
            const score = isWhite ? eq : -eq;
            if (score > bestEq) {
                bestEq = score;
                bestSeq = seq;
            }
        }
        return bestSeq.moves;
    }

    private getAllDiceRolls(): { dice: number[], probability: number }[] {
        const rolls: { dice: number[], probability: number }[] = [];
        for (let i = 1; i <= 6; i++) {
            for (let j = i; j <= 6; j++) {
                if (i === j) {
                    // Double: 1/36 probability, 4 dice
                    rolls.push({ dice: [i, i, i, i], probability: 1 });
                } else {
                    // Non-double: 2/36 probability (i,j and j,i), 2 dice
                    rolls.push({ dice: [i, j], probability: 2 });
                }
            }
        }
        return rolls;
    }

    // Recursive function to find all valid sequences of moves
    private generateTurnSequences(currentPos: Position, remainingDice: number[]): TurnSequence[] {
        if (remainingDice.length === 0) {
            return [{ moves: [], finalPosition: currentPos, dieSum: 0 }];
        }

        const sequences: TurnSequence[] = [];
        const uniqueDice = [...new Set(remainingDice)];

        let moveFound = false;

        for (const die of uniqueDice) {
            const validMoves = this.findSingleMoves(currentPos, die);

            for (const move of validMoves) {
                moveFound = true;
                const nextPos = this.applyMove(currentPos, move);

                // Remove ONE instance of the used die
                const nextDice = [...remainingDice];
                const dieIndex = nextDice.indexOf(die);
                if (dieIndex > -1) nextDice.splice(dieIndex, 1);

                const subSequences = this.generateTurnSequences(nextPos, nextDice);

                for (const sub of subSequences) {
                    sequences.push({
                        moves: [move, ...sub.moves],
                        finalPosition: sub.finalPosition,
                        dieSum: move.die + sub.dieSum
                    });
                }
            }
        }

        // If no moves were possible with ANY die, we stop here.
        if (!moveFound) {
            return [{ moves: [], finalPosition: currentPos, dieSum: 0 }];
        }

        return sequences;
    }

    private findSingleMoves(position: Position, die: number): Move[] {
        const moves: Move[] = [];
        const isWhite = position.currentPlayer === 'white';
        const direction = isWhite ? 1 : -1;

        // 1. Check Bar
        const barCount = isWhite ? position.bar.white : position.bar.black;
        if (barCount > 0) {
            const entryIndex = isWhite ? -1 + die : 24 - die;
            if (this.isValidDestination(position, entryIndex, isWhite)) {
                moves.push({ from: isWhite ? -1 : 24, to: entryIndex, die });
            }
            return moves;
        }

        // 2. Normal moves
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            const isMyChecker = isWhite ? count > 0 : count < 0;

            if (isMyChecker) {
                const dest = i + (die * direction);

                // Bear Off
                if ((isWhite && dest > 23) || (!isWhite && dest < 0)) {
                    if (this.canBearOff(position, i, die, isWhite)) {
                        moves.push({ from: i, to: dest, die });
                    }
                }
                // Normal Move
                else if (this.isValidDestination(position, dest, isWhite)) {
                    moves.push({ from: i, to: dest, die });
                }
            }
        }
        return moves;
    }

    private isValidDestination(position: Position, destIndex: number, isWhite: boolean): boolean {
        if (destIndex < 0 || destIndex > 23) return false;
        const count = position.board[destIndex];

        if (count === 0) return true;
        if (isWhite && count > 0) return true;
        if (!isWhite && count < 0) return true;

        // Hit
        if (isWhite && count === -1) return true;
        if (!isWhite && count === 1) return true;

        return false;
    }

    private canBearOff(position: Position, fromIndex: number, die: number, isWhite: boolean): boolean {
        // Check if all checkers are home
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (isWhite) {
                if (count > 0 && i < 18) return false;
            } else {
                if (count < 0 && i > 5) return false;
            }
        }

        if (isWhite && position.bar.white > 0) return false;
        if (!isWhite && position.bar.black > 0) return false;

        const dest = isWhite ? fromIndex + die : fromIndex - die;

        if (isWhite) {
            if (dest === 24) return true;
            if (dest > 24) {
                // Must be no checkers on higher points (lower indices in home board for White)
                for (let k = 18; k < fromIndex; k++) {
                    if (position.board[k] > 0) return false;
                }
                return true;
            }
        } else {
            if (dest === -1) return true;
            if (dest < -1) {
                // Must be no checkers on higher points (higher indices in home board for Black)
                for (let k = fromIndex + 1; k <= 5; k++) {
                    if (position.board[k] < 0) return false;
                }
                return true;
            }
        }
        return false;
    }

    private applyMove(position: Position, move: Move): Position {
        const newPos = this.clonePosition(position);
        const isWhite = position.currentPlayer === 'white';

        // Remove from source
        if (move.from === -1) newPos.bar.white--;
        else if (move.from === 24) newPos.bar.black--;
        else {
            if (isWhite) newPos.board[move.from]--;
            else newPos.board[move.from]++; // Black counts are negative, so +1 brings closer to 0
        }

        // Add to dest
        // Check Bear Off
        if (isWhite && move.to > 23) {
            newPos.borneOff.white++;
        } else if (!isWhite && move.to < 0) {
            newPos.borneOff.black++;
        } else {
            // Normal move or Hit
            const destCount = newPos.board[move.to];

            // Hit Logic
            if (isWhite && destCount === -1) {
                newPos.board[move.to] = 1; // Replace black blot with white checker
                newPos.bar.black++; // Send black to bar
            } else if (!isWhite && destCount === 1) {
                newPos.board[move.to] = -1; // Replace white blot with black checker
                newPos.bar.white++; // Send white to bar
            } else {
                // No hit, just add
                if (isWhite) newPos.board[move.to]++;
                else newPos.board[move.to]--; // Add negative checker
            }
        }

        return newPos;
    }

    private clonePosition(position: Position): Position {
        return {
            board: [...position.board],
            bar: { ...position.bar },
            borneOff: { ...position.borneOff },
            currentPlayer: position.currentPlayer,
            dice: [...position.dice]
        };
    }
}
