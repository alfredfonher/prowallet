#!/bin/bash

# Mata servidor anterior si está corriendo
if [ -f logs/api-dev.pid ]; then
  pid=$(cat logs/api-dev.pid)
  if ps -p $pid > /dev/null 2>/dev/null; then
    echo "🛑️  Deteniendo servidor (PID: $pid)..."
    kill $pid
    sleep 3
  fi
else
  echo "Servidor no está corriendo"
fi

# Limpiar logs antiguos
rm -f logs/api-dev.log 2>/dev/null

# Iniciar nuevo servidor
echo "🚀 Iniciando servidor..."
cd /home/aprog/Projects/github-project-work/github-proyect/prowallet/apps/api && nohup npm run dev > logs/api-dev.log 2>&1 &
echo $! > logs/api-dev.pid

# Esperar a que arranque
echo "⏳ Esperando a que el servidor arranque..."
sleep 15

echo "✅ Servidor iniciado en puerto 3001"
