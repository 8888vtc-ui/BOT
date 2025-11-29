#!/bin/bash
# Build GNUBG static binary

set -e

echo "🔨 Building GNUBG static binary..."

# Construire l'image Docker
docker build -t gnubg-static-builder .

# Créer un conteneur temporaire et extraire le binaire
echo "📦 Extracting binary..."
docker create --name gnubg-extract gnubg-static-builder
docker cp gnubg-extract:/gnubg ./netlify/bin/gnubg
docker rm gnubg-extract

# Rendre le binaire exécutable
chmod +x ./netlify/bin/gnubg

# Vérifier le binaire
echo ""
echo "✅ Binary verification:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
file ./netlify/bin/gnubg
ls -lh ./netlify/bin/gnubg
echo ""
echo "Testing binary:"
./netlify/bin/gnubg --version

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Build completed successfully!"
echo "Binary location: ./netlify/bin/gnubg"
echo ""
echo "Next steps:"
echo "1. git add netlify/bin/gnubg"
echo "2. git commit -m 'feat: Add GNUBG static binary'"
echo "3. git push"
echo "4. Netlify will redeploy automatically"
