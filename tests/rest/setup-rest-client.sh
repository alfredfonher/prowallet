#!/bin/bash

###############################################################################
# PROWALLET API - REST CLIENT SETUP SCRIPT
# 
# Script para configurar rápidamente los tests REST en VS Code
# 
# Uso: bash setup-rest-client.sh
###############################################################################

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     PROWALLET API - REST CLIENT SETUP                         ║"
echo "║     Configuración automática de tests REST                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Detectar sistema operativo
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM="Linux";;
    Darwin*)    PLATFORM="Mac";;
    CYGWIN*)    PLATFORM="Cygwin";;
    MINGW*)     PLATFORM="MinGw";;
    *)          PLATFORM="UNKNOWN";;
esac

echo -e "${BLUE}[INFO]${NC} Plataforma detectada: $PLATFORM"

# ============================================================================
# PASO 1: Verificar que VS Code está instalado
# ============================================================================

echo -e "\n${BLUE}[PASO 1]${NC} Verificando VS Code..."

if ! command -v code &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} VS Code no está instalado"
    echo "Instalar desde: https://code.visualstudio.com"
    exit 1
fi

echo -e "${GREEN}[OK]${NC} VS Code encontrado"
code --version

# ============================================================================
# PASO 2: Verificar/Instalar extensión REST Client
# ============================================================================

echo -e "\n${BLUE}[PASO 2]${NC} Verificando extensión REST Client..."

if code --list-extensions | grep -q "humao.rest-client"; then
    echo -e "${GREEN}[OK]${NC} REST Client ya está instalado"
else
    echo -e "${YELLOW}[INSTALAR]${NC} Instalando REST Client..."
    code --install-extension humao.rest-client
    echo -e "${GREEN}[OK]${NC} REST Client instalado"
fi

# ============================================================================
# PASO 3: Verificar que estamos en la carpeta correcta
# ============================================================================

echo -e "\n${BLUE}[PASO 3]${NC} Verificando ubicación de archivos..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo -e "${BLUE}[INFO]${NC} Directorio de scripts: $SCRIPT_DIR"

if [ ! -f "$SCRIPT_DIR/00-variables.rest" ]; then
    echo -e "${RED}[ERROR]${NC} Archivos .rest no encontrados"
    echo "Asegúrate de ejecutar este script desde: /tests/rest/"
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Archivos REST encontrados"
ls -1 *.rest | head -5
echo "  ... y más"

# ============================================================================
# PASO 4: Configurar variables de entorno
# ============================================================================

echo -e "\n${BLUE}[PASO 4]${NC} Configurando variables..."

# Preguntar por ambiente
echo -e "\n${YELLOW}¿Cuál es tu ambiente?${NC}"
echo "1) Producción (https://servicioshilda.orioncaribe.com)"
echo "2) Desarrollo Local (http://localhost:3001)"
echo "3) Docker Compose (http://localhost:3005)"
read -p "Selecciona (1-3) [1]: " ENVIRONMENT
ENVIRONMENT=${ENVIRONMENT:-1}

case $ENVIRONMENT in
    1)
        API_URL="https://servicioshilda.orioncaribe.com/api/v1"
        ENV_NAME="PRODUCCIÓN"
        ;;
    2)
        API_URL="http://localhost:3001/api/v1"
        ENV_NAME="DESARROLLO LOCAL"
        ;;
    3)
        API_URL="http://localhost:3005/api/v1"
        ENV_NAME="DOCKER COMPOSE"
        ;;
    *)
        echo -e "${RED}[ERROR]${NC} Opción inválida"
        exit 1
        ;;
esac

echo -e "${GREEN}[OK]${NC} Ambiente configurado: $ENV_NAME"
echo -e "${BLUE}[INFO]${NC} URL de API: $API_URL"

# ============================================================================
# PASO 5: Verificar conexión a API
# ============================================================================

echo -e "\n${BLUE}[PASO 5]${NC} Verificando conexión a API..."

if command -v curl &> /dev/null; then
    if curl -s -m 5 "$API_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} API está accesible"
    else
        echo -e "${YELLOW}[ADVERTENCIA]${NC} API no responde en $API_URL"
        echo "Asegúrate de:"
        if [ "$ENVIRONMENT" -eq 2 ]; then
            echo "  - Ejecutar la API local en el puerto 3001"
        fi
        if [ "$ENVIRONMENT" -eq 3 ]; then
            echo "  - Ejecutar: docker compose up api"
        fi
        echo "  - Verificar conexión de red"
        read -p "¿Continuar de todas formas? (s/n) [n]: " CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}[ADVERTENCIA]${NC} curl no disponible, saltando verificación"
fi

# ============================================================================
# PASO 6: Abrir VS Code con los archivos
# ============================================================================

echo -e "\n${BLUE}[PASO 6]${NC} Abriendo VS Code..."

# Ir al directorio de tests REST
cd "$SCRIPT_DIR"

# Abrir VS Code en este directorio
code .

# Pequeña pausa
sleep 2

echo -e "${GREEN}[OK]${NC} VS Code abierto en: $(pwd)"

# ============================================================================
# PASO 7: Mostrar instrucciones finales
# ============================================================================

echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ SETUP COMPLETADO${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}PRÓXIMOS PASOS:${NC}"
echo -e "1. En VS Code, abre: ${BLUE}00-variables.rest${NC}"
echo -e "2. Actualiza el valor de @api si es necesario"
echo -e "3. Si necesitas token, ejecuta: ${BLUE}02-auth.rest${NC}"
echo -e "4. Copia el accessToken a 00-variables.rest"
echo -e "5. Prueba primero con: ${BLUE}12-quick-start.rest${NC}"

echo -e "\n${YELLOW}ARCHIVOS DISPONIBLES:${NC}"
echo -e "  ${BLUE}00-variables.rest${NC}      - Configuración global"
echo -e "  ${BLUE}01-health.rest${NC}         - Verificar salud API"
echo -e "  ${BLUE}02-auth.rest${NC}           - Autenticación"
echo -e "  ${BLUE}03-purchase.rest${NC}       - Compra de tokens"
echo -e "  ${BLUE}04-exchange.rest${NC}       - Intercambio y precios"
echo -e "  ${BLUE}05-prowallet.rest${NC}      - Información del contrato"
echo -e "  ${BLUE}06-transfer.rest${NC}       - Transferencias"
echo -e "  ${BLUE}07-notifications.rest${NC}  - Notificaciones"
echo -e "  ${BLUE}08-solana-proxy.rest${NC}   - Solana RPC Proxy"
echo -e "  ${BLUE}09-webhooks.rest${NC}       - Webhooks"
echo -e "  ${BLUE}10-admin.rest${NC}          - Admin endpoints"
echo -e "  ${BLUE}11-scenarios.rest${NC}      - Casos de uso complejos"
echo -e "  ${BLUE}12-quick-start.rest${NC}    - Inicio rápido"

echo -e "\n${YELLOW}DOCUMENTACIÓN:${NC}"
echo -e "  ${BLUE}README.md${NC}              - Guía principal"
echo -e "  ${BLUE}CONFIGURATION.md${NC}       - Configuración por ambiente"
echo -e "  ${BLUE}TROUBLESHOOTING.md${NC}     - Solución de problemas"

echo -e "\n${YELLOW}ATAJOS ÚTILES EN REST CLIENT:${NC}"
echo -e "  ${BLUE}Ctrl+Alt+R${NC} o Click 'Send Request' - Ejecutar request"
echo -e "  ${BLUE}Ctrl+Shift+P${NC} - Abrir comando: 'REST Client: Show Request Body'"
echo -e "  ${BLUE}Ctrl+K Ctrl+0${NC} - Plegar todas las secciones"

echo -e "\n${YELLOW}TIPS:${NC}"
echo -e "  • Los requests están organizados por módulo"
echo -e "  • Comienza con 12-quick-start.rest"
echo -e "  • Usar 11-scenarios.rest para flujos completos"
echo -e "  • Ver TROUBLESHOOTING.md si hay errores"

echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}\n"

# ============================================================================
# PASO 8: Mostrar información de debugging
# ============================================================================

echo -e "${YELLOW}INFORMACIÓN DE DEBUGGING:${NC}"
echo -e "  API URL:     ${BLUE}$API_URL${NC}"
echo -e "  Plataforma:  ${BLUE}$PLATFORM${NC}"
echo -e "  Directorio:  ${BLUE}$(pwd)${NC}"

echo ""

exit 0
