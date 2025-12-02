FROM ollama/ollama:latest

# Exposer le port Ollama
EXPOSE 11434

# Créer un script de démarrage qui démarre Ollama puis télécharge le modèle
RUN echo '#!/bin/sh\n\
# Démarrer Ollama en arrière-plan\n\
ollama serve &\n\
# Attendre que Ollama soit prêt\n\
sleep 10\n\
# Télécharger DeepSeek\n\
ollama pull deepseek-coder\n\
# Garder Ollama en cours d'\''exécution\n\
wait' > /start.sh && chmod +x /start.sh

# Utiliser le script de démarrage
CMD ["/start.sh"]
