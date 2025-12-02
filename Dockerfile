FROM ollama/ollama:latest

# Télécharger DeepSeek au démarrage
RUN ollama pull deepseek-coder

# Exposer le port Ollama
EXPOSE 11434

# Démarrer Ollama
CMD ["ollama", "serve"]
