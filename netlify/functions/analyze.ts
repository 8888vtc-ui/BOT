import { Handler } from '@netlify/functions';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface Move {
    from: number;
    to: number;
    player: 1 | 2;
}

interface AnalyzeRequest {
    position?: string; // XGID format
    moves: Move[];
    dice?: number[];
}

interface GNUBGAnalysis {
    equity: number;
    winProbability: number;
    winGammon: number;
    loseGammon: number;
    bestMoves: Array<{
        move: string;
        equity: number;
    }>;
    analysis: string;
}

export const handler: Handler = async (event) => {
    // CORS
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
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { position, moves, dice }: AnalyzeRequest = JSON.parse(event.body || '{}');

        // Générer les commandes GNUBG
        const commands = generateGNUBGCommands(position, moves, dice);
        console.log('GNUBG Commands:', commands);

        // Créer fichier temporaire
        const inputFile = `/tmp/gnubg-${Date.now()}.txt`;
        await fs.writeFile(inputFile, commands);

        // Chemin vers le binaire GNUBG
        const gnubgPath = path.join(process.cwd(), 'netlify/bin/gnubg');

        // Exécuter GNUBG
        const { stdout, stderr } = await execAsync(
            `${gnubgPath} -t < ${inputFile}`,
            {
                timeout: 25000, // 25s max
                maxBuffer: 10 * 1024 * 1024 // 10MB
            }
        );

        console.log('GNUBG Output (first 500 chars):', stdout.substring(0, 500));
        if (stderr) console.error('GNUBG Stderr:', stderr);

        // Parser la sortie
        const analysis = parseGNUBGOutput(stdout);

        // Nettoyer
        await fs.unlink(inputFile).catch(() => { });

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(analysis)
        };

    } catch (error) {
        console.error('GNUBG Analysis Error:', error);

        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                error: 'Analysis failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};

function generateGNUBGCommands(position?: string, moves?: Move[], dice?: number[]): string {
    let commands = '';

    // Initialiser
    commands += 'new game\n';
    commands += 'set output rawboard off\n';
    commands += 'set output matchpc off\n';

    // Charger position si fournie
    if (position) {
        commands += `set board ${position}\n`;
    }

    // Jouer les moves si fournis
    if (moves && moves.length > 0) {
        moves.forEach(move => {
            commands += `move ${move.from} ${move.to}\n`;
        });
    }

    // Analyser
    commands += 'analyze match\n';
    commands += 'hint\n';
    commands += 'show statistics match\n';

    // Calculer l'equity
    commands += 'evaluate\n';

    commands += 'quit\n';

    return commands;
}

function parseGNUBGOutput(output: string): GNUBGAnalysis {
    const lines = output.split('\n');

    const analysis: GNUBGAnalysis = {
        equity: 0,
        winProbability: 50,
        winGammon: 0,
        loseGammon: 0,
        bestMoves: [],
        analysis: ''
    };

    let fullAnalysis = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        fullAnalysis += line + '\n';

        // Parser l'équité
        // Format: "Eq.: +0.123" ou "Equity: +0.123"
        const equityMatch = line.match(/Eq(?:uity)?\s*:\s*([+-]?\d+\.?\d*)/i);
        if (equityMatch) {
            analysis.equity = parseFloat(equityMatch[1]);
        }

        // Parser les probabilités de victoire
        // Format: "Win: 52.3%" ou "W: 52.3%"
        const winMatch = line.match(/W(?:in)?\s*:\s*(\d+\.?\d*)%/i);
        if (winMatch) {
            analysis.winProbability = parseFloat(winMatch[1]);
        }

        // Gammon win
        const wgMatch = line.match(/W\s*g\s*:\s*(\d+\.?\d*)%/i);
        if (wgMatch) {
            analysis.winGammon = parseFloat(wgMatch[1]);
        }

        // Gammon loss
        const lgMatch = line.match(/L\s*g\s*:\s*(\d+\.?\d*)%/i);
        if (lgMatch) {
            analysis.loseGammon = parseFloat(lgMatch[1]);
        }

        // Parser les meilleurs coups
        // Format: "1. 24/22 13/11  Eq.: +0.150"
        const moveMatch = line.match(/^\s*\d+\.\s+([0-9/\s]+).*Eq\.\s*:\s*([+-]?\d+\.?\d*)/);
        if (moveMatch) {
            analysis.bestMoves.push({
                move: moveMatch[1].trim(),
                equity: parseFloat(moveMatch[2])
            });
        }
    }

    analysis.analysis = fullAnalysis;

    return analysis;
}
