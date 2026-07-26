#!/bin/bash

# ============================================================================
# 🐳 ProWallet Docker Setup & Migration Helper
# ============================================================================
# This script manages Docker containers and executes database migrations
# Usage: ./docker-setup.sh [command]
#
# Commands:
#   up        - Start containers in foreground (default)
#   up-d      - Start containers in detached mode (background)
#   down      - Stop and remove containers
#   logs      - View container logs (follow mode)
#   restart   - Restart all containers
#   rebuild   - Rebuild images without cache
#   migrate   - Run Prisma migrations (inside running container)
#   seed      - Seed database with test data
#   status    - Show container status
#   clean     - Remove containers, volumes, and orphan containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default command
COMMAND=${1:-up}

# Print colored header
print_header() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC} 🐳 ProWallet Docker Setup & Migration Helper ${BLUE}║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
}

# Print colored success
print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

# Print colored warning
print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Print colored error
print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Check if docker compose is available
check_docker() {
  if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
  fi
  
  if ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available"
    exit 1
  fi
}

# Execute commands
case "$COMMAND" in
  up)
    print_header
    echo ""
    print_warning "Starting Docker services (foreground mode - press Ctrl+C to stop)..."
    echo ""
    check_docker
    docker compose up
    ;;
  
  up-d)
    print_header
    echo ""
    print_warning "Starting Docker services (detached mode)..."
    echo ""
    check_docker
    docker compose up -d
    print_success "Services started in background"
    echo ""
    echo "View logs with:"
    echo "  docker compose logs -f          (all services)"
    echo "  docker compose logs -f api      (API only)"
    echo "  docker compose logs -f web      (Web only)"
    echo ""
    echo "Stop services with:"
    echo "  docker compose down"
    ;;
  
  down)
    print_header
    echo ""
    print_warning "Stopping and removing Docker services..."
    echo ""
    check_docker
    docker compose down
    print_success "Services stopped and removed"
    ;;
  
  logs)
    print_header
    echo ""
    echo "Showing logs (press Ctrl+C to stop)..."
    echo ""
    check_docker
    docker compose logs -f
    ;;
  
  restart)
    print_header
    echo ""
    print_warning "Restarting Docker services..."
    echo ""
    check_docker
    docker compose restart
    print_success "Services restarted"
    ;;
  
  rebuild)
    print_header
    echo ""
    print_warning "Rebuilding Docker images (no cache)..."
    echo ""
    check_docker
    docker compose build --no-cache
    print_success "Images rebuilt"
    ;;
  
  migrate)
    print_header
    echo ""
    print_warning "Running Prisma migrations in API container..."
    echo ""
    check_docker
    
    # Check if container is running
    if ! docker compose exec -T api test -f ./prisma/schema.prisma &> /dev/null; then
      print_error "API container is not running or Prisma schema not found"
      echo "Start containers first with: ./docker-setup.sh up"
      exit 1
    fi
    
    docker compose exec -T api npx prisma migrate deploy --schema ./prisma/schema.prisma
    print_success "Migrations completed"
    ;;
  
  seed)
    print_header
    echo ""
    print_warning "Seeding database with test data..."
    echo ""
    check_docker
    
    if ! docker compose exec -T api test -f ./dist/scripts/seedDatabase.js &> /dev/null; then
      print_error "API container is not running or seed script not found"
      echo "Start containers first with: ./docker-setup.sh up"
      exit 1
    fi
    
    docker compose exec -T api node ./dist/scripts/seedDatabase.js
    print_success "Database seeded"
    ;;
  
  status)
    print_header
    echo ""
    check_docker
    docker compose ps
    echo ""
    print_success "Status displayed above"
    ;;
  
  clean)
    print_header
    echo ""
    print_warning "Removing containers, volumes, and orphan resources..."
    echo ""
    check_docker
    
    read -p "Are you sure? This will delete all data (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      docker compose down -v
      print_success "Cleanup completed"
    else
      print_warning "Cleanup cancelled"
    fi
    ;;
  
  *)
    print_header
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  up          Start containers in foreground (default)"
    echo "  up-d        Start containers in detached mode (background)"
    echo "  down        Stop and remove containers"
    echo "  logs        View container logs (follow mode)"
    echo "  restart     Restart all containers"
    echo "  rebuild     Rebuild images without cache"
    echo "  migrate     Run Prisma migrations (in running container)"
    echo "  seed        Seed database with test data"
    echo "  status      Show container status"
    echo "  clean       Remove containers, volumes, and orphan containers"
    echo ""
    echo "Examples:"
    echo "  ./docker-setup.sh up           # Start in foreground"
    echo "  ./docker-setup.sh up-d         # Start in background"
    echo "  ./docker-setup.sh logs         # View logs"
    echo "  ./docker-setup.sh down         # Stop containers"
    echo "  ./docker-setup.sh migrate      # Run migrations (needs running container)"
    echo ""
    exit 1
    ;;
esac
