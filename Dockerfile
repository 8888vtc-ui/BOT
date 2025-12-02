FROM ollama/ollama:latest

# Exposer le port Ollama
EXPOSE 11434

# Créer un script de démarrage
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'ollama serve &' >> /start.sh && \
    echo 'sleep 15' >> /start.sh && \
    echo 'ollama pull deepseek-coder || true' >> /start.sh && \
    echo 'wait' >> /start.sh && \
    chmod +x /start.sh

# Utiliser le script de démarrage
CMD ["/start.sh"]
