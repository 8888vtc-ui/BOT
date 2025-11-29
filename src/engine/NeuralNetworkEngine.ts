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

        const equity = this.heuristicEvaluation(position);
        const winProb = 0.5 + (equity / 2);
        const bestMoves = this.findBestMoves(position);

        return {
            winProbability: winProb,
            gammonProbability: winProb * 0.2,
            backgammonProbability: winProb * 0.05,
            bestMoves,
            equity
        };
    }

    private heuristicEvaluation(position: Position): number {
        // Simple heuristic: Pip count difference
        let pipWhite = 0;
        let pipBlack = 0;

        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (count > 0) pipWhite += count * (24 - i);
            if (count < 0) pipBlack += Math.abs(count) * (i + 1);
        }

        // Lower pip count is better
        return (pipBlack - pipWhite) / 100;
    }

    private findBestMoves(position: Position): Move[] {
        const moves: Move[] = [];
        const player = position.currentPlayer; // 'white' or 'black'
        const isWhite = player === 'white';
        const direction = isWhite ? 1 : -1;

        // 1. Check Bar first
        const barCount = isWhite ? position.bar.white : position.bar.black;
        if (barCount > 0) {
            // Must enter from bar
            // White enters at index -1 + die (0..5)
            // Black enters at index 24 - die (23..18)
            for (const die of position.dice) {
                const entryIndex = isWhite ? -1 + die : 24 - die;
                // Check if entry is valid
                if (this.isValidDestination(position, entryIndex, isWhite)) {
                    moves.push({ from: isWhite ? -1 : 24, to: entryIndex, die });
                }
            }
            return moves; // If on bar, can only do entry moves (simplified for greedy bot)
        }

        // 2. Normal moves
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            const isMyChecker = isWhite ? count > 0 : count < 0;

            if (isMyChecker) {
                for (const die of position.dice) {
                    const dest = i + (die * direction);

                    // Check Bear Off
                    // White bears off at > 23, Black at < 0
                    if ((isWhite && dest > 23) || (!isWhite && dest < 0)) {
                        if (this.canBearOff(position, i, die, isWhite)) {
                            moves.push({ from: i, to: dest, die });
                        }
                    } else {
                        // Normal move
                        if (this.isValidDestination(position, dest, isWhite)) {
                            moves.push({ from: i, to: dest, die });
                        }
                    }
                }
            }
        }

        // Shuffle moves to add variety and return unique moves
        // We filter duplicates to avoid sending the same move multiple times
        const uniqueMoves = moves.filter((move, index, self) =>
            index === self.findIndex((m) => (
                m.from === move.from && m.to === move.to && m.die === move.die
            ))
        );

        return uniqueMoves.sort(() => Math.random() - 0.5);
    }

    private isValidDestination(position: Position, destIndex: number, isWhite: boolean): boolean {
        if (destIndex < 0 || destIndex > 23) return false;
        const count = position.board[destIndex];

        // Valid if: empty (0), own color (same sign), or opponent single (count 1 or -1)
        if (count === 0) return true;
        if (isWhite && count > 0) return true; // Own color
        if (!isWhite && count < 0) return true; // Own color

        // Hit? (Opponent has exactly 1 checker)
        if (isWhite && count === -1) return true;
        if (!isWhite && count === 1) return true;

        return false; // Blocked
    }

    private canBearOff(position: Position, fromIndex: number, die: number, isWhite: boolean): boolean {
        // Check if all checkers are home
        // White home: 18-23. Black home: 0-5.

        // Scan board for any checkers outside home
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (isWhite) {
                // If white checker exists at index < 18, cannot bear off
                if (count > 0 && i < 18) return false;
            } else {
                // If black checker exists at index > 5, cannot bear off
                if (count < 0 && i > 5) return false;
            }
        }

        // Also check bar (already handled by findBestMoves returning early, but good for safety)
        if (isWhite && position.bar.white > 0) return false;
        if (!isWhite && position.bar.black > 0) return false;

        // Exact bear off?
        const dest = isWhite ? fromIndex + die : fromIndex - die;

        if (isWhite) {
            if (dest === 24) return true; // Exact
            if (dest > 24) {
                // Must be no checkers on higher points (lower indices in home board for White?)
                // White moves 0->23. Home is 18,19,20,21,22,23.
                // If fromIndex is 20, and die is 6, dest is 26.
                // Allowed ONLY if no checkers on 18, 19.
                // Wait, "higher points" means points further away from exit.
                // For White (exiting at 24), points further away are 18, 19...
                // So if I am at 22, and roll 6. Can I bear off? Yes, if no checkers at 18,19,20,21.
                // Actually, the rule is: you can bear off with a higher die if there are no checkers on points *further away from the end*.
                // For White, "further away" means indices < fromIndex.
                for (let k = 18; k < fromIndex; k++) {
                    if (position.board[k] > 0) return false;
                }
                return true;
            }
        } else {
            // Black moves 23->0. Home is 5,4,3,2,1,0.
            if (dest === -1) return true; // Exact
            if (dest < -1) {
                // Must be no checkers on points further away (indices > fromIndex)
                for (let k = fromIndex + 1; k <= 5; k++) {
                    if (position.board[k] < 0) return false;
                }
                return true;
            }
        }
        return false;
    }
}
