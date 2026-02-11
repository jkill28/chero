# Chéro - Calendrier Budgétaire

Une application web de gestion de finances personnelles avec vue calendrier.

## Fonctionnalités

- **Sélection de devise**: Choisissez votre devise préférée dans les paramètres.
- **Vue Calendrier**: La semaine commence le lundi.
- **Transactions**: Ajoutez des transactions ponctuelles ou récurrentes (hebdomadaires, mensuelles) avec intervalles personnalisés.
- **Solde Quotidien**: Visualisez votre solde prévisionnel pour chaque jour du calendrier.
- **Dockerisé**: Déploiement facile avec Docker.

## Comment lancer

### Avec Docker

```bash
docker build -t chero .
docker run -p 3003:3003 chero
```

L'application sera disponible sur `http://localhost:3003`.

### Développement Local

1. **Backend**:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev
   npm run dev
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Le frontend sera sur `http://localhost:5173` et le backend sur `http://localhost:3003`.
Le proxy Vite est configuré pour rediriger les appels `/api` vers le backend.
