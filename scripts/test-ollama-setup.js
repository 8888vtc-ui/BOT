/**
 * Script pour tester la configuration Ollama + Netlify
 */

const NETLIFY_TOKEN = 'nfp_Y9S6sWkf2jT54iByoZvHUb2Q111n4YH20d37';
const RAILWAY_URL = 'https://bot-production-b9d6.up.railway.app';
const NETLIFY_SITE_ID = 'botgammon'; // À ajuster si nécessaire

async function testRailwayOllama() {
    console.log('\n🔍 Test 1 : Vérifier Railway Ollama...\n');
    
    try {
        const response = await fetch(`${RAILWAY_URL}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000) // Timeout 10s
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Railway Ollama fonctionne !');
        console.log('📦 Modèles disponibles:', data.models?.map(m => m.name).join(', ') || 'Aucun');
        
        const hasDeepSeek = data.models?.some(m => m.name.includes('deepseek'));
        if (hasDeepSeek) {
            console.log('✅ DeepSeek est disponible !');
        } else {
            console.log('⚠️  DeepSeek n\'est pas encore téléchargé (peut prendre quelques minutes)');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erreur Railway Ollama:', error.message);
        return false;
    }
}

async function testNetlifyVariables() {
    console.log('\n🔍 Test 2 : Vérifier variables Netlify...\n');
    
    try {
        // Récupérer la liste des sites
        const sitesResponse = await fetch('https://api.netlify.com/api/v1/sites', {
            headers: {
                'Authorization': `Bearer ${NETLIFY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!sitesResponse.ok) {
            throw new Error(`HTTP ${sitesResponse.status}: ${sitesResponse.statusText}`);
        }

        const sites = await sitesResponse.json();
        const site = sites.find(s => s.name === NETLIFY_SITE_ID || s.name.includes('bot'));
        
        if (!site) {
            console.log('⚠️  Site non trouvé, liste des sites:');
            sites.forEach(s => console.log(`  - ${s.name} (${s.id})`));
            return false;
        }

        console.log(`✅ Site trouvé: ${site.name} (${site.id})`);

        // Récupérer les variables d'environnement
        const envResponse = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/env`, {
            headers: {
                'Authorization': `Bearer ${NETLIFY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!envResponse.ok) {
            throw new Error(`HTTP ${envResponse.status}: ${envResponse.statusText}`);
        }

        const envVars = await envResponse.json();
        
        const ollamaUrl = envVars.find(v => v.key === 'OLLAMA_URL');
        const ollamaModel = envVars.find(v => v.key === 'OLLAMA_MODEL');

        console.log('\n📋 Variables d\'environnement:');
        
        if (ollamaUrl) {
            console.log(`✅ OLLAMA_URL = ${ollamaUrl.values[0]?.value || 'N/A'}`);
            if (ollamaUrl.values[0]?.value === RAILWAY_URL) {
                console.log('✅ URL Railway correcte !');
            } else {
                console.log(`⚠️  URL différente de celle attendue (${RAILWAY_URL})`);
            }
        } else {
            console.log('❌ OLLAMA_URL non trouvée');
        }

        if (ollamaModel) {
            console.log(`✅ OLLAMA_MODEL = ${ollamaModel.values[0]?.value || 'N/A'}`);
            if (ollamaModel.values[0]?.value === 'deepseek-coder') {
                console.log('✅ Modèle correct !');
            }
        } else {
            console.log('❌ OLLAMA_MODEL non trouvée');
        }

        return ollamaUrl && ollamaModel;
    } catch (error) {
        console.error('❌ Erreur vérification Netlify:', error.message);
        return false;
    }
}

async function testNetlifyFunction() {
    console.log('\n🔍 Test 3 : Tester fonction Netlify...\n');
    
    try {
        // Tester l'endpoint analyze
        const testUrl = 'https://botgammon.netlify.app/.netlify/functions/analyze';
        
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

        const response = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testBody),
            signal: AbortSignal.timeout(30000) // Timeout 30s
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Fonction Netlify répond !');
        console.log('📊 Réponse:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
        
        return true;
    } catch (error) {
        console.error('❌ Erreur fonction Netlify:', error.message);
        return false;
    }
}

async function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║   TEST CONFIGURATION OLLAMA + NETLIFY                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const results = {
        railway: await testRailwayOllama(),
        netlify: await testNetlifyVariables(),
        function: await testNetlifyFunction()
    };

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   RÉSULTAT FINAL                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log(`Railway Ollama:     ${results.railway ? '✅ OK' : '❌ ERREUR'}`);
    console.log(`Variables Netlify:  ${results.netlify ? '✅ OK' : '❌ ERREUR'}`);
    console.log(`Fonction Netlify:   ${results.function ? '✅ OK' : '❌ ERREUR'}`);

    if (results.railway && results.netlify && results.function) {
        console.log('\n🎉 TOUT EST CONFIGURÉ CORRECTEMENT !');
        console.log('✅ Le bot peut maintenant utiliser Ollama gratuitement !');
    } else {
        console.log('\n⚠️  Certains tests ont échoué. Vérifiez les erreurs ci-dessus.');
    }
}

main().catch(console.error);

