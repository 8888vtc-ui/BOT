/**
 * Script pour diagnostiquer et réparer Railway Ollama automatiquement
 */

const RAILWAY_TOKEN = '1ed0aae3-86d8-47f9-86f6-fb212b3e65e5';
const RAILWAY_API = 'https://backboard.railway.app/graphql/v2';

async function queryRailway(query, variables = {}) {
    try {
        const response = await fetch(RAILWAY_API, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RAILWAY_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.errors) {
            throw new Error(JSON.stringify(data.errors));
        }

        return data.data;
    } catch (error) {
        console.error('❌ Erreur API Railway:', error.message);
        return null;
    }
}

async function getProjects() {
    const query = `
        query {
            projects {
                id
                name
                services {
                    id
                    name
                    url
                    status
                    deployments {
                        id
                        status
                        createdAt
                        commit {
                            id
                            message
                        }
                    }
                }
            }
        }
    `;

    return await queryRailway(query);
}

async function redeployService(serviceId) {
    const mutation = `
        mutation($serviceId: String!) {
            serviceRedeploy(serviceId: $serviceId) {
                id
                status
            }
        }
    `;

    return await queryRailway(mutation, { serviceId });
}

async function testOllamaUrl(url) {
    try {
        const response = await fetch(`${url}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        const hasDeepSeek = data.models?.some(m => m.name.includes('deepseek'));
        
        return { 
            success: true, 
            hasDeepSeek,
            models: data.models?.map(m => m.name) || []
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function diagnoseAndFix() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║   DIAGNOSTIC ET RÉPARATION RAILWAY OLLAMA                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const data = await getProjects();
    if (!data || !data.projects) {
        console.log('❌ Impossible de récupérer les projets Railway');
        return;
    }

    let foundService = null;

    for (const project of data.projects) {
        for (const service of project.services || []) {
            // Chercher le service Ollama
            if (service.name.toLowerCase().includes('ollama') || 
                service.name.toLowerCase().includes('bot') ||
                service.url?.includes('railway.app')) {
                foundService = { project, service };
                break;
            }
        }
        if (foundService) break;
    }

    if (!foundService) {
        console.log('❌ Service Ollama non trouvé');
        console.log('\n📋 Services disponibles:');
        for (const project of data.projects) {
            for (const service of project.services || []) {
                console.log(`   - ${service.name} (${service.id})`);
            }
        }
        return;
    }

    const { project, service } = foundService;
    console.log(`✅ Service trouvé: ${service.name}`);
    console.log(`   URL: ${service.url || 'N/A'}`);
    console.log(`   Statut: ${service.status || 'N/A'}\n`);

    // Vérifier le dernier déploiement
    if (service.deployments && service.deployments.length > 0) {
        const lastDeploy = service.deployments[0];
        console.log(`📦 Dernier déploiement:`);
        console.log(`   Statut: ${lastDeploy.status}`);
        console.log(`   Commit: ${lastDeploy.commit?.message?.substring(0, 60) || 'N/A'}`);
        console.log(`   Date: ${new Date(lastDeploy.createdAt).toLocaleString('fr-FR')}\n`);

        if (lastDeploy.status === 'FAILED') {
            console.log('❌ Dernier déploiement a échoué !');
            console.log('🔄 Redéploiement en cours...\n');
            
            const redeploy = await redeployService(service.id);
            if (redeploy) {
                console.log('✅ Redéploiement déclenché !');
                console.log('⏳ Attendez 2-3 minutes puis vérifiez les logs.\n');
            }
        } else if (lastDeploy.status === 'BUILDING' || lastDeploy.status === 'DEPLOYING') {
            console.log('⏳ Déploiement en cours...');
            console.log('⏳ Attendez la fin du déploiement.\n');
        } else if (lastDeploy.status === 'SUCCESS') {
            console.log('✅ Dernier déploiement réussi !');
            
            // Tester l'URL
            if (service.url) {
                console.log(`\n🔍 Test de l'URL Ollama: ${service.url}`);
                const test = await testOllamaUrl(service.url);
                
                if (test.success) {
                    console.log('✅ Ollama répond !');
                    if (test.hasDeepSeek) {
                        console.log('✅ DeepSeek est disponible !');
                        console.log(`📦 Modèles: ${test.models.join(', ')}`);
                    } else {
                        console.log('⚠️  DeepSeek n\'est pas encore téléchargé');
                        console.log('⏳ Le téléchargement peut prendre 2-5 minutes');
                    }
                } else {
                    console.log(`❌ Ollama ne répond pas: ${test.error}`);
                    console.log('⚠️  Le service peut être en train de démarrer (cold start)');
                }
            }
        }
    } else {
        console.log('⚠️  Aucun déploiement trouvé');
    }

    console.log('\n═'.repeat(60));
}

// Exécuter toutes les 30 secondes
async function monitor() {
    await diagnoseAndFix();
    console.log('\n⏳ Prochaine vérification dans 30 secondes...\n');
    setTimeout(monitor, 30000);
}

// Démarrer le monitoring
console.log('🚀 Démarrage du monitoring Railway Ollama...\n');
monitor().catch(console.error);

