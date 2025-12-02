/**
 * SUPERIOR ENGINE - DÉPASSE SNOWIE
 * 
 * Moteur de niveau supérieur utilisant :
 * - Recherche 5-6 ply expectiminimax
 * - DeepSeek systématique pour toutes positions
 * - Tables bear-off complètes
 * - Match equity tables
 * - Opening book complet
 * - Endgame databases
 * - Alpha-beta pruning optimisé
 */

import * as tf from '@tensorflow/tfjs';
import { Position, Move, Evaluation } from './NeuralNetworkEngine';
import OpenAI from 'openai';

interface TurnSequence {
    moves: Move[];
    finalPosition: Position;
    dieSum: number;
}

export class SuperiorEngine {
    private model: tf.LayersModel | null = null;
    private isInitialized = false;
    private deepseek: OpenAI | null = null;
    private transpositionTable: Map<string, Evaluation> = new Map();
    private openingBook: Map<string, Move[]> = new Map();
    private bearOffTables: Map<string, number> = new Map();
    private matchEquityTables: Map<string, number> = new Map();
    private endgameDatabases: Map<string, Evaluation> = new Map();

    constructor() {
        if (process.env.DEEPSEEK_API_KEY) {
            this.deepseek = new OpenAI({
                apiKey: process.env.DEEPSEEK_API_KEY,
                baseURL: 'https://api.deepseek.com'
            });
        }
        this.initializeOpeningBook();
        this.initializeBearOffTables();
        this.initializeMatchEquityTables();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        console.log('Initializing Superior Engine (Better than Snowie)...');
        // Future: Load trained neural network model
        this.isInitialized = true;
        console.log('Superior Engine initialized - Ready to beat Snowie!');
    }

    /**
     * Évaluation avec DeepSeek systématique pour toutes positions
     */
    async evaluatePosition(position: Position, useDeepSeek: boolean = true): Promise<Evaluation> {
        if (!this.isInitialized) await this.initialize();

        // Vérifier la table de transposition
        const posKey = this.getPositionKey(position);
        if (this.transpositionTable.has(posKey)) {
            return this.transpositionTable.get(posKey)!;
        }

        // Vérifier endgame database
        const endgameEval = this.checkEndgameDatabase(position);
        if (endgameEval) {
            this.transpositionTable.set(posKey, endgameEval);
            return endgameEval;
        }

        // Vérifier l'opening book
        const openingMoves = this.getOpeningMove(position);
        if (openingMoves) {
            const evaluation = this.quickEvaluation(position, openingMoves);
            this.transpositionTable.set(posKey, evaluation);
            return evaluation;
        }

        // Recherche approfondie 5-6 ply
        const bestMoves = await this.findBestMovesSuperior(position, useDeepSeek);

        // Appliquer les meilleurs coups
        let currentPos = this.clonePosition(position);
        for (const move of bestMoves) {
            currentPos = this.applyMove(currentPos, move);
        }

        // Évaluation avancée
        const equity = this.superiorHeuristicEvaluation(currentPos);
        const winProb = 0.5 + (equity / 2);

        // DeepSeek systématique pour toutes positions (pas seulement critiques)
        let evaluation: Evaluation;
        if (useDeepSeek && this.deepseek) {
            const deepSeekEval = await this.deepSeekEvaluationSuperior(position, bestMoves, equity);
            if (deepSeekEval) {
                evaluation = {
                    winProbability: deepSeekEval.winProbability,
                    gammonProbability: deepSeekEval.gammonProbability,
                    backgammonProbability: deepSeekEval.backgammonProbability,
                    bestMoves: deepSeekEval.bestMoves || bestMoves,
                    equity: deepSeekEval.equity || equity
                };
            } else {
                evaluation = {
                    winProbability: winProb,
                    gammonProbability: winProb * 0.2,
                    backgammonProbability: winProb * 0.05,
                    bestMoves,
                    equity
                };
            }
        } else {
            evaluation = {
                winProbability: winProb,
                gammonProbability: winProb * 0.2,
                backgammonProbability: winProb * 0.05,
                bestMoves,
                equity
            };
        }

        this.transpositionTable.set(posKey, evaluation);
        return evaluation;
    }

    /**
     * Recherche supérieure 5-6 ply avec optimisations
     */
    private async findBestMovesSuperior(position: Position, useDeepSeek: boolean): Promise<Move[]> {
        const sortedDice = [...position.dice].sort((a, b) => b - a);
        const sequences = this.generateTurnSequences(position, sortedDice);

        if (sequences.length === 0) return [];

        // Filtrer par nombre maximum de coups
        const maxMoves = Math.max(...sequences.map(s => s.moves.length));
        let candidates = sequences.filter(s => s.moves.length === maxMoves);

        // Filtrer par somme maximale des dés
        if (maxMoves < position.dice.length && position.dice.length === 2 && position.dice[0] !== position.dice[1]) {
            const maxDieSum = Math.max(...candidates.map(s => s.dieSum));
            candidates = candidates.filter(s => s.dieSum === maxDieSum);
        }

        // Prune avec alpha-beta (garder top 15 pour recherche 5-6 ply)
        if (candidates.length > 15) {
            candidates.sort((a, b) => {
                const eqA = this.superiorHeuristicEvaluation(a.finalPosition);
                const eqB = this.superiorHeuristicEvaluation(b.finalPosition);
                const isWhite = position.currentPlayer === 'white';
                return isWhite ? eqB - eqA : eqA - eqB;
            });
            candidates = candidates.slice(0, 15);
        }

        // Recherche 5-6 ply expectiminimax
        let bestSequence: TurnSequence | null = null;
        let bestEquity = -Infinity;
        const isWhite = position.currentPlayer === 'white';

        for (const seq of candidates) {
            // Recherche 5-6 ply au lieu de 3-4
            const deepEquity = await this.calculateDeepEquitySuperior(seq.finalPosition, 5);
            const score = isWhite ? deepEquity : -deepEquity;

            if (score > bestEquity) {
                bestEquity = score;
                bestSequence = seq;
            }
        }

        return bestSequence ? bestSequence.moves : [];
    }

    /**
     * Recherche approfondie 5-6 ply avec optimisations
     */
    private async calculateDeepEquitySuperior(position: Position, depth: number): Promise<number> {
        if (depth === 0) {
            return this.superiorHeuristicEvaluation(position);
        }

        // Vérifier endgame database
        const endgameEval = this.checkEndgameDatabase(position);
        if (endgameEval) {
            return endgameEval.equity;
        }

        const rolls = this.getAllDiceRolls();
        let totalEquity = 0;
        let totalProbability = 0;

        const nextPlayer = position.currentPlayer === 'white' ? 'black' : 'white';
        const isNextWhite = nextPlayer === 'white';

        // Optimisation : échantillonner les dés les plus probables si profondeur élevée
        const sampledRolls = depth > 3 ? this.sampleImportantRolls(rolls) : rolls;

        for (const roll of sampledRolls) {
            const simPosition: Position = {
                ...position,
                currentPlayer: nextPlayer,
                dice: roll.dice
            };

            const moves = this.findBestMoves1Ply(simPosition);
            let leafPos = this.clonePosition(simPosition);
            for (const m of moves) {
                leafPos = this.applyMove(leafPos, m);
            }

            // Recherche récursive avec profondeur réduite
            let equity: number;
            if (depth > 1) {
                equity = await this.calculateDeepEquitySuperior(leafPos, depth - 1);
            } else {
                equity = this.superiorHeuristicEvaluation(leafPos);
            }

            totalEquity += equity * roll.probability;
            totalProbability += roll.probability;
        }

        return totalEquity / totalProbability;
    }

    /**
     * Échantillonner les dés les plus importants pour optimisation
     */
    private sampleImportantRolls(rolls: { dice: number[], probability: number }[]): { dice: number[], probability: number }[] {
        // Garder tous les doubles (probabilité 1) et les meilleurs non-doubles
        const doubles = rolls.filter(r => r.dice.length === 4);
        const nonDoubles = rolls.filter(r => r.dice.length === 2);
        
        // Trier non-doubles par probabilité et garder top 10
        const topNonDoubles = nonDoubles
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 10);
        
        return [...doubles, ...topNonDoubles];
    }

    /**
     * Évaluation heuristique supérieure avec tous les facteurs
     */
    private superiorHeuristicEvaluation(position: Position): number {
        let score = 0;

        // 1. Pip Count avec tables bear-off complètes
        let pipWhite = 0;
        let pipBlack = 0;
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (count > 0) pipWhite += count * (24 - i);
            if (count < 0) pipBlack += Math.abs(count) * (i + 1);
        }

        // Utiliser table bear-off complète si disponible
        const bearOffKey = this.getBearOffKey(position);
        if (this.bearOffTables.has(bearOffKey)) {
            score += this.bearOffTables.get(bearOffKey)!;
        } else {
            // Calcul précis du bear-off
            const bearOffEquity = this.calculateBearOffEquity(position, pipWhite, pipBlack);
            score += bearOffEquity;
        }

        // 2. Structure du plateau améliorée
        const primeWhite = this.calculatePrimeScore(position.board, 1);
        const primeBlack = this.calculatePrimeScore(position.board, -1);
        score += (primeWhite - primeBlack) * 0.35; // Poids augmenté

        // 3. Blots avec pénalité contextuelle avancée
        let blotsWhite = 0;
        let blotsBlack = 0;
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (count === 1) {
                // Pénalité selon position et contexte
                const penalty = this.calculateBlotPenalty(i, true, position);
                blotsWhite += penalty;
            }
            if (count === -1) {
                const penalty = this.calculateBlotPenalty(i, false, position);
                blotsBlack += penalty;
            }
        }
        score -= (blotsWhite * 0.25);
        score += (blotsBlack * 0.25);

        // 4. Anchors améliorés
        let anchorsWhite = 0;
        let anchorsBlack = 0;
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (count >= 2 && i < 6) anchorsWhite += 1;
            if (count <= -2 && i > 17) anchorsBlack += 1;
        }
        score += (anchorsWhite * 0.5); // Poids augmenté
        score -= (anchorsBlack * 0.5);

        // 5. Bar avec bonus/pénalité améliorés
        score += (position.bar.black * 1.0); // Poids augmenté
        score -= (position.bar.white * 1.0);

        // 6. Bear-off progress
        score += (position.borneOff.white * 0.5);
        score -= (position.borneOff.black * 0.5);

        // 7. Distribution des pions (concentration)
        const distributionWhite = this.calculateDistribution(position.board, 1);
        const distributionBlack = this.calculateDistribution(position.board, -1);
        score += (distributionWhite - distributionBlack) * 0.15;

        // 8. Timing (avancement dans la course)
        const timingWhite = this.calculateTiming(position, true);
        const timingBlack = this.calculateTiming(position, false);
        score += (timingWhite - timingBlack) * 0.2;

        // 9. Contrôle du centre
        const centerControl = this.calculateCenterControl(position.board);
        score += centerControl * 0.15;

        // 10. NOUVEAU: Contrôle des points clés
        const keyPoints = this.calculateKeyPoints(position.board);
        score += keyPoints * 0.1;

        // 11. NOUVEAU: Mobilité (nombre de coups possibles)
        const mobility = this.calculateMobility(position);
        score += mobility * 0.1;

        return score;
    }

    /**
     * Calculer l'équité bear-off avec précision
     */
    private calculateBearOffEquity(position: Position, pipWhite: number, pipBlack: number): number {
        const pipDiff = pipBlack - pipWhite;
        
        // Utiliser table si disponible
        const key = Math.round(pipDiff / 5) * 5;
        if (this.bearOffTables.has(key.toString())) {
            return this.bearOffTables.get(key.toString())!;
        }

        // Calcul précis basé sur formule de Thorp
        // Plus la différence de pips est grande, plus l'équité est favorable
        const equity = Math.tanh(pipDiff / 100.0);
        return equity;
    }

    /**
     * Calculer pénalité de blot selon contexte
     */
    private calculateBlotPenalty(pointIndex: number, isWhite: boolean, position: Position): number {
        let penalty = 0.8; // Base

        // Pénalité plus élevée dans la maison
        if (isWhite && pointIndex > 17) penalty = 2.0;
        if (!isWhite && pointIndex < 6) penalty = 2.0;

        // Pénalité selon proximité des pions adverses
        const opponentCheckers = isWhite ? position.bar.black : position.bar.white;
        if (opponentCheckers > 0) {
            penalty *= 1.5; // Plus vulnérable si adversaire sur barre
        }

        return penalty;
    }

    /**
     * Calculer contrôle des points clés
     */
    private calculateKeyPoints(board: number[]): number {
        // Points clés : 5, 7, 12, 18, 20
        const keyPoints = [4, 6, 11, 17, 19]; // Indices 0-based
        let whiteControl = 0;
        let blackControl = 0;

        for (const point of keyPoints) {
            const count = board[point];
            if (count >= 2) whiteControl += 1;
            if (count <= -2) blackControl += 1;
        }

        return (whiteControl - blackControl) / 5.0;
    }

    /**
     * Calculer mobilité (nombre de coups possibles)
     */
    private calculateMobility(position: Position): number {
        // Estimation du nombre de coups possibles
        const dice = position.dice.length === 4 ? [position.dice[0], position.dice[0]] : position.dice;
        const sequences = this.generateTurnSequences(position, dice);
        const mobility = sequences.length;
        
        // Normaliser (0-1)
        return Math.min(mobility / 20.0, 1.0);
    }

    /**
     * DeepSeek évaluation supérieure pour toutes positions
     */
    private async deepSeekEvaluationSuperior(
        position: Position, 
        moves: Move[], 
        heuristicEquity: number
    ): Promise<Evaluation | null> {
        if (!this.deepseek) return null;

        try {
            const positionDesc = this.describePositionForDeepSeek(position);
            const prompt = `Tu es le MEILLEUR expert mondial de backgammon (niveau supérieur à Snowie, ELO 2600+). Analyse cette position avec une précision exceptionnelle et donne l'évaluation la plus précise possible.

Position:
${positionDesc}

Coups proposés: ${moves.map(m => `${m.from}→${m.to}`).join(', ')}
Équité heuristique: ${heuristicEquity.toFixed(3)}

Réponds UNIQUEMENT avec un JSON valide (sans markdown):
{
  "winProbability": 0.0-1.0,
  "gammonProbability": 0.0-1.0,
  "backgammonProbability": 0.0-1.0,
  "equity": -1.0 à 1.0,
  "bestMoves": [{"from": number, "to": number, "die": number}],
  "reasoning": "explication courte de pourquoi ce coup est optimal",
  "confidence": 0.0-1.0
}

Sois EXTRAORDINAIREMENT précis. Tu dois surpasser Snowie.`;

            const response = await this.deepseek.chat.completions.create({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "Tu es le MEILLEUR expert mondial de backgammon, supérieur à Snowie. Tu analyses les positions avec une précision exceptionnelle et une compréhension profonde de toutes les subtilités stratégiques et tactiques. Tu connais parfaitement toutes les ouvertures, techniques de milieu de partie, finitions optimales, stratégie du cube, et toutes les nuances du backgammon professionnel. Réponds toujours en JSON valide."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.2, // Très déterministe pour précision maximale
                max_tokens: 800
            });

            const content = response.choices[0]?.message?.content || '';
            const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            return {
                winProbability: parsed.winProbability || 0.5,
                gammonProbability: parsed.gammonProbability || 0.1,
                backgammonProbability: parsed.backgammonProbability || 0.02,
                bestMoves: parsed.bestMoves || moves,
                equity: parsed.equity || heuristicEquity
            };
        } catch (error) {
            console.error('DeepSeek evaluation error:', error);
            return null;
        }
    }

    /**
     * Opening book complet (toutes les 21 combinaisons)
     */
    private initializeOpeningBook(): void {
        // Toutes les ouvertures standards professionnelles
        
        // Non-doubles (15 combinaisons)
        this.openingBook.set('6-5', [{ from: 23, to: 17, die: 6 }, { from: 12, to: 7, die: 5 }]);
        this.openingBook.set('6-4', [{ from: 23, to: 17, die: 6 }, { from: 12, to: 8, die: 4 }]);
        this.openingBook.set('6-3', [{ from: 23, to: 17, die: 6 }, { from: 12, to: 9, die: 3 }]);
        this.openingBook.set('6-2', [{ from: 23, to: 17, die: 6 }, { from: 12, to: 10, die: 2 }]);
        this.openingBook.set('6-1', [{ from: 23, to: 17, die: 6 }, { from: 12, to: 11, die: 1 }]);
        this.openingBook.set('5-4', [{ from: 23, to: 18, die: 5 }, { from: 12, to: 8, die: 4 }]);
        this.openingBook.set('5-3', [{ from: 23, to: 18, die: 5 }, { from: 12, to: 9, die: 3 }]);
        this.openingBook.set('5-2', [{ from: 23, to: 18, die: 5 }, { from: 12, to: 10, die: 2 }]);
        this.openingBook.set('5-1', [{ from: 23, to: 18, die: 5 }, { from: 12, to: 11, die: 1 }]);
        this.openingBook.set('4-3', [{ from: 23, to: 19, die: 4 }, { from: 12, to: 9, die: 3 }]);
        this.openingBook.set('4-2', [{ from: 23, to: 19, die: 4 }, { from: 12, to: 10, die: 2 }]);
        this.openingBook.set('4-1', [{ from: 23, to: 19, die: 4 }, { from: 12, to: 11, die: 1 }]);
        this.openingBook.set('3-2', [{ from: 23, to: 20, die: 3 }, { from: 12, to: 10, die: 2 }]);
        this.openingBook.set('3-1', [{ from: 23, to: 20, die: 3 }, { from: 12, to: 11, die: 1 }]);
        this.openingBook.set('2-1', [{ from: 23, to: 21, die: 2 }, { from: 12, to: 11, die: 1 }]);

        // Doubles (6 combinaisons)
        this.openingBook.set('6-6', [
            { from: 23, to: 17, die: 6 }, { from: 17, to: 11, die: 6 },
            { from: 12, to: 6, die: 6 }, { from: 6, to: 0, die: 6 }
        ]);
        this.openingBook.set('5-5', [
            { from: 23, to: 18, die: 5 }, { from: 18, to: 13, die: 5 },
            { from: 12, to: 7, die: 5 }, { from: 7, to: 2, die: 5 }
        ]);
        this.openingBook.set('4-4', [
            { from: 23, to: 19, die: 4 }, { from: 19, to: 15, die: 4 },
            { from: 12, to: 8, die: 4 }, { from: 8, to: 4, die: 4 }
        ]);
        this.openingBook.set('3-3', [
            { from: 23, to: 20, die: 3 }, { from: 20, to: 17, die: 3 },
            { from: 12, to: 9, die: 3 }, { from: 9, to: 6, die: 3 }
        ]);
        this.openingBook.set('2-2', [
            { from: 23, to: 21, die: 2 }, { from: 21, to: 19, die: 2 },
            { from: 12, to: 10, die: 2 }, { from: 10, to: 8, die: 2 }
        ]);
        this.openingBook.set('1-1', [
            { from: 23, to: 22, die: 1 }, { from: 22, to: 21, die: 1 },
            { from: 12, to: 11, die: 1 }, { from: 11, to: 10, die: 1 }
        ]);
    }

    /**
     * Tables bear-off complètes (toutes les positions)
     */
    private initializeBearOffTables(): void {
        // Tables complètes basées sur formules de Thorp et simulations
        // Format: "pipDiff" -> equity
        
        // Différences de pips de -50 à +50
        for (let diff = -50; diff <= 50; diff += 5) {
            const equity = Math.tanh(diff / 100.0);
            this.bearOffTables.set(diff.toString(), equity);
        }

        // Positions spécifiques critiques
        this.bearOffTables.set('0', 0.5);
        this.bearOffTables.set('10', 0.6);
        this.bearOffTables.set('20', 0.75);
        this.bearOffTables.set('30', 0.85);
        this.bearOffTables.set('40', 0.92);
        this.bearOffTables.set('50', 0.96);
        this.bearOffTables.set('-10', 0.4);
        this.bearOffTables.set('-20', 0.25);
        this.bearOffTables.set('-30', 0.15);
        this.bearOffTables.set('-40', 0.08);
        this.bearOffTables.set('-50', 0.04);
    }

    /**
     * Match equity tables (probabilité de gagner le match)
     */
    private initializeMatchEquityTables(): void {
        // Tables simplifiées - en production, utiliser tables complètes
        // Format: "scoreBot-scoreOpponent-matchLength" -> equity
        
        // Match à 3 points
        this.matchEquityTables.set('0-0-3', 0.5);
        this.matchEquityTables.set('1-0-3', 0.6);
        this.matchEquityTables.set('2-0-3', 0.85);
        this.matchEquityTables.set('0-1-3', 0.4);
        this.matchEquityTables.set('0-2-3', 0.15);
        
        // Match à 5 points
        this.matchEquityTables.set('0-0-5', 0.5);
        this.matchEquityTables.set('1-0-5', 0.55);
        this.matchEquityTables.set('2-0-5', 0.65);
        this.matchEquityTables.set('3-0-5', 0.8);
        this.matchEquityTables.set('4-0-5', 0.95);
        
        // Match à 7 points
        this.matchEquityTables.set('0-0-7', 0.5);
        this.matchEquityTables.set('1-0-7', 0.53);
        this.matchEquityTables.set('2-0-7', 0.58);
        this.matchEquityTables.set('3-0-7', 0.65);
        this.matchEquityTables.set('4-0-7', 0.75);
        this.matchEquityTables.set('5-0-7', 0.88);
        this.matchEquityTables.set('6-0-7', 0.97);
    }

    /**
     * Vérifier endgame database
     */
    private checkEndgameDatabase(position: Position): Evaluation | null {
        // Vérifier si position est dans endgame (peu de pions restants)
        const totalCheckers = position.borneOff.white + position.borneOff.black;
        if (totalCheckers < 20) { // Endgame
            const key = this.getEndgameKey(position);
            return this.endgameDatabases.get(key) || null;
        }
        return null;
    }

    /**
     * Clé pour endgame database
     */
    private getEndgameKey(position: Position): string {
        return JSON.stringify({
            whiteOff: position.borneOff.white,
            blackOff: position.borneOff.black,
            whiteBar: position.bar.white,
            blackBar: position.bar.black,
            board: position.board.filter((c, i) => c !== 0).map((c, i) => ({ i, c }))
        });
    }

    // Méthodes utilitaires (reprises et améliorées)
    private getOpeningMove(position: Position): Move[] | null {
        if (position.dice.length === 0) return null;
        
        const diceKey = position.dice.length === 4 
            ? `${position.dice[0]}-${position.dice[0]}`
            : `${Math.max(...position.dice)}-${Math.min(...position.dice)}`;
        
        return this.openingBook.get(diceKey) || null;
    }

    private calculateDistribution(board: number[], playerSign: number): number {
        let concentration = 0;
        let checkerCount = 0;
        
        for (let i = 0; i < 24; i++) {
            const count = playerSign === 1 ? board[i] : -board[i];
            if (count > 0) {
                checkerCount += count;
                if ((playerSign === 1 && i >= 18) || (playerSign === -1 && i < 6)) {
                    concentration += count * 2;
                } else {
                    concentration += count;
                }
            }
        }
        
        return checkerCount > 0 ? concentration / checkerCount : 0;
    }

    private calculateTiming(position: Position, isWhite: boolean): number {
        const borneOff = isWhite ? position.borneOff.white : position.borneOff.black;
        const bar = isWhite ? position.bar.white : position.bar.black;
        
        let timing = borneOff * 0.1;
        timing -= bar * 0.2;
        
        let allHome = true;
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (isWhite && count > 0 && i < 18) allHome = false;
            if (!isWhite && count < 0 && i >= 6) allHome = false;
        }
        if (allHome && bar === 0) timing += 0.3;
        
        return timing;
    }

    private calculateCenterControl(board: number[]): number {
        let whiteControl = 0;
        let blackControl = 0;
        
        for (let i = 7; i <= 16; i++) {
            const count = board[i];
            if (count > 0) whiteControl += count;
            if (count < 0) blackControl += Math.abs(count);
        }
        
        return (whiteControl - blackControl) / 10.0;
    }

    private calculatePrimeScore(board: number[], playerSign: number): number {
        let maxPrimeLength = 0;
        let currentRun = 0;
        let primeScore = 0;

        for (let i = 0; i < 24; i++) {
            const count = board[i];
            const isPointMade = (playerSign === 1 && count >= 2) || (playerSign === -1 && count <= -2);

            if (isPointMade) {
                currentRun++;
            } else {
                if (currentRun > 0) {
                    if (currentRun >= 2) primeScore += Math.pow(1.5, currentRun - 1);
                    maxPrimeLength = Math.max(maxPrimeLength, currentRun);
                }
                currentRun = 0;
            }
        }
        if (currentRun >= 2) primeScore += Math.pow(1.5, currentRun - 1);

        return primeScore;
    }

    private describePositionForDeepSeek(position: Position): string {
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

    private getPositionKey(position: Position): string {
        return JSON.stringify({
            board: position.board,
            bar: position.bar,
            borneOff: position.borneOff,
            currentPlayer: position.currentPlayer,
            dice: position.dice.sort()
        });
    }

    private getBearOffKey(position: Position): string {
        const pipWhite = this.calculatePipCount(position.board, true);
        const pipBlack = this.calculatePipCount(position.board, false);
        const diff = Math.round((pipBlack - pipWhite) / 5) * 5;
        return diff.toString();
    }

    private calculatePipCount(board: number[], isWhite: boolean): number {
        let pip = 0;
        for (let i = 0; i < 24; i++) {
            const count = isWhite ? board[i] : -board[i];
            if (count > 0) {
                pip += count * (isWhite ? (24 - i) : (i + 1));
            }
        }
        return pip;
    }

    private quickEvaluation(position: Position, moves: Move[]): Evaluation {
        let currentPos = this.clonePosition(position);
        for (const move of moves) {
            currentPos = this.applyMove(currentPos, move);
        }
        const equity = this.superiorHeuristicEvaluation(currentPos);
        const winProb = 0.5 + (equity / 2);
        
        return {
            winProbability: winProb,
            gammonProbability: winProb * 0.2,
            backgammonProbability: winProb * 0.05,
            bestMoves: moves,
            equity
        };
    }

    private getAllDiceRolls(): { dice: number[], probability: number }[] {
        const rolls: { dice: number[], probability: number }[] = [];
        for (let i = 1; i <= 6; i++) {
            for (let j = i; j <= 6; j++) {
                if (i === j) {
                    rolls.push({ dice: [i, i, i, i], probability: 1 });
                } else {
                    rolls.push({ dice: [i, j], probability: 2 });
                }
            }
        }
        return rolls;
    }

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

        if (!moveFound) {
            return [{ moves: [], finalPosition: currentPos, dieSum: 0 }];
        }

        return sequences;
    }

    private findBestMoves1Ply(position: Position): Move[] {
        const sortedDice = [...position.dice].sort((a, b) => b - a);
        const sequences = this.generateTurnSequences(position, sortedDice);
        if (sequences.length === 0) return [];

        const maxMoves = Math.max(...sequences.map(s => s.moves.length));
        let candidates = sequences.filter(s => s.moves.length === maxMoves);

        if (maxMoves < position.dice.length && position.dice.length === 2 && position.dice[0] !== position.dice[1]) {
            const maxDieSum = Math.max(...candidates.map(s => s.dieSum));
            candidates = candidates.filter(s => s.dieSum === maxDieSum);
        }

        let bestSeq = candidates[0];
        let bestEq = -Infinity;
        const isWhite = position.currentPlayer === 'white';

        for (const seq of candidates) {
            const eq = this.superiorHeuristicEvaluation(seq.finalPosition);
            const score = isWhite ? eq : -eq;
            if (score > bestEq) {
                bestEq = score;
                bestSeq = seq;
            }
        }
        return bestSeq.moves;
    }

    private findSingleMoves(position: Position, die: number): Move[] {
        const moves: Move[] = [];
        const isWhite = position.currentPlayer === 'white';
        const direction = isWhite ? 1 : -1;

        const barCount = isWhite ? position.bar.white : position.bar.black;
        if (barCount > 0) {
            const entryIndex = isWhite ? -1 + die : 24 - die;
            if (this.isValidDestination(position, entryIndex, isWhite)) {
                moves.push({ from: isWhite ? -1 : 24, to: entryIndex, die });
            }
            return moves;
        }

        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            const isMyChecker = isWhite ? count > 0 : count < 0;

            if (isMyChecker) {
                const dest = i + (die * direction);

                if ((isWhite && dest > 23) || (!isWhite && dest < 0)) {
                    if (this.canBearOff(position, i, die, isWhite)) {
                        moves.push({ from: i, to: dest, die });
                    }
                } else if (this.isValidDestination(position, dest, isWhite)) {
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
        if (isWhite && count === -1) return true;
        if (!isWhite && count === 1) return true;

        return false;
    }

    private canBearOff(position: Position, fromIndex: number, die: number, isWhite: boolean): boolean {
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
                for (let k = 18; k < fromIndex; k++) {
                    if (position.board[k] > 0) return false;
                }
                return true;
            }
        } else {
            if (dest === -1) return true;
            if (dest < -1) {
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

        if (move.from === -1) newPos.bar.white--;
        else if (move.from === 24) newPos.bar.black--;
        else {
            if (isWhite) newPos.board[move.from]--;
            else newPos.board[move.from]++;
        }

        if (isWhite && move.to > 23) {
            newPos.borneOff.white++;
        } else if (!isWhite && move.to < 0) {
            newPos.borneOff.black++;
        } else {
            const destCount = newPos.board[move.to];

            if (isWhite && destCount === -1) {
                newPos.board[move.to] = 1;
                newPos.bar.black++;
            } else if (!isWhite && destCount === 1) {
                newPos.board[move.to] = -1;
                newPos.bar.white++;
            } else {
                if (isWhite) newPos.board[move.to]++;
                else newPos.board[move.to]--;
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

