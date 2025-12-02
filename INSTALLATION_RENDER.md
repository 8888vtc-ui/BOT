# 🚀 INSTALLATION ÉTAPE PAR ÉTAPE - RENDER (GRATUIT)

## 📋 GUIDE COMPLET POUR DÉPLOYER DEEPSEEK SUR RENDER

---

## ✅ ÉTAPE 1 : PRÉPARER LE DOCKERFILE (DÉJÀ FAIT) ✅

**Le Dockerfile est déjà créé dans le repo !** ✅

---

## ✅ ÉTAPE 2 : CRÉER UN NOUVEAU SERVICE SUR RENDER

### 2.1 Aller sur Render

1. Ouvrir : https://dashboard.render.com
2. Vous êtes déjà connecté ✅

### 2.2 Créer un nouveau Web Service

1. Cliquer sur **"New +"** (en haut à droite)
2. Sélectionner **"Web Service"**
3. Connecter votre compte GitHub si pas déjà fait :
   - Cliquer **"Connect GitHub"**
   - Autoriser Render
   - Sélectionner le repo **`gurugammon-gnubg-api`** (ou `BOT`)

---

## ✅ ÉTAPE 3 : CONFIGURER LE SERVICE RENDER

### 3.1 Paramètres de base

**Remplir le formulaire :**

- **Name :** `ollama-deepseek` (ou ce que vous voulez)
- **Region :** Choisir le plus proche (ex: `Frankfurt` ou `Oregon`)
- **Branch :** `main`
- **Root Directory :** Laisser vide (ou `/`)

### 3.2 Configuration Docker

**Important :** Render doit détecter que c'est un Dockerfile

- **Environment :** `Docker`
- Render détecte automatiquement le `Dockerfile` ✅

### 3.3 Configuration avancée

**Cliquer sur "Advanced" :**

- **Dockerfile Path :** `Dockerfile` (déjà détecté)
- **Docker Context :** `.` (racine)

### 3.4 Port et santé

- **Port :** `11434` (port Ollama)
- **Health Check Path :** `/api/tags` (pour vérifier qu'Ollama fonctionne)

---

## ✅ ÉTAPE 4 : CRÉER LE SERVICE

### 4.1 Lancer le déploiement

1. Cliquer **"Create Web Service"**
2. Render commence à déployer automatiquement
3. Attendre 2-3 minutes pour le déploiement

### 4.2 Vérifier les logs

1. Dans Render, cliquer sur votre service
2. Onglet **"Logs"**
3. Vérifier que :
   - ✅ `ollama pull deepseek-coder` apparaît
   - ✅ `Starting Ollama...` apparaît
   - ✅ Pas d'erreurs

**Le déploiement prend 2-5 minutes.**

---

## ✅ ÉTAPE 5 : RÉCUPÉRER L'URL PUBLIQUE

### 5.1 Trouver l'URL

1. Dans Render, votre service est affiché
2. En haut, vous voyez l'URL publique :
   - Exemple : `https://ollama-deepseek.onrender.com`
   - **COPIER CETTE URL** ✅

### 5.2 Tester l'URL

**Ouvrir un terminal et tester :**

```bash
# Remplacer par votre URL Render
curl https://ollama-deepseek.onrender.com/api/tags
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

**Ajouter ces 2 variables :**

**Variable 1 :**
```
Name: OLLAMA_URL
Value: https://ollama-deepseek.onrender.com
```
*(Remplacer par votre URL Render)*

**Variable 2 :**
```
Name: OLLAMA_MODEL
Value: deepseek-coder
```

### 6.3 Vérifier les variables

**Vous devriez avoir :**
- ✅ `OLLAMA_URL` = `https://votre-service.onrender.com`
- ✅ `OLLAMA_MODEL` = `deepseek-coder`

---

## ✅ ÉTAPE 7 : REDÉPLOYER NETLIFY

### 7.1 Déclencher un nouveau déploiement

**Option A : Via l'interface Netlify**
1. Dans Netlify, aller dans **"Deploys"**
2. Cliquer **"Trigger deploy"** → **"Deploy site"**
3. Attendre que le déploiement se termine

**Option B : Via Git**
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

## ⚠️ NOTES IMPORTANTES RENDER

### Plan Gratuit Render

**Limitations du plan gratuit :**
- ⚠️ **Service s'endort après 15 minutes d'inactivité**
- ⚠️ **Premier démarrage peut prendre 30-60 secondes** (cold start)
- ⚠️ **Suffisant pour usage modéré**

**Solutions :**
- ✅ Le bot fonctionne toujours (juste un peu plus lent au démarrage)
- ✅ Ou passer au plan payant ($7/mois) pour service toujours actif

### Garder le Service Actif (Optionnel)

**Pour éviter le cold start :**
1. Utiliser un service de ping (ex: UptimeRobot - gratuit)
2. Ping toutes les 10 minutes pour garder actif
3. Ou accepter le cold start (30-60s au premier appel)

---

## 🎉 RÉSULTAT FINAL

### Ce qui est maintenant configuré :

- ✅ **Ollama déployé** sur Render (gratuit)
- ✅ **DeepSeek disponible** localement (gratuit)
- ✅ **Netlify configuré** pour utiliser Ollama
- ✅ **Bot fonctionnel** avec DeepSeek gratuit

### Coût total : **$0** (100% GRATUIT) 🎉

---

## 🔧 DÉPANNAGE RENDER

### Problème 1 : Service ne démarre pas

**Solution :**
1. Vérifier les logs Render
2. Vérifier que le Dockerfile est correct
3. Vérifier que le port est bien `11434`

### Problème 2 : Timeout au démarrage

**Solution :**
1. Render peut prendre 2-5 minutes au premier démarrage
2. Attendre que `ollama pull deepseek-coder` se termine
3. Vérifier les logs

### Problème 3 : Service s'endort

**Solution :**
1. C'est normal sur plan gratuit
2. Premier appel après inactivité prend 30-60s
3. Ou utiliser UptimeRobot pour garder actif

### Problème 4 : Netlify ne peut pas se connecter

**Solution :**
1. Vérifier que `OLLAMA_URL` est correcte dans Netlify
2. Vérifier que l'URL Render est publique
3. Tester l'URL avec `curl` depuis votre machine

---

## 📝 CHECKLIST FINALE

- [ ] Service Render créé et déployé
- [ ] URL Render récupérée
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

**Suivez ces étapes avec Render et dites-moi où vous en êtes !** 🚀

