# Chéro - Budget in a Calendar


A web application for personal finance management with a calendar view.

## Features

- **Languages supported**: English or French
- **Currency selection**: Choose your preferred currency in the settings.
- **Calendar View**: The week starts on Monday.
- **Swipe left/right**: modern calendar view navigation
- **Transactions**: Add one-time or recurring transactions (weekly, monthly) with custom intervals.
- **Daily Balance**: View your projected balance for each day of the calendar.
- **Balance adjustement**: Adjust the daily balance manually.
- **Dockerized**: Easy deployment with Docker.
- **Backup / Restore**: UI to back up and restore the DB



## How to launch

### With Docker

```bash
docker build -t chero .
docker run -p 3003:3003 chero
```

The application will be available at `http://localhost:3003`.

## Auto start docker container
```bash
docker update --restart always chero
```


### Local Development

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

The frontend will be on `http://localhost:3003` and the backend on `http://localhost:3003`.
The Vite proxy is configured to redirect `/api` calls to the backend.
