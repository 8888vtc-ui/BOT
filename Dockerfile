FROM ollama/ollama:latest

# Exposer le port Ollama
EXPOSE 11434

# Copier le script d'entrée
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Utiliser le script d'entrée
ENTRYPOINT ["/docker-entrypoint.sh"]
