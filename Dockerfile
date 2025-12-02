FROM ollama/ollama:latest

# Exposer le port Ollama
EXPOSE 11434

# Créer un script de démarrage qui démarre Ollama puis télécharge le modèle au runtime
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'set -e' >> /start.sh && \
    echo 'echo "Starting Ollama server..."' >> /start.sh && \
    echo 'ollama serve &' >> /start.sh && \
    echo 'echo "Waiting for Ollama to be ready..."' >> /start.sh && \
    echo 'sleep 15' >> /start.sh && \
    echo 'echo "Pulling deepseek-coder model..."' >> /start.sh && \
    echo 'ollama pull deepseek-coder || echo "Model pull failed, will retry later"' >> /start.sh && \
    echo 'echo "Ollama is ready!"' >> /start.sh && \
    echo 'wait' >> /start.sh && \
    chmod +x /start.sh

# Utiliser le script de démarrage
CMD ["/start.sh"]
