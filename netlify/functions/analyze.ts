import { Handler } from '@netlify/functions';

interface Move {
    from: number;
    to: number;
}

interface BoardState {
    points: Array<{ player: number; count: number }>;
    bar: { player1: number; player2: number };
    off: { player1: number; player2: number };
}

interface AnalyzeRequest {
    boardState: BoardState;
    dice: number[];
    player: 1 | 2;
}

export const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { boardState, dice, player }: AnalyzeRequest = JSON.parse(event.body || '{}');

        const analysis = analyzePosition(boardState, dice, player);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(analysis)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                error: 'Analysis failed',
                details: error instanceof Error ? error.message : 'Unknown'
            })
        };
    }
};

function analyzePosition(board: BoardState, dice: number[], player: 1 | 2) {
    const pipCount = calculatePipCount(board);
    const equity = calculateEquity(board, player);
    const winProb = equityToWinProb(equity);
    const bestMoves = findBestMoves(board, dice, player);

    return {
        equity: Math.round(equity * 1000) / 1000,
        winProbability: Math.round(winProb * 10) / 10,
        winGammon: Math.max(0, winProb - 70) * 0.15,
        loseGammon: Math.max(0, 30 - winProb) * 0.15,
        pipCount,
        bestMoves: bestMoves.slice(0, 5),
        analysis: `Pip count: P1=${pipCount.player1}, P2=${pipCount.player2}. Equity: ${equity.toFixed(3)}`
    };
}

function calculatePipCount(board: BoardState) {
    let pip1 = 0, pip2 = 0;
    board.points.forEach((p, i) => {
        if (p.player === 1) pip1 += (24 - i) * p.count;
        if (p.player === 2) pip2 += (i + 1) * p.count;
    });
    pip1 += board.bar.player1 * 25;
    pip2 += board.bar.player2 * 25;
    return { player1: pip1, player2: pip2 };
}

function calculateEquity(board: BoardState, player: 1 | 2): number {
    const pipCount = calculatePipCount(board);
    const pipDiff = player === 1
        ? pipCount.player2 - pipCount.player1
        : pipCount.player1 - pipCount.player2;

    let equity = pipDiff / 100;

    // Structure bonuses
    const home = board.points.slice(player === 1 ? 0 : 18, player === 1 ? 6 : 24);
    const homeScore = home.filter(p => p.player === player).length;
    equity += homeScore * 0.05;

    // Blot penalty
    const blots = board.points.filter(p => p.player === player && p.count === 1).length;
    equity -= blots * 0.08;

    // Prime bonus
    let prime = 0;
    for (let i = 0; i < board.points.length - 5; i++) {
        const slice = board.points.slice(i, i + 6);
        if (slice.every(p => p.player === player && p.count >= 2)) {
            prime = 1;
            break;
        }
    }
    equity += prime * 0.2;

    return Math.max(-1, Math.min(1, equity));
}

function equityToWinProb(equity: number): number {
    return 50 + (equity * 45);
}

function findBestMoves(board: BoardState, dice: number[], player: 1 | 2): Array<{ move: string; equity: number }> {
    const moves: Array<{ move: string; equity: number; from: number; to: number }> = [];

    dice.forEach(die => {
        for (let from = 0; from < 24; from++) {
            const point = board.points[from];
            if (point.player !== player || point.count === 0) continue;

            const to = player === 1 ? from - die : from + die;
            if (to < 0 || to >= 24) continue;

            const target = board.points[to];
            let score = 0;

            if (target.player === player) score += 0.15;
            if (target.player === (player === 1 ? 2 : 1) && target.count === 1) score += 0.3;
            if ((player === 1 && to < 6) || (player === 2 && to >= 18)) score += 0.1;

            moves.push({
                move: `${from + 1}/${to + 1}`,
                equity: score,
                from: from + 1,
                to: to + 1
            });
        }
    });

    return moves.sort((a, b) => b.equity - a.equity).map(m => ({ move: m.move, equity: m.equity }));
}
