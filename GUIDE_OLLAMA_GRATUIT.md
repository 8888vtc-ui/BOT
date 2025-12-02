# 🆓 GUIDE OLLAMA GRATUIT - DeepSeek Local

## 🎯 OBJECTIF

Utiliser DeepSeek **100% GRATUITEMENT** avec Ollama sur un serveur local.

---

## ✅ SOLUTION : OLLAMA + DEEPSEEK

**Ollama** permet d'héberger DeepSeek localement, **100% GRATUIT**.

---

## 🚀 INSTALLATION RAPIDE

### Option 1 : Railway (Recommandé - Gratuit) ✅

**Railway offre un plan gratuit parfait pour Ollama.**

#### Étape 1 : Créer Compte Railway
1. Aller sur https://railway.app
2. Créer un compte (gratuit)
3. Connecter avec GitHub

#### Étape 2 : Déployer Ollama
1. Cliquer "New Project"
2. Sélectionner "Deploy from GitHub repo"
3. Créer un nouveau repo avec ce `Dockerfile` :

```dockerfile
FROM ollama/ollama:latest

# Télécharger DeepSeek au démarrage
RUN ollama pull deepseek-coder
```

4. Railway déploie automatiquement
5. Récupérer l'URL publique (ex: `https://votre-projet.railway.app`)

#### Étape 3 : Configurer Netlify
Dans Netlify Functions, ajouter :
```env
OLLAMA_URL=https://votre-projet.railway.app
OLLAMA_MODEL=deepseek-coder
```

**C'est tout !** ✅ **100% GRATUIT**

---

### Option 2 : Render (Gratuit) ✅

**Render offre aussi un plan gratuit.**

#### Étape 1 : Créer Compte Render
1. Aller sur https://render.com
2. Créer un compte (gratuit)

#### Étape 2 : Déployer Ollama
1. Cliquer "New +" → "Web Service"
2. Connecter votre repo GitHub
3. Configuration :
   - **Build Command :** `docker build -t ollama .`
   - **Start Command :** `docker run -p 11434:11434 ollama`
   - **Dockerfile :**
   ```dockerfile
   FROM ollama/ollama:latest
   RUN ollama pull deepseek-coder
   ```

4. Render déploie automatiquement
5. Récupérer l'URL publique

#### Étape 3 : Configurer Netlify
```env
OLLAMA_URL=https://votre-service.onrender.com
OLLAMA_MODEL=deepseek-coder
```

**C'est tout !** ✅ **100% GRATUIT**

---

### Option 3 : VPS (Payant mais Flexible) 💰

**Si vous avez un VPS (Hetzner, DigitalOcean, etc.) :**

```bash
# Installer Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Télécharger DeepSeek
ollama pull deepseek-coder

# Démarrer Ollama (accessible publiquement)
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

**Coût :** ~$5-10/mois pour VPS

---

## 🔧 CONFIGURATION NETLIFY

### Variables d'Environnement

Dans Netlify Functions, configurer :

```env
# Option 1 : Ollama (GRATUIT - Priorité)
OLLAMA_URL=https://votre-ollama.railway.app
OLLAMA_MODEL=deepseek-coder

# Option 2 : DeepSeek API (Payant - Fallback)
DEEPSEEK_API_KEY=sk-...  # Seulement si Ollama non disponible
```

**Le code utilise automatiquement Ollama si disponible, sinon DeepSeek API.**

---

## 📊 COMPARAISON

| Solution | Coût | Limites | Performance |
|----------|------|---------|-------------|
| **Ollama Railway** | **GRATUIT** ✅ | Plan gratuit | Excellente |
| **Ollama Render** | **GRATUIT** ✅ | Plan gratuit | Excellente |
| **Ollama VPS** | $5-10/mois | Aucune | Excellente |
| **DeepSeek API** | $0.004/partie | Aucune | Excellente |

**Ollama sur Railway/Render = 100% GRATUIT !** 🎉

---

## ✅ AVANTAGES OLLAMA

### Avantages

1. ✅ **100% GRATUIT** (pas de coûts API)
2. ✅ **Pas de limites** de requêtes
3. ✅ **Données privées** (pas d'envoi externe)
4. ✅ **Contrôle total** sur le serveur
5. ✅ **Performance** (pas de latence réseau externe)

### Modèles Disponibles

- `deepseek-coder` (recommandé)
- `deepseek-chat`
- `deepseek-r1` (nouveau)

---

## 🧪 TESTER L'INSTALLATION

### Test Ollama Local

```bash
# Vérifier que Ollama fonctionne
curl http://localhost:11434/api/tags

# Tester DeepSeek
curl http://localhost:11434/api/generate -d '{
  "model": "deepseek-coder",
  "prompt": "Bonjour",
  "stream": false
}'
```

### Test depuis Netlify

Le code teste automatiquement si Ollama est disponible et utilise le fallback si nécessaire.

---

## 📝 MODIFICATIONS CODE

**Déjà implémenté !** ✅

Le code a été modifié pour :
1. ✅ Utiliser Ollama en priorité (gratuit)
2. ✅ Fallback vers DeepSeek API si Ollama non disponible
3. ✅ Gestion automatique des erreurs

**Aucune modification supplémentaire nécessaire !**

---

## 🎯 RÉSULTAT FINAL

### Avec Ollama sur Railway/Render

**Coût :** **$0** (100% GRATUIT) 🎉

**Avantages :**
- ✅ Bot niveau supérieur à Snowie
- ✅ DeepSeek intégré
- ✅ **Aucun coût API**
- ✅ Pas de limites

---

## 📋 CHECKLIST

- [ ] Créer compte Railway ou Render (gratuit)
- [ ] Déployer Ollama avec DeepSeek
- [ ] Configurer `OLLAMA_URL` dans Netlify
- [ ] Tester le bot
- [ ] Profiter du bot gratuit ! 🎉

---

**Avec Ollama, le bot est maintenant 100% GRATUIT !** 🆓🎉

