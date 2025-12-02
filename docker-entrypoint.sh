#!/bin/sh
set -e

echo "Starting Ollama server..."
ollama serve &

echo "Waiting for Ollama to be ready..."
sleep 15

echo "Pulling deepseek-coder model..."
ollama pull deepseek-coder || echo "Model pull failed, will retry later"

echo "Ollama is ready!"
wait

