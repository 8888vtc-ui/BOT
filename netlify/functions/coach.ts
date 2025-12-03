import { Handler } from '@netlify/functions';

/**
 * Netlify Function pour le Coach AI
 * Appelle Ollama depuis le serveur (Netlify) au lieu du client
 * 
 * Variables d'environnement Netlify requises:
 * - OLLAMA_URL: URL du serveur Ollama (ex: https://bot-production-b9d6.up.railway.app)
 * - OLLAMA_MODEL: Modèle à utiliser (ex: deepseek-coder:latest)
 * - DEEPSEEK_API_KEY: (optionnel) Clé API DeepSeek pour fallback
 */

interface CoachRequest {
    question: string;
    gameContext?: {
        board?: any;
        dice?: number[];
        cubeValue?: number;
        cubeOwner?: string | null;
        matchLength?: number;
        score?: { [playerId: string]: number };
    };
    contextType?: 'game' | 'rules' | 'strategy' | 'clubs' | 'tournaments';
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'https://bot-production-b9d6.up.railway.app';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-coder:latest';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

/**
 * Détecter la langue de la question
 */
function detectLanguage(text: string): string {
    const frenchWords = ['comment', 'pourquoi', 'quand', 'où', 'commentaire', 'règle', 'stratégie'];
    const spanishWords = ['cómo', 'por qué', 'cuándo', 'dónde', 'regla', 'estrategia'];
    
    const lowerText = text.toLowerCase();
    
    if (frenchWords.some(word => lowerText.includes(word))) {
        return 'fr';
    }
    if (spanishWords.some(word => lowerText.includes(word))) {
        return 'es';
    }
    
    return 'en';
}

/**
 * Formater le contexte de jeu pour le prompt
 */
function formatGameContext(context?: CoachRequest['gameContext']): string {
    if (!context) return '';
    
    let formatted = '';
    
    if (context.board) {
        formatted += `Current board position: ${JSON.stringify(context.board.points?.slice(0, 6))}...\n`;
    }
    
    if (context.dice && context.dice.length > 0) {
        formatted += `Dice rolled: ${context.dice.join(', ')}\n`;
    }
    
    if (context.cubeValue) {
        formatted += `Doubling cube value: ${context.cubeValue}\n`;
        if (context.cubeOwner) {
            formatted += `Cube owner: ${context.cubeOwner}\n`;
        }
    }
    
    if (context.matchLength) {
        formatted += `Match length: ${context.matchLength} points\n`;
    }
    
    if (context.score) {
        formatted += `Current score: ${JSON.stringify(context.score)}\n`;
    }
    
    return formatted;
}

/**
 * Obtenir le prompt système selon le type de contexte
 */
function getSystemPrompt(contextType: string, language: string = 'en'): string {
    const prompts: Record<string, Record<string, string>> = {
        game: {
            en: `You are an expert backgammon coach. Analyze the current game position and provide strategic advice. Be concise, clear, and helpful. Focus on the best moves and explain why.`,
            fr: `Tu es un expert en backgammon. Analyse la position actuelle du jeu et donne des conseils stratégiques. Sois concis, clair et utile. Concentre-toi sur les meilleurs coups et explique pourquoi.`,
            es: `Eres un experto en backgammon. Analiza la posición actual del juego y proporciona consejos estratégicos. Sé conciso, claro y útil. Enfócate en los mejores movimientos y explica por qué.`
        },
        rules: {
            en: `You are a backgammon rules expert. Explain the rules clearly and accurately. Answer questions about game mechanics, doubling cube, match play, money game, and all backgammon rules.`,
            fr: `Tu es un expert des règles du backgammon. Explique les règles clairement et avec précision. Réponds aux questions sur la mécanique du jeu, le cube de doublement, le match play, le money game et toutes les règles du backgammon.`,
            es: `Eres un experto en las reglas del backgammon. Explica las reglas de manera clara y precisa. Responde preguntas sobre la mecánica del juego, el cubo de doblaje, el juego por partidos, el juego de dinero y todas las reglas del backgammon.`
        },
        strategy: {
            en: `You are a backgammon master strategist. Provide advanced strategic advice, opening theory, middle game tactics, endgame techniques, and doubling cube strategy.`,
            fr: `Tu es un maître en stratégie de backgammon. Donne des conseils stratégiques avancés, la théorie d'ouverture, les tactiques de milieu de partie, les techniques de fin de partie et la stratégie du cube de doublement.`,
            es: `Eres un maestro estratega de backgammon. Proporciona consejos estratégicos avanzados, teoría de apertura, tácticas de medio juego, técnicas de finales y estrategia del cubo de doblaje.`
        },
        clubs: {
            en: `You are an expert at finding backgammon clubs. Help users find clubs near them, understand club culture, and provide information about local backgammon communities.`,
            fr: `Tu es un expert pour trouver des clubs de backgammon. Aide les utilisateurs à trouver des clubs près de chez eux, comprendre la culture des clubs et fournir des informations sur les communautés locales de backgammon.`,
            es: `Eres un experto en encontrar clubes de backgammon. Ayuda a los usuarios a encontrar clubes cerca de ellos, entender la cultura de los clubes y proporcionar información sobre las comunidades locales de backgammon.`
        },
        tournaments: {
            en: `You are an expert on backgammon tournaments. Help users find tournaments, understand tournament formats, explain rating systems, and provide information about major backgammon events.`,
            fr: `Tu es un expert des tournois de backgammon. Aide les utilisateurs à trouver des tournois, comprendre les formats de tournois, expliquer les systèmes de classement et fournir des informations sur les grands événements de backgammon.`,
            es: `Eres un experto en torneos de backgammon. Ayuda a los usuarios a encontrar torneos, entender los formatos de torneos, explicar los sistemas de clasificación y proporcionar información sobre los principales eventos de backgammon.`
        }
    };
    
    return prompts[contextType]?.[language] || prompts[contextType]?.['en'] || prompts['game'][language] || prompts['game']['en'];
}

/**
 * Vérifier si Ollama est disponible
 */
async function isOllamaAvailable(): Promise<boolean> {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        return response.ok;
    } catch (error) {
        console.warn('[Coach] Ollama not available:', error);
        return false;
    }
}

/**
 * Demander au coach via Ollama
 */
async function askOllamaCoach(
    question: string,
    systemPrompt: string,
    userMessage: string
): Promise<string> {
    try {
        // Essayer d'abord /api/chat
        const chatPayload = {
            model: OLLAMA_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 500,
                top_p: 0.9,
                top_k: 40
            }
        };

        try {
            const chatResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatPayload),
                signal: AbortSignal.timeout(30000)
            });

            if (chatResponse.ok) {
                const chatData = await chatResponse.json();
                return (chatData.message?.content || chatData.response || 'No response from AI coach.').trim();
            }
        } catch (chatError) {
            console.log('[Coach] /api/chat failed, trying /api/generate...');
        }

        // Fallback vers /api/generate
        const generatePayload = {
            model: OLLAMA_MODEL,
            prompt: `${systemPrompt}\n\n${userMessage}`,
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 500
            }
        };

        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(generatePayload),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No error details');
            throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return (data.response || data.text || 'No response from AI coach.').trim();
    } catch (error: any) {
        console.error('[Coach] Ollama error:', error);
        throw error;
    }
}

/**
 * Demander au coach via DeepSeek API (fallback)
 */
async function askDeepSeekAPICoach(
    question: string,
    systemPrompt: string,
    userMessage: string
): Promise<string> {
    if (!DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek API key not configured');
    }

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 500
        }),
        signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`DeepSeek API error: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response from AI coach.';
}

export const handler: Handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const request: CoachRequest = JSON.parse(event.body || '{}');

        if (!request.question) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Question is required' })
            };
        }

        // Détecter la langue
        const language = detectLanguage(request.question);
        
        // Construire le prompt système
        const contextType = request.contextType || 'game';
        const systemPrompt = getSystemPrompt(contextType, language);
        
        // Formater le contexte de jeu
        const contextInfo = formatGameContext(request.gameContext);
        
        // Construire le message utilisateur
        let userMessage = request.question;
        if (contextInfo && contextType === 'game') {
            userMessage = `${contextInfo}\n\nQuestion: ${request.question}`;
        }

        // PRIORITÉ 1 : Ollama (GRATUIT)
        const ollamaAvailable = await isOllamaAvailable();
        
        if (ollamaAvailable) {
            try {
                console.log('[Coach] Using Ollama (FREE)');
                const response = await askOllamaCoach(request.question, systemPrompt, userMessage);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ answer: response })
                };
            } catch (error: any) {
                console.warn('[Coach] Ollama failed, trying DeepSeek API fallback:', error.message);
                // Continue to fallback
            }
        } else {
            console.log('[Coach] Ollama not available, skipping...');
        }

        // PRIORITÉ 2 : DeepSeek API (fallback)
        if (DEEPSEEK_API_KEY) {
            try {
                console.log('[Coach] Using DeepSeek API (fallback)');
                const response = await askDeepSeekAPICoach(request.question, systemPrompt, userMessage);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ answer: response })
                };
            } catch (error: any) {
                console.error('[Coach] DeepSeek API also failed:', error.message);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ 
                        error: 'AI Coach unavailable',
                        message: `Désolé, le coach AI rencontre des difficultés techniques. Veuillez réessayer plus tard. (Erreur: ${error.message || 'Unknown error'})`
                    })
                };
            }
        }

        // Aucune option disponible
        return {
            statusCode: 503,
            headers,
            body: JSON.stringify({ 
                error: 'AI Coach not configured',
                message: ollamaAvailable 
                    ? 'Le serveur Ollama est temporairement indisponible. Veuillez réessayer plus tard ou configurez DEEPSEEK_API_KEY pour utiliser le fallback DeepSeek API.'
                    : 'AI Coach is not configured. Please set OLLAMA_URL (recommended, FREE) or DEEPSEEK_API_KEY environment variable in Netlify.'
            })
        };

    } catch (error: any) {
        console.error('[Coach] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message || 'An unexpected error occurred'
            })
        };
    }
};

