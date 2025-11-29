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
    moves: Move[];
    initialPosition?: string;
}

interface GNUBGAnalysis {
    equity: number;
    winProbability: number;
    loseGammon: number;
    winGammon: number;
    errors: Array<{
        moveNumber: number;
        type: 'blunder' | 'error' | 'doubtful';
        equityLoss: number;
        correctMove: string;
    }>;
    bestMoves: Array<{
        from: number;
        to: number;
        equity: number;
    }>;
}

export const handler: Handler = async (event) => {
    // CORS Preflight
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
        const { moves, initialPosition }: AnalyzeRequest = JSON.parse(event.body || '{}');

        if (!moves || moves.length === 0) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'No moves provided' })
            };
        }

        // Générer le fichier de commandes GNUBG
        const gnubgCommands = generateGNUBGCommands(moves, initialPosition);

        const inputFile = `/tmp/game-${Date.now()}.txt`;
        const outputFile = `/tmp/analysis-${Date.now()}.sgf`;

        await fs.writeFile(inputFile, gnubgCommands);

        // Chemin vers le binaire GNUBG
        const gnubgPath = path.join(process.cwd(), 'netlify/bin/gnubg');

        console.log('Executing GNUBG analysis...');

        const { stdout, stderr } = await execAsync(
            `${gnubgPath} -t < ${inputFile}`,
            { timeout: 25000 } // 25s max
        );

        console.log('GNUBG output:', stdout.substring(0, 500));

        // Parser la sortie
        const analysis = parseGNUBGOutput(stdout);

        // Nettoyer les fichiers temporaires
        await fs.unlink(inputFile).catch(() => { });
        await fs.unlink(outputFile).catch(() => { });

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

function generateGNUBGCommands(moves: Move[], initialPosition?: string): string {
    let commands = '';

    // Initialiser une nouvelle partie
    commands += 'new game\n';
    commands += 'set automatic off\n';
    commands += 'set display off\n';

    // Si position initiale fournie (format XGID)
    if (initialPosition) {
        commands += `set board ${initialPosition}\n`;
    }

    // Jouer tous les moves
    moves.forEach(move => {
        commands += `move ${move.from} ${move.to}\n`;
    });

    // Analyser le match
    commands += 'analyze match\n';

    // Obtenir les suggestions
    commands += 'hint\n';

    // Afficher les statistiques
    commands += 'show statistics match\n';

    commands += 'quit\n';

    return commands;
}

function parseGNUBGOutput(output: string): GNUBGAnalysis {
    const lines = output.split('\n');

    const analysis: GNUBGAnalysis = {
        equity: 0,
        winProbability: 50,
        loseGammon: 0,
        winGammon: 0,
        errors: [],
        bestMoves: []
    };

    // Parser l'équité et les probabilités
    for (const line of lines) {
        // Exemple de ligne GNUBG :
        // "Eq.: +0.123  Win: 52.3%  W g: 12.1%  W bg: 0.5%"

        if (line.includes('Eq.:')) {
            const equityMatch = line.match(/Eq\.: ([+-]?\d+\.\d+)/);
            if (equityMatch) {
                analysis.equity = parseFloat(equityMatch[1]);
            }
        }

        if (line.includes('Win:')) {
            const winMatch = line.match(/Win: (\d+\.\d+)%/);
            if (winMatch) {
                analysis.winProbability = parseFloat(winMatch[1]);
            }
        }

        if (line.includes('W g:')) {
            const wgMatch = line.match(/W g: (\d+\.\d+)%/);
            if (wgMatch) {
                analysis.winGammon = parseFloat(wgMatch[1]);
            }
        }

        // Détecter les erreurs
        if (line.includes('blunder') || line.includes('error') || line.includes('doubtful')) {
            const errorType = line.includes('blunder') ? 'blunder' :
                line.includes('error') ? 'error' : 'doubtful';

            const equityLossMatch = line.match(/\[([+-]?\d+\.\d+)\]/);

            analysis.errors.push({
                moveNumber: analysis.errors.length + 1,
                type: errorType,
                equityLoss: equityLossMatch ? Math.abs(parseFloat(equityLossMatch[1])) : 0,
                correctMove: 'TBD' // À extraire de la sortie GNUBG
            });
        }
    }

    return analysis;
}
