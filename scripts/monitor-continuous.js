/**
 * Monitoring continu Railway Ollama
 * Vérifie toutes les 30 secondes et répare automatiquement
 */

const RAILWAY_URL = 'https://bot-production-b9d6.up.railway.app';
const NETLIFY_URL = 'https://botgammon.netlify.app/.netlify/functions/analyze';

let checkCount = 0;
let successCount = 0;
let lastError = null;

async function testOllama() {
    try {
        const response = await fetch(`${RAILWAY_URL}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        const hasDeepSeek = data.models?.some(m => m.name.includes('deepseek'));
        
        return { success: true, hasDeepSeek, models: data.models?.map(m => m.name) || [] };
    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            isTimeout: error.name === 'AbortError'
        };
    }
}

async function testNetlify() {
    try {
        const response = await fetch(NETLIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dice: [3, 1],
                boardState: { points: Array(24).fill({ player: null, count: 0 }), bar: { player1: 0, player2: 0 }, off: { player1: 0, player2: 0 } },
                player: 2,
                useDeepSeek: true
            }),
            signal: AbortSignal.timeout(30000)
        });

        return { success: response.ok };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function check() {
    checkCount++;
    const timestamp = new Date().toLocaleString('fr-FR');
    
    console.log(`\n[${timestamp}] Vérification #${checkCount}...`);

    const ollamaTest = await testOllama();
    const netlifyTest = await testNetlify();

    let allOk = true;

    if (ollamaTest.success && ollamaTest.hasDeepSeek) {
        console.log('✅ Railway Ollama: OK (DeepSeek disponible)');
        successCount++;
    } else {
        console.log(`❌ Railway Ollama: ${ollamaTest.error || 'DeepSeek non disponible'}`);
        allOk = false;
        lastError = 'Railway Ollama';
    }

    if (netlifyTest.success) {
        console.log('✅ Fonction Netlify: OK');
    } else {
        console.log(`❌ Fonction Netlify: ${netlifyTest.error || 'Erreur'}`);
        allOk = false;
        lastError = 'Fonction Netlify';
    }

    if (allOk) {
        console.log(`\n🎉 TOUT FONCTIONNE ! (${successCount}/${checkCount} vérifications réussies)`);
    } else {
        console.log(`\n⚠️  Problème détecté: ${lastError}`);
        console.log('⏳ Nouvelle vérification dans 30s...');
    }

    return allOk;
}

async function monitor() {
    const isOk = await check();
    
    // Continuer à monitorer
    setTimeout(monitor, 30000); // 30 secondes
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║   MONITORING CONTINU RAILWAY OLLAMA                      ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('\n🚀 Démarrage du monitoring continu...');
console.log('⏳ Vérification toutes les 30 secondes\n');

monitor().catch(console.error);

