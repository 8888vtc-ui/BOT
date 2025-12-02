/**
 * Script pour vérifier l'état des déploiements Railway
 */

const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN || process.argv[2];

if (!RAILWAY_TOKEN) {
    console.log('❌ Token Railway requis');
    console.log('Usage: RAILWAY_TOKEN=votre_token node scripts/check-railway-status.js');
    console.log('   ou: node scripts/check-railway-status.js votre_token');
    process.exit(1);
}

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

async function getServiceLogs(serviceId, limit = 50) {
    const query = `
        query($serviceId: String!, $limit: Int!) {
            serviceLogs(serviceId: $serviceId, limit: $limit) {
                message
                timestamp
            }
        }
    `;

    return await queryRailway(query, { serviceId, limit });
}

async function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║   VÉRIFICATION RAILWAY                                    ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const data = await getProjects();
    if (!data || !data.projects) {
        console.log('❌ Impossible de récupérer les projets Railway');
        return;
    }

    console.log(`📊 ${data.projects.length} projet(s) trouvé(s)\n`);

    for (const project of data.projects) {
        console.log('═'.repeat(60));
        console.log(`📦 Projet: ${project.name}`);
        console.log(`   ID: ${project.id}`);

        if (!project.services || project.services.length === 0) {
            console.log('   ⚠️  Aucun service trouvé\n');
            continue;
        }

        for (const service of project.services) {
            console.log(`\n🔧 Service: ${service.name}`);
            console.log(`   ID: ${service.id}`);
            console.log(`   URL: ${service.url || 'N/A'}`);
            console.log(`   Statut: ${service.status || 'N/A'}`);

            if (service.deployments && service.deployments.length > 0) {
                console.log(`\n📦 Derniers déploiements:`);
                const recentDeploys = service.deployments.slice(0, 3);
                for (const deploy of recentDeploys) {
                    const status = deploy.status === 'SUCCESS' ? '✅' : 
                                  deploy.status === 'FAILED' ? '❌' : 
                                  deploy.status === 'BUILDING' ? '⏳' : '❓';
                    const date = new Date(deploy.createdAt).toLocaleString('fr-FR');
                    const commit = deploy.commit?.message?.substring(0, 50) || 'N/A';
                    console.log(`   ${status} ${deploy.status} - ${date}`);
                    console.log(`      Commit: ${commit}`);
                }

                // Récupérer les logs du dernier déploiement
                if (service.deployments[0]) {
                    console.log(`\n📋 Logs du dernier déploiement:`);
                    const logs = await getServiceLogs(service.id, 30);
                    if (logs && logs.serviceLogs) {
                        const recentLogs = logs.serviceLogs.slice(-10);
                        for (const log of recentLogs) {
                            const time = new Date(log.timestamp).toLocaleTimeString('fr-FR');
                            const message = log.message.substring(0, 100);
                            console.log(`   [${time}] ${message}`);
                        }
                    }
                }
            } else {
                console.log(`\n⚠️  Aucun déploiement trouvé`);
            }

            console.log('');
        }
    }

    console.log('═'.repeat(60));
    console.log('\n✅ Vérification terminée');
}

main().catch(console.error);

