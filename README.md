# GuruGammon GNUBG API

API serverless pour analyser les parties de backgammon avec GNU Backgammon.

## 🚀 Déploiement

1. **Push sur GitHub** :
```bash
git add .
git commit -m "Initial GNUBG API"
git remote add origin https://github.com/8888vtc-ui/gurugammon-gnubg-api.git
git push -u origin main
```

2. **Déployer sur Netlify** :
   - Va sur Netlify Dashboard
   - "Add new site" → "Import from Git"
   - Sélectionne ce repo
   - Deploy !

## 📦 Obtenir le binaire GNUBG

Le binaire GNUBG doit être placé dans `netlify/bin/gnubg`.

### Option 1 : Télécharger un binaire précompilé Linux x64

```bash
mkdir -p netlify/bin
cd netlify/bin
# Télécharge un binaire statique GNUBG pour Linux
wget https://github.com/gnubg/gnubg/releases/download/v1.07.001/gnubg-linux-x64
chmod +x gnubg-linux-x64
mv gnubg-linux-x64 gnubg
```

### Option 2 : Compiler GNUBG

Si pas de binaire disponible, compile-le dans Docker :

```dockerfile
FROM debian:bullseye
RUN apt-get update && apt-get install -y build-essential wget
RUN wget https://ftp.gnu.org/gnu/gnubg/gnubg-1.07.001.tar.gz
RUN tar -xzf gnubg-1.07.001.tar.gz
WORKDIR /gnubg-1.07.001
RUN ./configure --without-gtk --disable-cputest
RUN make
# Le binaire sera dans gnubg/gnubg
```

## 🔧 Utilisation

### Endpoint

```
POST https://YOUR-SITE.netlify.app/.netlify/functions/analyze
```

### Body

```json
{
  "moves": [
    { "from": 24, "to": 22, "player": 1 },
    { "from": 13, "to": 11, "player": 1 }
  ],
  "initialPosition": "xgid=--------------ABBBB-:0:0:1:00:0:0:3:0:10" 
}
```

### Response

```json
{
  "equity": 0.123,
  "winProbability": 52.3,
  "winGammon": 12.1,
  "loseGammon": 8.5,
  "errors": [
    {
      "moveNumber": 3,
      "type": "blunder",
      "equityLoss": 0.25,
      "correctMove": "24/22 13/11"
    }
  ],
  "bestMoves": [
    { "from": 8, "to": 6, "equity": 0.150 }
  ]
}
```

## ⚙️ Variables d'environnement

Aucune nécessaire pour l'instant.

## 📝 Notes

- Timeout Netlify gratuit : 10s
- Si analyses trop longues → passer en Pro (26s timeout)
- Alternative : héberger sur Render/Railway
