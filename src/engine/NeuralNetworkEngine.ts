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
        // Simple heuristic: Pip count difference + Contact
        let pipWhite = 0;
        let pipBlack = 0;

        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (count > 0) pipWhite += count * (24 - i);
            if (count < 0) pipBlack += Math.abs(count) * (i + 1);
        }

        const pipScore = (pipBlack - pipWhite) / 100;

        // Bonus for hitting (opponent on bar)
        const hitBonus = (position.bar.black - position.bar.white) * 0.5;

        // Bonus for bearing off
        const offBonus = (position.borneOff.white - position.borneOff.black) * 0.2;

        return pipScore + hitBonus + offBonus;
    }

    private findBestMoves(position: Position): Move[] {
        // 1. Generate all legal full-turn sequences
        // We sort dice descending to try higher moves first (optimization)
        const sortedDice = [...position.dice].sort((a, b) => b - a);
        const sequences = this.generateTurnSequences(position, sortedDice);

        if (sequences.length === 0) return [];

        // 2. Filter by Rule: Maximize number of moves (must use both dice if possible)
        const maxMoves = Math.max(...sequences.map(s => s.moves.length));
        let candidates = sequences.filter(s => s.moves.length === maxMoves);

        // 3. Filter by Rule: If not all dice used, maximize the value of the die used
        // (If we can only play 1 move but had 2 dice of different values, must use the larger one)
        if (maxMoves < position.dice.length && position.dice.length === 2 && position.dice[0] !== position.dice[1]) {
            const maxDieSum = Math.max(...candidates.map(s => s.dieSum));
            candidates = candidates.filter(s => s.dieSum === maxDieSum);
        }

        // 4. Evaluate final states to pick the best strategy
        let bestSequence: TurnSequence | null = null;
        let bestEquity = -Infinity;

        // Determine who is playing to maximize their equity
        // heuristicEvaluation returns + for White advantage, - for Black advantage.
        // If current player is White, we want Max Equity.
        // If current player is Black, we want Min Equity.
        const isWhite = position.currentPlayer === 'white';

        for (const seq of candidates) {
            const equity = this.heuristicEvaluation(seq.finalPosition);

            if (isWhite) {
                if (equity > bestEquity) {
                    bestEquity = equity;
                    bestSequence = seq;
                }
            } else {
                // For Black, we want the lowest equity (most negative)
                // So we invert the comparison or use a separate variable.
                // Let's use a unified "Score" where higher is better for the current player.
                const score = isWhite ? equity : -equity;
                if (score > bestEquity) { // Re-using bestEquity variable name for "Best Score"
                    bestEquity = score;
                    bestSequence = seq;
                }
            }
        }

        return bestSequence ? bestSequence.moves : [];
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
