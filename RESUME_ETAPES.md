# 📋 RÉSUMÉ DES ÉTAPES - INSTALLATION OLLAMA

## 🎯 OBJECTIF
Déployer DeepSeek gratuitement avec Ollama sur Railway.

---

## ✅ CHECKLIST RAPIDE

### Étape 1 : Préparer le code ✅
- [x] Dockerfile créé
- [x] Code modifié pour utiliser Ollama
- [x] Tout est commité et pushé

### Étape 2 : Railway
- [ ] Créer compte Railway (https://railway.app)
- [ ] Créer nouveau projet
- [ ] Connecter le repo GitHub `gurugammon-gnubg-api`
- [ ] Railway déploie automatiquement
- [ ] Récupérer l'URL publique (ex: `https://xxx.up.railway.app`)

### Étape 3 : Netlify
- [ ] Aller sur Netlify (https://app.netlify.com)
- [ ] Sélectionner le site `botgammon`
- [ ] Ajouter variable `OLLAMA_URL` = URL Railway
- [ ] Ajouter variable `OLLAMA_MODEL` = `deepseek-coder`
- [ ] Redéployer Netlify

### Étape 4 : Tester
- [ ] Tester une partie contre le bot
- [ ] Vérifier les logs Netlify (doit dire "Using Ollama (FREE)")
- [ ] Vérifier que tout fonctionne

---

## 🚀 COMMANDES RAPIDES

### Tester Ollama Railway
```bash
curl https://votre-projet.up.railway.app/api/tags
```

### Vérifier les variables Netlify
Dans Netlify → Site settings → Environment variables

---

## 💰 COÛT FINAL

**$0** (100% GRATUIT) 🎉

---

**Dites-moi à quelle étape vous êtes et je vous guide !** 🚀

