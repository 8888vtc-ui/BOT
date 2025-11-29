# GuruGammon GNUBG API - Instructions de Build

## 🔨 Compilation du Binaire GNUBG

### Prérequis
- Docker installé et en cours d'exécution

### Étapes

1. **Compiler GNUBG** :
```bash
cd d:\BOLT\gurugammon-gnubg-api
chmod +x build-gnubg.sh
./build-gnubg.sh
```

Ou sous Windows (PowerShell) :
```powershell
cd d:\BOLT\gurugammon-gnubg-api
docker build -t gnubg-static-builder .
docker create --name gnubg-extract gnubg-static-builder
docker cp gnubg-extract:/gnubg .\netlify\bin\gnubg
docker rm gnubg-extract
```

2. **Vérifier le binaire** :
```bash
file netlify/bin/gnubg
ls -lh netlify/bin/gnubg
```

Devrait afficher : `ELF 64-bit LSB executable, x86-64, statically linked`

3. **Pousser sur GitHub** :
```bash
git add .
git commit -m "feat: Add GNUBG static binary and updated analyze function"
git push
```

4. **Netlify redéploiera automatiquement** !

---

## 🧪 Test Local

```bash
echo "quit" | ./netlify/bin/gnubg -t
```

Devrait afficher la version de GNUBG.

---

## 🌐 URL de l'API

Une fois déployé : `https://botgammon.netlify.app/.netlify/functions/analyze`

### Exemple de requête

```bash
curl -X POST https://botgammon.netlify.app/.netlify/functions/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "position": "4HPwATDgc/ABMA",
    "moves": [],
    "dice": [3, 1]
  }'
```

### Réponse

```json
{
  "equity": 0.123,
  "winProbability": 52.3,
  "winGammon": 12.1,
  "loseGammon": 8.5,
  "bestMoves": [
    { "move": "24/22 13/11", "equity": 0.150 },
    { "move": "13/10 6/5", "equity": 0.145 }
  ],
  "analysis": "Full GNUBG output..."
}
```

---

## ⚠️ Notes

- La compilation prend **5-10 minutes**
- Le binaire final fait **~15-25 MB**
- Timeout Netlify Functions : **10s** (gratuit) ou **26s** (Pro)
- Si trop lent, considérer Render.com pour le backend

---

## 🔧 Dépannage

### Le binaire ne s'exécute pas
```bash
chmod +x netlify/bin/gnubg
ldd netlify/bin/gnubg  # Devrait dire "not a dynamic executable"
```

### Timeout Netlify
Si l'analyse prend >10s, passer le site en **Netlify Pro** ($19/mois pour 26s timeout).

Ou migrer vers **Render.com** (gratuit, timeout illimité).
