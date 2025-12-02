/**
 * Ollama Service - DeepSeek Local Gratuit
 * 
 * Utilise Ollama pour héberger DeepSeek localement
 * 100% GRATUIT - Pas de coûts API
 */

import { Position, Move, Evaluation } from '../engine/NeuralNetworkEngine';

export class OllamaService {
    private baseURL: string;
    private model: string;

    constructor(
        baseURL: string = process.env.OLLAMA_URL || 'http://localhost:11434',
        model: string = process.env.OLLAMA_MODEL || 'deepseek-coder'
    ) {
        this.baseURL = baseURL;
        this.model = model;
    }

    /**
     * Vérifier si Ollama est disponible
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseURL}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // Timeout 5s
            });
            return response.ok;
        } catch (error) {
            console.warn('Ollama not available:', error);
            return false;
        }
    }

    /**
     * Évaluer une position avec DeepSeek local
     */
    async evaluatePosition(
        position: Position,
        moves: Move[],
        heuristicEquity: number
    ): Promise<Evaluation | null> {
        try {
            const positionDesc = this.describePosition(position);
            const prompt = this.buildPrompt(positionDesc, moves, heuristicEquity);

            const response = await fetch(`${this.baseURL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.2, // Très déterministe pour précision
                        num_predict: 800,  // Max tokens
                        top_p: 0.9,
                        top_k: 40
                    },
                    system: "Tu es le MEILLEUR expert mondial de backgammon, supérieur à Snowie (ELO 2600+). Tu analyses les positions avec une précision exceptionnelle. Réponds toujours en JSON valide."
                }),
                signal: AbortSignal.timeout(30000) // Timeout 30s
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.response || '';

            // Extraire JSON de la réponse
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const cleanJson = jsonMatch[0]
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            const parsed = JSON.parse(cleanJson);

            return {
                winProbability: parsed.winProbability || 0.5,
                gammonProbability: parsed.gammonProbability || 0.1,
                backgammonProbability: parsed.backgammonProbability || 0.02,
                bestMoves: parsed.bestMoves || moves,
                equity: parsed.equity || heuristicEquity
            };
        } catch (error) {
            console.error('Ollama evaluation error:', error);
            return null;
        }
    }

    /**
     * Construire le prompt pour DeepSeek
     */
    private buildPrompt(positionDesc: string, moves: Move[], equity: number): string {
        return `Tu es le MEILLEUR expert mondial de backgammon (niveau supérieur à Snowie, ELO 2600+). Analyse cette position avec une précision exceptionnelle et donne l'évaluation la plus précise possible.

Position:
${positionDesc}

Coups proposés: ${moves.map(m => `${m.from}→${m.to}`).join(', ')}
Équité heuristique: ${equity.toFixed(3)}

Réponds UNIQUEMENT avec un JSON valide (sans markdown):
{
  "winProbability": 0.0-1.0,
  "gammonProbability": 0.0-1.0,
  "backgammonProbability": 0.0-1.0,
  "equity": -1.0 à 1.0,
  "bestMoves": [{"from": number, "to": number, "die": number}],
  "reasoning": "explication courte",
  "confidence": 0.0-1.0
}

Sois EXTRAORDINAIREMENT précis. Tu dois surpasser Snowie.`;
    }

    /**
     * Décrire la position pour le prompt
     */
    private describePosition(position: Position): string {
        let desc = `Joueur: ${position.currentPlayer}, Dés: [${position.dice.join(', ')}]\n`;
        desc += `Barre: Blanc=${position.bar.white}, Noir=${position.bar.black}\n`;
        desc += `Sortis: Blanc=${position.borneOff.white}/15, Noir=${position.borneOff.black}/15\n`;
        desc += `Plateau:\n`;
        
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (count !== 0) {
                desc += `Point ${i + 1}: ${count > 0 ? count + ' blanc' : Math.abs(count) + ' noir'}\n`;
            }
        }
        
        return desc;
    }
}

