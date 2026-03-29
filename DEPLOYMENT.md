# VoiceLog OS - Deployment Guide

## 📋 Przed wdrożeniem

### Checklista:
- [ ] Wszystkie testy przechodzą (`npm test`)
- [ ] Build kończy się sukcesem (`npm run build`)
- [ ] Zmienne środowiskowe skonfigurowane
- [ ] Baza danych podłączona
- [ ] Domain/SSL skonfigurowane (jeśli dotyczy)

---

## 🚀 Railway Deployment

### Krok 1: Połącz z GitHub
1. Zaloguj się do [Railway](https://railway.app)
2. Click "New Project"
3. Wybierz "Deploy from GitHub repo"
4. Wybierz repozytorium `audioRecorder`

### Krok 2: Konfiguracja zmiennych
Dodaj wszystkie zmienne z `.env` w Railway Dashboard:
- `NODE_ENV=production`
- `DATABASE_URL=...`
- `OPENAI_API_KEY=...`
- `GROQ_API_KEY=...`
- itd.

### Krok 3: Konfiguracja build
Railway automatycznie wykryje `railway.toml`:
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pnpm exec esbuild server/index.ts server/sqliteWorker.ts --bundle --platform=node --format=esm --outdir=dist-server --packages=external"

[deploy]
startCommand = "node dist-server/index.js"
postDeploy = "node scripts/post-deploy.js"
```

### Krok 4: Deploy
```bash
# Automatyczny deploy przy push do main
git push origin main

# Ręczny deploy przez CLI
railway up
```

---

## 📊 Post-deploy Script

### Co robi:
1. **Migracje bazy danych** - aktualizuje schemat DB
2. **Seedowanie** - dodaje dane początkowe (opcjonalne)
3. **Health check** - sprawdza czy aplikacja działa
4. **Powiadomienia** - Slack/Discord (opcjonalne)

### Uruchomienie ręczne:
```bash
pnpm run post-deploy
```

### Logi:
```
╔════════════════════════════════════════════════╗
║   VoiceLog OS - Post-deploy Script             ║
╚════════════════════════════════════════════════╝

┌────────────────────────────────────────────────┐
│ Running Database Migrations                    │
└────────────────────────────────────────────────┘
✅ Migrations completed successfully

┌────────────────────────────────────────────────┐
│ Running Health Check                           │
└────────────────────────────────────────────────┘
✅ Health check passed: {"status":"ok","uptime":123}

✅ All post-deploy steps completed successfully!
```

---

## 🔧 Inne platformy

### Vercel
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Heroku
```bash
heroku login
heroku create voicelog-app
heroku config:set OPENAI_API_KEY=xxx
git push heroku main
heroku run npm run post-deploy
```

### Docker
```bash
docker build -t voicelog-os .
docker run -p 4000:4000 --env-file .env voicelog-os
```

### PM2 (VPS)
```bash
npm i -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 📈 Monitoring po deploy

### 1. Health Check
```bash
curl https://twoja-domena.railway.app/api/health
```

### 2. Logi
```bash
# Railway
railway logs

# Docker
docker logs voicelog-os

# PM2
pm2 logs
```

### 3. Metryki
- **CPU/Memory**: Railway Dashboard
- **Errors**: Sentry
- **Performance**: LangSmith
- **Uptime**: UptimeRobot

---

## 🚨 Rollback

### Railway
```bash
# Przywróć poprzednią wersję
railway rollback <commit-hash>
```

### Docker
```bash
docker stop voicelog-os
docker start voicelog-os-old
```

### Git
```bash
git revert HEAD
git push origin main
```

---

## 🔐 Security Checklist

- [ ] `.env` nie jest w repozytorium
- [ ] API keys w zmiennych środowiskowych
- [ ] HTTPS włączone
- [ ] CORS skonfigurowane
- [ ] Rate limiting włączony
- [ ] Database backups włączone

---

## 📞 Support

### Problemy z deploy:
1. Sprawdź logi: `railway logs`
2. Sprawdź zmienne: `railway variables`
3. Sprawdź health: `curl /api/health`

### Kontakt:
- Email: support@voicelog.com
- Discord: [link]
- GitHub Issues: [link]
