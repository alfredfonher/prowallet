# 🐳 Docker Compose - Quick Start

## ⚡ En 3 Pasos

### 1️⃣ Crear archivo de secretos

```bash
cp .env.docker.example .env.docker
# Edita .env.docker con tus valores reales
nano .env.docker
```

### 2️⃣ Levantar todo

```bash
docker-compose up --env-file .env.docker --build
```

### 3️⃣ Verificar que funciona

```bash
# En otra terminal
curl http://localhost:3001/api/v1/health
curl http://localhost:3000/
```

---

## 📋 Qué se levanta

| Servicio   | Puerto | URL                          |
| ---------- | ------ | ---------------------------- |
| API        | 3001   | http://localhost:3001/api/v1 |
| WEB        | 3000   | http://localhost:3000        |
| PostgreSQL | 5432   | localhost:5432               |
| Redis      | 6379   | localhost:6379               |

---

## 🛑 Parar todo

```bash
docker-compose down

# Incluir volúmenes (borra datos)
docker-compose down -v
```

---

## 📊 Ver logs

```bash
# Todos los servicios
docker-compose logs -f

# Solo API
docker-compose logs -f api

# Solo WEB
docker-compose logs -f web

# Solo DB
docker-compose logs -f postgres
```

---

## ⚠️ IMPORTANTE

1. **`.env.docker` NUNCA se commita** - está en `.gitignore`
2. **Contiene secretos reales** - Guárdalo bien
3. **Se crea desde `.env.docker.example`** - que SÍ está en git

---

**Para más detalles**: Ver `DOCKER_SETUP.md`
