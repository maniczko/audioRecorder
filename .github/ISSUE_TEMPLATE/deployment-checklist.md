---
name: 🚀 Deployment Checklist
description: Checklista przed wdrożeniem na produkcję
title: '[DEPLOY] YYYY-MM-DD - Deployment na produkcję'
labels: [deployment, production]
assignees: []
---

## 📋 Pre-deployment Checklist

### Code Quality

- [ ] Wszystkie testy przechodzą (`npm test`)
- [ ] Build kończy się sukcesem (`npm run build`)
- [ ] Lint nie zgłasza błędów (`npm run lint`)
- [ ] Type check przechodzi (`npm run type-check`)
- [ ] Coverage > 80%

### Testing

- [ ] Testy manualne na staging
- [ ] E2E testy przechodzą
- [ ] Regression testy przechodzą
- [ ] Performance testy OK

### Database

- [ ] Migracje przygotowane
- [ ] Backup bazy wykonany
- [ ] Migration script przetestowany na staging

### Configuration

- [ ] Zmienne środowiskowe zaktualizowane
- [ ] API keys ważne
- [ ] Secrets w Railway ustawione

### Documentation

- [ ] CHANGELOG.md zaktualizowane
- [ ] README.md aktualne
- [ ] API documentation zaktualizowana

---

## 🚀 Deployment Steps

### 1. Merge do main

```bash
git checkout main
git pull origin main
git merge feature/xxx
git push origin main
```

### 2. Railway Deploy

- [ ] Deploy automatyczny uruchomiony
- [ ] Build logs OK
- [ ] Deploy logs OK
- [ ] Post-deploy uruchomiony

### 3. Post-deployment Checks

- [ ] Health check: `curl https://domain/api/health`
- [ ] Smoke test: `npm run test:smoke`
- [ ] Logi sprawdzono: `railway logs`
- [ ] Sentry errors: 0 nowych

### 4. Monitoring

- [ ] Uptime monitoring włączony
- [ ] Error tracking aktywny
- [ ] Performance metrics OK

---

## 📊 Deployment Info

| Pole                | Wartość |
| ------------------- | ------- |
| Data                |         |
| Commit Hash         |         |
| Deployed by         |         |
| Railway Environment |         |
| Build Time          |         |
| Post-deploy Status  |         |

---

## 🚨 Rollback Plan

Jeśli coś pójdzie nie tak:

1. **Rollback Railway:**

   ```bash
   railway rollback <previous-commit>
   ```

2. **Database rollback:**

   ```bash
   # Przywróć backup
   ```

3. **Komunikacja:**
   - [ ] Poinformuj team
   - [ ] Update status page
   - [ ] Post-mortem scheduled

---

## ✅ Post-deployment

- [ ] 15 minut monitorowania
- [ ] 1 godzina monitorowania
- [ ] 24 godziny - check metrics
- [ ] Team notified of success

---

## 📝 Notes

Dodatkowe uwagi z deploymentu:
