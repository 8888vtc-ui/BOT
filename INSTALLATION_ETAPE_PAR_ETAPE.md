# 🚀 INSTALLATION ÉTAPE PAR ÉTAPE - OLLAMA GRATUIT

## 📋 GUIDE COMPLET POUR DÉPLOYER DEEPSEEK GRATUITEMENT

---

## 🎯 OBJECTIF

Déployer Ollama avec DeepSeek sur Railway (GRATUIT) et le connecter à Netlify.

---

## ✅ ÉTAPE 1 : CRÉER LE DOCKERFILE

### 1.1 Créer le fichier Dockerfile

**Dans le repo `gurugammon-gnubg-api`, créer un fichier `Dockerfile` :**

```dockerfile
FROM ollama/ollama:latest

# Télécharger DeepSeek au démarrage
RUN ollama pull deepseek-coder

# Exposer le port Ollama
EXPOSE 11434

# Démarrer Ollama
CMD ["ollama", "serve"]
```

**Créer ce fichier maintenant.**

---

## ✅ ÉTAPE 2 : CRÉER COMPTE RAILWAY

### 2.1 Aller sur Railway

1. Ouvrir : https://railway.app
2. Cliquer sur **"Start a New Project"** ou **"Login"**

### 2.2 Créer un compte

**Option A : Avec GitHub (Recommandé)**
1. Cliquer **"Login with GitHub"**
2. Autoriser Railway à accéder à votre GitHub
3. Compte créé automatiquement ✅

**Option B : Avec Email**
1. Cliquer **"Sign Up"**
2. Entrer email et mot de passe
3. Vérifier email
4. Compte créé ✅

**Une fois connecté, vous êtes sur le dashboard Railway.**

---

## ✅ ÉTAPE 3 : CRÉER LE PROJET RAILWAY

### 3.1 Créer un nouveau projet

1. Dans Railway, cliquer **"New Project"** (bouton violet)
2. Sélectionner **"Deploy from GitHub repo"**
3. Si pas connecté à GitHub :
   - Cliquer **"Configure GitHub App"**
   - Autoriser Railway
   - Rafraîchir la page

### 3.2 Sélectionner le repo

1. Chercher **`gurugammon-gnubg-api`** ou **`BOT`**
2. Cliquer sur le repo
3. Railway détecte automatiquement le `Dockerfile`

### 3.3 Configurer le service

1. Railway crée automatiquement un service
2. Vérifier que :
   - **Source :** GitHub repo `gurugammon-gnubg-api`
   - **Dockerfile détecté :** ✅
   - **Port :** 11434 (Ollama)

**Railway commence à déployer automatiquement.**

---

## ✅ ÉTAPE 4 : CONFIGURER LE PORT ET LES VARIABLES

### 4.1 Configurer le port

1. Dans Railway, cliquer sur le service déployé
2. Aller dans **"Settings"**
3. Section **"Networking"**
4. **Port :** `11434`
5. Cliquer **"Generate Domain"** pour obtenir l'URL publique

### 4.2 Récupérer l'URL publique

1. Dans **"Settings"** → **"Networking"**
2. Copier l'URL générée (ex: `https://votre-projet.up.railway.app`)
3. **GARDER CETTE URL** (on en aura besoin)

**L'URL ressemble à :** `https://ollama-xxxxx.up.railway.app`

---

## ✅ ÉTAPE 5 : VÉRIFIER LE DÉPLOIEMENT

### 5.1 Vérifier les logs

1. Dans Railway, cliquer sur le service
2. Onglet **"Deployments"**
3. Cliquer sur le dernier déploiement
4. Vérifier les logs :
   - ✅ `ollama pull deepseek-coder` doit apparaître
   - ✅ `Starting Ollama...` doit apparaître
   - ✅ Pas d'erreurs

### 5.2 Tester l'API Ollama

**Ouvrir un terminal et tester :**

```bash
# Remplacer par votre URL Railway
curl https://votre-projet.up.railway.app/api/tags
```

**Résultat attendu :**
```json
{
  "models": [
    {
      "name": "deepseek-coder",
      ...
    }
  ]
}
```

**Si ça fonctionne, Ollama est déployé !** ✅

---

## ✅ ÉTAPE 6 : CONFIGURER NETLIFY

### 6.1 Aller sur Netlify

1. Ouvrir : https://app.netlify.com
2. Sélectionner le site **`botgammon`** (ou votre site)

### 6.2 Ajouter les variables d'environnement

1. Aller dans **"Site settings"**
2. Cliquer **"Environment variables"**
3. Cliquer **"Add a variable"**

**Ajouter ces variables :**

```
Variable: OLLAMA_URL
Value: https://votre-projet.up.railway.app
```

```
Variable: OLLAMA_MODEL
Value: deepseek-coder
```

### 6.3 Vérifier les variables

**Vous devriez avoir :**
- ✅ `OLLAMA_URL` = `https://votre-projet.up.railway.app`
- ✅ `OLLAMA_MODEL` = `deepseek-coder`

**Optionnel (fallback) :**
- `DEEPSEEK_API_KEY` = `sk-...` (seulement si Ollama ne fonctionne pas)

---

## ✅ ÉTAPE 7 : REDÉPLOYER NETLIFY

### 7.1 Déclencher un nouveau déploiement

1. Dans Netlify, aller dans **"Deploys"**
2. Cliquer **"Trigger deploy"** → **"Deploy site"**
3. Attendre que le déploiement se termine

**OU**

1. Faire un commit vide dans GitHub :
```bash
git commit --allow-empty -m "trigger netlify deploy with Ollama"
git push
```

### 7.2 Vérifier les logs Netlify

1. Dans Netlify, aller dans **"Functions"**
2. Cliquer sur **"analyze"**
3. Vérifier les logs :
   - ✅ `Using Ollama (FREE) for DeepSeek local` doit apparaître
   - ✅ Pas d'erreurs de connexion Ollama

---

## ✅ ÉTAPE 8 : TESTER LE BOT

### 8.1 Tester une partie

1. Aller sur votre site déployé
2. Lancer une partie contre le bot
3. Observer les logs dans Netlify Functions

### 8.2 Vérifier que Ollama est utilisé

**Dans les logs Netlify Functions, vous devriez voir :**
```
Using Ollama (FREE) for DeepSeek local
```

**Si vous voyez ça, Ollama fonctionne !** ✅

---

## ✅ ÉTAPE 9 : VÉRIFIER LES COÛTS

### 9.1 Vérifier Railway

1. Dans Railway, aller dans **"Usage"**
2. Vérifier que vous êtes sur le **plan gratuit**
3. Vérifier l'utilisation :
   - **CPU :** Limitée mais suffisante
   - **RAM :** Limitée mais suffisante
   - **Bandwidth :** Limitée mais suffisante

**Plan gratuit Railway :**
- ✅ $5 de crédit gratuit/mois
- ✅ Suffisant pour Ollama

### 9.2 Vérifier Netlify

1. Dans Netlify, aller dans **"Billing"**
2. Vérifier que vous êtes sur le **plan free**
3. Vérifier l'utilisation :
   - **Functions :** 125k invocations/mois (gratuit)
   - **Bandwidth :** 100 GB/mois (gratuit)

**Tout est GRATUIT !** ✅

---

## 🎉 RÉSULTAT FINAL

### Ce qui est maintenant configuré :

- ✅ **Ollama déployé** sur Railway (gratuit)
- ✅ **DeepSeek disponible** localement (gratuit)
- ✅ **Netlify configuré** pour utiliser Ollama
- ✅ **Bot fonctionnel** avec DeepSeek gratuit

### Coût total : **$0** (100% GRATUIT) 🎉

---

## 🔧 DÉPANNAGE

### Problème 1 : Railway ne trouve pas le Dockerfile

**Solution :**
1. Vérifier que le `Dockerfile` est à la racine du repo
2. Vérifier que le repo est bien connecté à Railway
3. Redéployer manuellement

### Problème 2 : Ollama ne répond pas

**Solution :**
1. Vérifier les logs Railway
2. Vérifier que `deepseek-coder` est bien téléchargé
3. Vérifier l'URL publique Railway

### Problème 3 : Netlify ne peut pas se connecter à Ollama

**Solution :**
1. Vérifier que `OLLAMA_URL` est correcte dans Netlify
2. Vérifier que l'URL Railway est publique (pas privée)
3. Tester l'URL avec `curl` depuis votre machine

### Problème 4 : Timeout Ollama

**Solution :**
1. Railway peut avoir des timeouts sur plan gratuit
2. Augmenter le timeout dans le code (déjà fait : 30s)
3. Ou utiliser un VPS payant ($5/mois)

---

## 📝 CHECKLIST FINALE

- [ ] Dockerfile créé dans le repo
- [ ] Compte Railway créé
- [ ] Projet Railway créé et déployé
- [ ] URL Railway récupérée
- [ ] Variables Netlify configurées (`OLLAMA_URL`, `OLLAMA_MODEL`)
- [ ] Netlify redéployé
- [ ] Bot testé et fonctionnel
- [ ] Logs vérifiés (Ollama utilisé)

---

## 🎯 PROCHAINES ÉTAPES

Une fois tout configuré :

1. ✅ Tester plusieurs parties contre le bot
2. ✅ Vérifier que les coûts restent à $0
3. ✅ Profiter du bot gratuit ! 🎉

---

**Suivez ces étapes une par une et dites-moi où vous en êtes !** 🚀

