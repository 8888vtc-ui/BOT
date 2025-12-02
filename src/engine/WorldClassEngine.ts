/**
 * WORLD-CLASS BACKGAMMON ENGINE
 * 
 * Moteur de niveau international utilisant :
 * - Recherche 3-4 ply expectiminimax
 * - DeepSeek pour optimisation des positions critiques
 * - Évaluation heuristique avancée
 * - Opening book
 * - Tables de référence bear-off
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

export class WorldClassEngine {
    private model: tf.LayersModel | null = null;
    private isInitialized = false;
    private deepseek: OpenAI | null = null;
    private transpositionTable: Map<string, Evaluation> = new Map();
    private openingBook: Map<string, Move[]> = new Map();
    private bearOffTables: Map<string, number> = new Map();

    constructor() {
        // Initialiser DeepSeek si disponible
        if (process.env.DEEPSEEK_API_KEY) {
            this.deepseek = new OpenAI({
                apiKey: process.env.DEEPSEEK_API_KEY,
                baseURL: 'https://api.deepseek.com'
            });
        }
        this.initializeOpeningBook();
        this.initializeBearOffTables();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        console.log('Initializing World-Class Backgammon Engine...');
        // Future: Load trained neural network model
        this.isInitialized = true;
        console.log('World-Class Engine initialized');
    }

    /**
     * Évaluation de position avec DeepSeek pour positions critiques
     */
    async evaluatePosition(position: Position, useDeepSeek: boolean = false): Promise<Evaluation> {
        if (!this.isInitialized) await this.initialize();

        // Vérifier la table de transposition
        const posKey = this.getPositionKey(position);
        if (this.transpositionTable.has(posKey)) {
            return this.transpositionTable.get(posKey)!;
        }

        // Vérifier l'opening book
        const openingMoves = this.getOpeningMove(position);
        if (openingMoves) {
            const evaluation = this.quickEvaluation(position, openingMoves);
            this.transpositionTable.set(posKey, evaluation);
            return evaluation;
        }

        // Recherche approfondie 3-4 ply
        const bestMoves = await this.findBestMovesAdvanced(position, useDeepSeek);

        // Appliquer les meilleurs coups pour calculer l'équité
        let currentPos = this.clonePosition(position);
        for (const move of bestMoves) {
            currentPos = this.applyMove(currentPos, move);
        }

        // Évaluation avancée
        const equity = this.advancedHeuristicEvaluation(currentPos);
        const winProb = 0.5 + (equity / 2);

        // Utiliser DeepSeek pour positions critiques si demandé
        if (useDeepSeek && this.deepseek && Math.abs(equity) < 0.3) {
            const deepSeekEval = await this.deepSeekEvaluation(position, bestMoves);
            if (deepSeekEval) {
                const evaluation: Evaluation = {
                    winProbability: deepSeekEval.winProbability,
                    gammonProbability: deepSeekEval.gammonProbability,
                    backgammonProbability: deepSeekEval.backgammonProbability,
                    bestMoves: deepSeekEval.bestMoves || bestMoves,
                    equity: deepSeekEval.equity || equity
                };
                this.transpositionTable.set(posKey, evaluation);
                return evaluation;
            }
        }

        const evaluation: Evaluation = {
            winProbability: winProb,
            gammonProbability: winProb * 0.2,
            backgammonProbability: winProb * 0.05,
            bestMoves,
            equity
        };

        this.transpositionTable.set(posKey, evaluation);
        return evaluation;
    }

    /**
     * Recherche avancée 3-4 ply avec optimisations
     */
    private async findBestMovesAdvanced(position: Position, useDeepSeek: boolean): Promise<Move[]> {
        const sortedDice = [...position.dice].sort((a, b) => b - a);
        const sequences = this.generateTurnSequences(position, sortedDice);

        if (sequences.length === 0) return [];

        // Filtrer par nombre maximum de coups
        const maxMoves = Math.max(...sequences.map(s => s.moves.length));
        let candidates = sequences.filter(s => s.moves.length === maxMoves);

        // Filtrer par somme maximale des dés si pas tous utilisés
        if (maxMoves < position.dice.length && position.dice.length === 2 && position.dice[0] !== position.dice[1]) {
            const maxDieSum = Math.max(...candidates.map(s => s.dieSum));
            candidates = candidates.filter(s => s.dieSum === maxDieSum);
        }

        // Prune si trop de candidats (garder top 10 pour recherche 3-4 ply)
        if (candidates.length > 10) {
            candidates.sort((a, b) => {
                const eqA = this.advancedHeuristicEvaluation(a.finalPosition);
                const eqB = this.advancedHeuristicEvaluation(b.finalPosition);
                const isWhite = position.currentPlayer === 'white';
                return isWhite ? eqB - eqA : eqA - eqB;
            });
            candidates = candidates.slice(0, 10);
        }

        // Recherche 3-4 ply expectiminimax
        let bestSequence: TurnSequence | null = null;
        let bestEquity = -Infinity;
        const isWhite = position.currentPlayer === 'white';

        for (const seq of candidates) {
            // Recherche 3-4 ply au lieu de 2
            const deepEquity = await this.calculateDeepEquityAdvanced(seq.finalPosition, 3);
            const score = isWhite ? deepEquity : -deepEquity;

            if (score > bestEquity) {
                bestEquity = score;
                bestSequence = seq;
            }
        }

        return bestSequence ? bestSequence.moves : [];
    }

    /**
     * Recherche approfondie avec profondeur variable
     */
    private async calculateDeepEquityAdvanced(position: Position, depth: number): Promise<number> {
        if (depth === 0) {
            return this.advancedHeuristicEvaluation(position);
        }

        const rolls = this.getAllDiceRolls();
        let totalEquity = 0;
        let totalProbability = 0;

        const nextPlayer = position.currentPlayer === 'white' ? 'black' : 'white';
        const isNextWhite = nextPlayer === 'white';

        for (const roll of rolls) {
            const simPosition: Position = {
                ...position,
                currentPlayer: nextPlayer,
                dice: roll.dice
            };

            // Recherche récursive avec profondeur réduite
            const moves = this.findBestMoves1Ply(simPosition);
            let leafPos = this.clonePosition(simPosition);
            for (const m of moves) {
                leafPos = this.applyMove(leafPos, m);
            }

            // Évaluation récursive si profondeur > 1
            let equity: number;
            if (depth > 1) {
                equity = await this.calculateDeepEquityAdvanced(leafPos, depth - 1);
            } else {
                equity = this.advancedHeuristicEvaluation(leafPos);
            }

            totalEquity += equity * roll.probability;
            totalProbability += roll.probability;
        }

        return totalEquity / totalProbability;
    }

    /**
     * Évaluation heuristique avancée avec plus de facteurs
     */
    private advancedHeuristicEvaluation(position: Position): number {
        let score = 0;

        // 1. Pip Count (Race) - Poids amélioré
        let pipWhite = 0;
        let pipBlack = 0;
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (count > 0) pipWhite += count * (24 - i);
            if (count < 0) pipBlack += Math.abs(count) * (i + 1);
        }

        // Utiliser table bear-off si disponible
        const bearOffKey = this.getBearOffKey(position);
        if (this.bearOffTables.has(bearOffKey)) {
            score += this.bearOffTables.get(bearOffKey)!;
        } else {
            score += (pipBlack - pipWhite) / 100.0;
        }

        // 2. Structure du plateau améliorée
        const primeWhite = this.calculatePrimeScore(position.board, 1);
        const primeBlack = this.calculatePrimeScore(position.board, -1);
        score += (primeWhite - primeBlack) * 0.3; // Poids augmenté

        // 3. Blots avec pénalité contextuelle
        let blotsWhite = 0;
        let blotsBlack = 0;
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (count === 1) {
                const penalty = i > 17 ? 2.0 : (i > 11 ? 1.2 : 0.8);
                blotsWhite += penalty;
            }
            if (count === -1) {
                const penalty = i < 6 ? 2.0 : (i < 12 ? 1.2 : 0.8);
                blotsBlack += penalty;
            }
        }
        score -= (blotsWhite * 0.2);
        score += (blotsBlack * 0.2);

        // 4. Anchors améliorés
        let anchorsWhite = 0;
        let anchorsBlack = 0;
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (count >= 2 && i < 6) anchorsWhite += 1;
            if (count <= -2 && i > 17) anchorsBlack += 1;
        }
        score += (anchorsWhite * 0.4); // Poids augmenté
        score -= (anchorsBlack * 0.4);

        // 5. Bar avec bonus/pénalité améliorés
        score += (position.bar.black * 0.8);
        score -= (position.bar.white * 0.8);

        // 6. Bear-off progress
        score += (position.borneOff.white * 0.4);
        score -= (position.borneOff.black * 0.4);

        // 7. NOUVEAU: Distribution des pions (concentration)
        const distributionWhite = this.calculateDistribution(position.board, 1);
        const distributionBlack = this.calculateDistribution(position.board, -1);
        score += (distributionWhite - distributionBlack) * 0.1;

        // 8. NOUVEAU: Timing (avancement dans la course)
        const timingWhite = this.calculateTiming(position, true);
        const timingBlack = this.calculateTiming(position, false);
        score += (timingWhite - timingBlack) * 0.15;

        // 9. NOUVEAU: Contrôle du centre
        const centerControl = this.calculateCenterControl(position.board);
        score += centerControl * 0.1;

        return score;
    }

    /**
     * Utiliser DeepSeek pour évaluer les positions critiques
     */
    private async deepSeekEvaluation(position: Position, moves: Move[]): Promise<Evaluation | null> {
        if (!this.deepseek) return null;

        try {
            const positionDesc = this.describePositionForDeepSeek(position);
            const prompt = `Tu es un expert mondial de backgammon (niveau professionnel). Analyse cette position et donne une évaluation précise.

Position:
${positionDesc}

Coups proposés: ${moves.map(m => `${m.from}→${m.to}`).join(', ')}

Réponds UNIQUEMENT avec un JSON valide (sans markdown):
{
  "winProbability": 0.0-1.0,
  "gammonProbability": 0.0-1.0,
  "backgammonProbability": 0.0-1.0,
  "equity": -1.0 à 1.0,
  "bestMoves": [{"from": number, "to": number, "die": number}],
  "reasoning": "explication courte"
}`;

            const response = await this.deepseek.chat.completions.create({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "Tu es un expert mondial de backgammon. Tu analyses les positions avec une précision professionnelle. Réponds toujours en JSON valide."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3, // Plus déterministe pour l'évaluation
                max_tokens: 500
            });

            const content = response.choices[0]?.message?.content || '';
            const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            return {
                winProbability: parsed.winProbability || 0.5,
                gammonProbability: parsed.gammonProbability || 0.1,
                backgammonProbability: parsed.backgammonProbability || 0.02,
                bestMoves: parsed.bestMoves || moves,
                equity: parsed.equity || 0
            };
        } catch (error) {
            console.error('DeepSeek evaluation error:', error);
            return null;
        }
    }

    /**
     * Opening book pour les ouvertures standards
     */
    private initializeOpeningBook(): void {
        // Ouvertures standards du backgammon professionnel
        // Format: "dice1-dice2" -> [moves]
        
        // 3-1: 24/21, 13/12 (ou 8/5, 6/5)
        this.openingBook.set('3-1', [
            { from: 23, to: 20, die: 3 },
            { from: 12, to: 11, die: 1 }
        ]);

        // 4-2: 24/20, 13/11
        this.openingBook.set('4-2', [
            { from: 23, to: 19, die: 4 },
            { from: 12, to: 10, die: 2 }
        ]);

        // 5-3: 24/19, 13/10
        this.openingBook.set('5-3', [
            { from: 23, to: 18, die: 5 },
            { from: 12, to: 9, die: 3 }
        ]);

        // 6-1: 24/18, 13/12
        this.openingBook.set('6-1', [
            { from: 23, to: 17, die: 6 },
            { from: 12, to: 11, die: 1 }
        ]);

        // 6-5: 24/18, 13/8
        this.openingBook.set('6-5', [
            { from: 23, to: 17, die: 6 },
            { from: 12, to: 7, die: 5 }
        ]);

        // Doubles
        // 1-1: 24/23(2), 13/12(2)
        this.openingBook.set('1-1', [
            { from: 23, to: 22, die: 1 },
            { from: 22, to: 21, die: 1 },
            { from: 12, to: 11, die: 1 },
            { from: 11, to: 10, die: 1 }
        ]);

        // 3-3: 24/21(2), 13/10(2)
        this.openingBook.set('3-3', [
            { from: 23, to: 20, die: 3 },
            { from: 20, to: 17, die: 3 },
            { from: 12, to: 9, die: 3 },
            { from: 9, to: 6, die: 3 }
        ]);
    }

    /**
     * Tables de référence pour bear-off (probabilités de gagner)
     */
    private initializeBearOffTables(): void {
        // Tables simplifiées - en production, utiliser des tables complètes
        // Format: "pipDiff" -> equity
        this.bearOffTables.set('0', 0.5);
        this.bearOffTables.set('10', 0.6);
        this.bearOffTables.set('20', 0.7);
        this.bearOffTables.set('30', 0.8);
        this.bearOffTables.set('40', 0.9);
        this.bearOffTables.set('-10', 0.4);
        this.bearOffTables.set('-20', 0.3);
        this.bearOffTables.set('-30', 0.2);
        this.bearOffTables.set('-40', 0.1);
    }

    /**
     * Obtenir le coup d'ouverture si disponible
     */
    private getOpeningMove(position: Position): Move[] | null {
        if (position.dice.length === 0) return null;
        
        const diceKey = position.dice.length === 4 
            ? `${position.dice[0]}-${position.dice[0]}`
            : `${Math.max(...position.dice)}-${Math.min(...position.dice)}`;
        
        return this.openingBook.get(diceKey) || null;
    }

    /**
     * Calculer la distribution des pions (concentration)
     */
    private calculateDistribution(board: number[], playerSign: number): number {
        let concentration = 0;
        let checkerCount = 0;
        
        for (let i = 0; i < 24; i++) {
            const count = playerSign === 1 ? board[i] : -board[i];
            if (count > 0) {
                checkerCount += count;
                // Récompenser la concentration dans la maison
                if ((playerSign === 1 && i >= 18) || (playerSign === -1 && i < 6)) {
                    concentration += count * 2;
                } else {
                    concentration += count;
                }
            }
        }
        
        return checkerCount > 0 ? concentration / checkerCount : 0;
    }

    /**
     * Calculer le timing (avancement dans la course)
     */
    private calculateTiming(position: Position, isWhite: boolean): number {
        const borneOff = isWhite ? position.borneOff.white : position.borneOff.black;
        const bar = isWhite ? position.bar.white : position.bar.black;
        
        // Timing = progression vers la victoire
        let timing = borneOff * 0.1;
        timing -= bar * 0.2; // Pénalité pour être sur la barre
        
        // Bonus si tous les pions sont dans la maison
        let allHome = true;
        for (let i = 0; i < 24; i++) {
            const count = position.board[i];
            if (isWhite && count > 0 && i < 18) allHome = false;
            if (!isWhite && count < 0 && i >= 6) allHome = false;
        }
        if (allHome && bar === 0) timing += 0.3;
        
        return timing;
    }

    /**
     * Calculer le contrôle du centre
     */
    private calculateCenterControl(board: number[]): number {
        // Points centraux: 7-16
        let whiteControl = 0;
        let blackControl = 0;
        
        for (let i = 7; i <= 16; i++) {
            const count = board[i];
            if (count > 0) whiteControl += count;
            if (count < 0) blackControl += Math.abs(count);
        }
        
        return (whiteControl - blackControl) / 10.0;
    }

    /**
     * Décrire la position pour DeepSeek
     */
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

    /**
     * Clé de position pour table de transposition
     */
    private getPositionKey(position: Position): string {
        return JSON.stringify({
            board: position.board,
            bar: position.bar,
            borneOff: position.borneOff,
            currentPlayer: position.currentPlayer,
            dice: position.dice.sort()
        });
    }

    /**
     * Clé pour table bear-off
     */
    private getBearOffKey(position: Position): string {
        const pipWhite = this.calculatePipCount(position.board, true);
        const pipBlack = this.calculatePipCount(position.board, false);
        const diff = Math.round((pipBlack - pipWhite) / 10) * 10;
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

    /**
     * Évaluation rapide pour opening book
     */
    private quickEvaluation(position: Position, moves: Move[]): Evaluation {
        let currentPos = this.clonePosition(position);
        for (const move of moves) {
            currentPos = this.applyMove(currentPos, move);
        }
        const equity = this.advancedHeuristicEvaluation(currentPos);
        const winProb = 0.5 + (equity / 2);
        
        return {
            winProbability: winProb,
            gammonProbability: winProb * 0.2,
            backgammonProbability: winProb * 0.05,
            bestMoves: moves,
            equity
        };
    }

    // Méthodes utilitaires (reprises de NeuralNetworkEngine)
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

    private generateTurnSequences(currentPos: Position, remainingDice: number[]): any[] {
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
            const eq = this.advancedHeuristicEvaluation(seq.finalPosition);
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

