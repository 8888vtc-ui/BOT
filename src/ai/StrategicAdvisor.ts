import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Position, Evaluation, Move } from '../engine/NeuralNetworkEngine.js';

export interface StrategicAdvice {
    analysis: string;
    recommendedStrategy: 'racing' | 'blitz' | 'prime' | 'backgame' | 'holding';
    riskLevel: 'low' | 'medium' | 'high';
    keyMoves: string[];
    commonMistakes: string[];
    positionEvaluation: {
        strength: number;
        volatility: number;
        complexity: number;
    };
}

export class StrategicAdvisor {
    private openai: OpenAI | null = null;
    private anthropic: Anthropic | null = null;
    private deepseek: OpenAI | null = null;
    private cache: Map<string, StrategicAdvice>;

    constructor() {
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        }
        if (process.env.DEEPSEEK_API_KEY) {
            this.deepseek = new OpenAI({
                apiKey: process.env.DEEPSEEK_API_KEY,
                baseURL: 'https://api.deepseek.com'
            });
        }
        this.cache = new Map();
    }

    async analyzePosition(
        position: Position,
        evaluation: Evaluation,
        context?: { gamePhase: string; matchScore: string; opponentTendencies: string }
    ): Promise<StrategicAdvice> {
        const cacheKey = this.generateCacheKey(position, context);

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        const positionDescription = this.describePosition(position);
        const analysisPrompt = this.buildAnalysisPrompt(
            positionDescription,
            evaluation,
            context
        );

        try {
            let analysis = '';

            // 1. DeepSeek V3 (Priorité 1)
            if (this.deepseek) {
                console.log('Using DeepSeek V3 for analysis...');
                const response = await this.deepseek.chat.completions.create({
                    model: "deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: `Tu es un expert mondial du backgammon. Analyse la position avec une profondeur stratégique exceptionnelle. Sois pédagogique.`
                        },
                        {
                            role: "user",
                            content: analysisPrompt
                        }
                    ],
                    temperature: 0.6,
                    max_tokens: 1000
                });
                analysis = response.choices[0]?.message?.content || "";
            }
            // 2. Claude 3.5 Sonnet (Priorité 2)
            else if (this.anthropic) {
                console.log('Using Claude 3.5 Sonnet for analysis...');
                const message = await this.anthropic.messages.create({
                    model: "claude-3-5-sonnet-20241022",
                    max_tokens: 1000,
                    temperature: 0.7,
                    system: "Tu es un expert mondial du backgammon. Analyse les positions avec une expertise stratégique profonde.",
                    messages: [
                        { role: "user", content: analysisPrompt }
                    ]
                });
                if (message.content[0].type === 'text') {
                    analysis = message.content[0].text;
                }
            }
            // 3. GPT-4o (Priorité 3)
            else if (this.openai) {
                console.log('Using GPT-4o for analysis...');
                const response = await this.openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: `Tu es un expert mondial du backgammon. Analyse les positions avec une expertise stratégique profonde.`
                        },
                        {
                            role: "user",
                            content: analysisPrompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 500
                });
                analysis = response.choices[0]?.message?.content || "";
            } else {
                console.warn('No AI provider available, using fallback.');
                return this.getFallbackAdvice(evaluation);
            }

            if (!analysis) throw new Error('Empty analysis received');

            const advice = this.parseAIResponse(analysis, evaluation);
            this.cache.set(cacheKey, advice);
            return advice;

        } catch (error) {
            console.error('AI API Error:', error);
            return this.getFallbackAdvice(evaluation);
        }
    }

    private buildAnalysisPrompt(
        positionDesc: string,
        evaluation: Evaluation,
        context?: any
    ): string {
        return `
CONTEXTE DE LA PARTIE:
${context ? `Phase: ${context.gamePhase}, Score: ${context.matchScore}, Tendances adverses: ${context.opponentTendencies}` : 'Phase: Milieu de partie'}

POSITION ACTUELLE:
${positionDesc}

ÉVALUATION DU MOTEUR:
- Probabilité de victoire: ${(evaluation.winProbability * 100).toFixed(1)}%
- Probabilité gammon: ${(evaluation.gammonProbability * 100).toFixed(1)}%
- Probabilité backgammon: ${(evaluation.backgammonProbability * 100).toFixed(1)}%
- Équité: ${evaluation.equity.toFixed(2)}
- Meilleurs coups: ${evaluation.bestMoves.map(m => `${m.from}→${m.to}`).join(', ')}

ANALYSE DEMANDÉE:
1. Évaluation stratégique globale
2. Plan recommandé pour les 3-4 prochains coups
3. Pièges à éviter
4. Adaptation à la position
5. Conseils psychologiques si pertinent

Format de réponse structurée:
`;
    }

    private describePosition(position: Position): string {
        return `
Joueur actuel: ${position.currentPlayer}
Dés: [${position.dice.join(', ')}]

Plateau:
${this.formatBoard(position.board)}

Barre:
- Blanc: ${position.bar.white} dame(s)
- Noir: ${position.bar.black} dame(s)

Borne off:
- Blanc: ${position.borneOff.white}/15
- Noir: ${position.borneOff.black}/15

Phase de jeu: ${this.determineGamePhase(position)}
        `.trim();
    }

    private formatBoard(board: number[]): string {
        let output = '';
        for (let i = 0; i < 24; i++) {
            const checkers = board[i] || 0;
            if (checkers !== 0) {
                output += `Point ${i + 1}: ${checkers > 0 ? checkers + ' blanc' : Math.abs(checkers) + ' noir'}\n`;
            }
        }
        return output;
    }

    private determineGamePhase(position: Position): string {
        const whiteOff = position.borneOff.white;
        const blackOff = position.borneOff.black;

        if (whiteOff > 10 || blackOff > 10) return 'Fin de partie';
        if (whiteOff > 5 || blackOff > 5) return 'Phase de course';
        return 'Milieu de partie';
    }

    private parseAIResponse(analysis: string, evaluation: Evaluation): StrategicAdvice {
        const strategyMatch = analysis.match(/stratégie[^.]*(course|blitz|prime|backgame|holding)/i);
        const recommendedStrategy = (strategyMatch?.[1]?.toLowerCase() || 'racing') as StrategicAdvice['recommendedStrategy'];

        const riskText = analysis.toLowerCase();
        let riskLevel: StrategicAdvice['riskLevel'] = 'medium';
        if (riskText.includes('risque élevé') || riskText.includes('risque fort')) riskLevel = 'high';
        if (riskText.includes('risque faible') || riskText.includes('prudent')) riskLevel = 'low';

        return {
            analysis,
            recommendedStrategy,
            riskLevel,
            keyMoves: [],
            commonMistakes: [],
            positionEvaluation: {
                strength: evaluation.winProbability,
                volatility: 0.5,
                complexity: 0.5
            }
        };
    }

    private generateCacheKey(position: Position, context?: any): string {
        const positionKey = JSON.stringify({
            board: position.board,
            currentPlayer: position.currentPlayer,
            dice: position.dice.sort()
        });
        const contextKey = context ? JSON.stringify(context) : '';
        return Buffer.from(positionKey + contextKey).toString('base64');
    }

    private getFallbackAdvice(evaluation: Evaluation): StrategicAdvice {
        const winPercent = evaluation.winProbability * 100;

        let strategy: StrategicAdvice['recommendedStrategy'] = 'racing';
        if (winPercent > 60) strategy = 'blitz';
        if (winPercent < 40) strategy = 'backgame';

        return {
            analysis: `Position évaluée à ${winPercent.toFixed(1)}% de chances de victoire. ${this.getFallbackStrategyText(strategy)}`,
            recommendedStrategy: strategy,
            riskLevel: 'medium',
            keyMoves: evaluation.bestMoves.map(m => `${m.from}-${m.to}`),
            commonMistakes: ['Jouer trop safe', 'Sous-estimer les gammons'],
            positionEvaluation: {
                strength: evaluation.winProbability,
                volatility: 0.5,
                complexity: 0.5
            }
        };
    }

    private getFallbackStrategyText(strategy: string): string {
        const strategies = {
            racing: 'Concentrez-vous sur la course et la sécurité.',
            blitz: 'Maintenez la pression offensive.',
            prime: 'Construisez un mur pour bloquer l\'adversaire.',
            backgame: 'Jouez défensif et préparez le contre-attaque.',
            holding: 'Maintenez la position et attendez une erreur.'
        };
        return strategies[strategy as keyof typeof strategies] || strategies.racing;
    }
}
