import { Handler } from '@netlify/functions';
import { NeuralNetworkEngine, Position } from '../../src/engine/NeuralNetworkEngine';
import { WorldClassEngine } from '../../src/engine/WorldClassEngine';
import { StrategicAdvisor } from '../../src/ai/StrategicAdvisor';

// Utiliser le moteur de niveau mondial par défaut
const engine = new WorldClassEngine();
const fallbackEngine = new NeuralNetworkEngine(); // Fallback si problème
const advisor = new StrategicAdvisor();

let isInitialized = false;

const initializeEngines = async () => {
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
        await initializeEngines();

        const body = JSON.parse(event.body || '{}');

        // Conversion du format d'entrée
        const position: Position = {
            board: body.boardState?.points?.map((p: any) => p.count * (p.player === 1 ? 1 : p.player === 2 ? -1 : 0)) || [],
            bar: { white: body.boardState?.bar?.white || 0, black: body.boardState?.bar?.black || 0 },
            borneOff: { white: body.boardState?.off?.white || 0, black: body.boardState?.off?.black || 0 },
            currentPlayer: body.player === 1 ? 'white' : 'black',
            dice: body.dice || []
        };

        // 1. Évaluation Technique (World-Class Engine avec DeepSeek)
        // Utiliser DeepSeek pour positions critiques (équité proche de 0)
        const useDeepSeek = body.useDeepSeek !== false; // Activé par défaut
        let evaluation;
        try {
            evaluation = await engine.evaluatePosition(position, useDeepSeek);
        } catch (error) {
            console.warn('WorldClassEngine error, using fallback:', error);
            evaluation = await fallbackEngine.evaluatePosition(position);
        }

        // 2. Analyse Stratégique (GPT-4o)
        // On passe le contexte si disponible
        const context = body.context || {
            gamePhase: 'unknown',
            matchScore: '0-0',
            opponentTendencies: 'unknown'
        };

        const strategicAdvice = await advisor.analyzePosition(position, evaluation, context);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                evaluation,
                bestMoves: evaluation.bestMoves,
                strategicAdvice, // Nouvelle section avec conseils GPT-4o
                recommendations: strategicAdvice.recommendedStrategy
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
