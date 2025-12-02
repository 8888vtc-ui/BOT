/**
 * Script de monitoring et réparation automatique Railway Ollama
 */

const RAILWAY_URL = 'https://bot-production-b9d6.up.railway.app';
const NETLIFY_URL = 'https://botgammon.netlify.app/.netlify/functions/analyze';

async function testOllama() {
    try {
        const response = await fetch(`${RAILWAY_URL}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            return { 
                success: false, 
                error: `HTTP ${response.status}: ${response.statusText}`,
                status: response.status
            };
        }

        const data = await response.json();
        const hasDeepSeek = data.models?.some(m => m.name.includes('deepseek'));
        const models = data.models?.map(m => m.name) || [];
        
        return { 
            success: true, 
            hasDeepSeek,
            models,
            modelCount: models.length
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            isTimeout: error.name === 'AbortError'
        };
    }
}

async function testNetlifyFunction() {
    try {
        const testBody = {
            dice: [3, 1],
            boardState: {
                points: Array(24).fill({ player: null, count: 0 }),
                bar: { player1: 0, player2: 0 },
                off: { player1: 0, player2: 0 }
            },
            player: 2,
            useDeepSeek: true
        };

        const response = await fetch(NETLIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testBody),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { 
                success: false, 
                error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`
            };
        }

        const data = await response.json();
        return { 
            success: true, 
            hasEvaluation: !!data.evaluation,
            hasBestMoves: !!data.bestMoves
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            isTimeout: error.name === 'AbortError'
        };
    }
}

async function diagnose() {
    const timestamp = new Date().toLocaleString('fr-FR');
    console.log(`\n[${timestamp}] 🔍 Diagnostic Railway Ollama...\n`);

    // Test 1: Railway Ollama
    console.log('Test 1: Railway Ollama');
    const ollamaTest = await testOllama();
    
    if (ollamaTest.success) {
        console.log('✅ Railway Ollama répond !');
        if (ollamaTest.hasDeepSeek) {
            console.log(`✅ DeepSeek disponible ! (${ollamaTest.models.join(', ')})`);
        } else {
            console.log(`⚠️  DeepSeek pas encore téléchargé (${ollamaTest.modelCount} modèle(s) disponible(s))`);
        }
    } else {
        if (ollamaTest.isTimeout) {
            console.log('⏳ Timeout - Railway peut être en cold start (attendre 30-60s)');
        } else {
            console.log(`❌ Erreur: ${ollamaTest.error}`);
        }
    }

    // Test 2: Fonction Netlify
    console.log('\nTest 2: Fonction Netlify');
    const netlifyTest = await testNetlifyFunction();
    
    if (netlifyTest.success) {
        console.log('✅ Fonction Netlify répond !');
        if (netlifyTest.hasEvaluation) {
            console.log('✅ Évaluation disponible');
        }
        if (netlifyTest.hasBestMoves) {
            console.log('✅ Meilleurs coups disponibles');
        }
    } else {
        if (netlifyTest.isTimeout) {
            console.log('⏳ Timeout - Fonction peut être en cold start');
        } else {
            console.log(`❌ Erreur: ${netlifyTest.error}`);
        }
    }

    // Résumé
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RÉSUMÉ:');
    console.log(`   Railway Ollama: ${ollamaTest.success ? '✅ OK' : '❌ ERREUR'}`);
    console.log(`   Fonction Netlify: ${netlifyTest.success ? '✅ OK' : '❌ ERREUR'}`);
    
    if (ollamaTest.success && ollamaTest.hasDeepSeek && netlifyTest.success) {
        console.log('\n🎉 TOUT FONCTIONNE ! Ollama est opérationnel !');
        return true;
    } else {
        console.log('\n⚠️  Problèmes détectés - nouvelle vérification dans 30s...');
        return false;
    }
}

async function monitor() {
    const isOk = await diagnose();
    
    if (!isOk) {
        setTimeout(monitor, 30000); // Vérifier à nouveau dans 30s
    } else {
        console.log('\n✅ Monitoring terminé - Tout fonctionne !');
        console.log('💡 Le script peut être arrêté (Ctrl+C)');
        // Continuer à monitorer toutes les 5 minutes
        setTimeout(monitor, 300000); // 5 minutes
    }
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║   MONITORING RAILWAY OLLAMA - RÉPARATION AUTOMATIQUE     ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('\n🚀 Démarrage du monitoring...');
console.log('⏳ Vérification toutes les 30 secondes jusqu\'à ce que tout fonctionne\n');

monitor().catch(console.error);

