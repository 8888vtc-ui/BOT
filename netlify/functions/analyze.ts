import { Handler } from '@netlify/functions';
import { NeuralNetworkEngine, Position } from '../../src/engine/NeuralNetworkEngine';

const engine = new NeuralNetworkEngine();
let isInitialized = false;

const initializeEngine = async () => {
    if (!isInitialized) {
        await engine.initialize();
        isInitialized = true;
    }
};

export const handler: Handler = async (event) => {
    // CORS Headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        await initializeEngine();

        const body = JSON.parse(event.body || '{}');

        // Convertir le format d'entrée (boardState) vers le format interne (Position)
        // Adapter selon ce que le frontend envoie
        const position: Position = {
            board: [], // À remplir
            bar: { white: 0, black: 0 },
            borneOff: { white: 0, black: 0 },
            currentPlayer: 'white',
            dice: body.dice || []
        };

        const evaluation = await engine.evaluatePosition(position);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                evaluation,
                bestMoves: evaluation.bestMoves
            })
        };

    } catch (error) {
        console.error('AI Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};
