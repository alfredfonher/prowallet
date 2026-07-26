# Database Configuration Guide

## Overview

Este proyecto utiliza **Prisma ORM** con diferentes bases de datos según el entorno:

- **Producción (servidor)**: SQLite (`dev.db`)
- **Desarrollo local**: PostgreSQL

---

## Configuration

### `.env` (Production - SQLite)

```env
DATABASE_URL="file:./dev.db"
```

### `.env.local` (Development - PostgreSQL)

```env
DATABASE_URL="postgresql://aprog93:Fcb1899Nov29@@localhost:5432/prowallet?schema=public"
```

---

## Setup Development Environment

### 1. Instalar PostgreSQL (si no está instalado)

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**macOS:**

```bash
brew install postgresql
brew services start postgresql
```

### 2. Crear Base de Datos y Usuario

```bash
sudo -u postgres psql

# Dentro de psql:
CREATE DATABASE prowallet;
CREATE USER aprog93 WITH PASSWORD 'password';
ALTER ROLE aprog93 SET client_encoding TO 'utf8';
ALTER ROLE aprog93 SET default_transaction_isolation TO 'read committed';
ALTER ROLE aprog93 SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE prowallet TO aprog93;
\q
```

### 3. Ejecutar Migraciones

```bash
cd /home/aprog93/Escritorio/prowallet/apps/api

# Generar cliente Prisma
pnpm prisma generate

# Ejecutar migraciones
pnpm prisma migrate dev --name init

# Ver datos (opcional)
pnpm prisma studio
```

---

## Production Deployment

En producción, el archivo `dev.db` se creará automáticamente en SQLite:

```bash
# Build
pnpm build

# Run
NODE_ENV=production pnpm start
```

SQLite almacenará los datos en `./dev.db` (archivo local).

---

## Docker Deployment

Si usas Docker Compose con PostgreSQL en producción:

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: prowallet
      POSTGRES_USER: aprog93
      POSTGRES_PASSWORD: <secure-password>
    ports:
      - "5432:5432"

  api:
    environment:
      DATABASE_URL: "postgresql://aprog93:<password>@postgres:5432/prowallet?schema=public"
```

---

## Troubleshooting

### Error: `Can't reach database server at localhost:5432`

**Solución:**

1. Verificar que PostgreSQL está corriendo:

   ```bash
   sudo systemctl status postgresql
   # o
   brew services list | grep postgresql
   ```

2. Reiniciar PostgreSQL:

   ```bash
   sudo systemctl restart postgresql
   # o
   brew services restart postgresql
   ```

3. Verificar credenciales en `.env.local`

### Error: `database "prowallet" does not exist`

**Solución:**

```bash
sudo -u postgres psql
CREATE DATABASE prowallet;
\q
```

---

## Important Notes

- ⚠️ **Never commit `.env.local` to git** (already in .gitignore)
- 🔐 Change default credentials in production
- 📦 SQLite for production is lightweight, no external dependency needed
- 🗄️ PostgreSQL for development provides better multi-user support
