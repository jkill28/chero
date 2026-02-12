# Chéro - Budget in a Calendar


A web application for personal finance management with a calendar view.

## Features

- **Languages supported**: English or French
- **Currency selection**: Choose your preferred currency in the settings.
- **Calendar View**: The week starts on Monday.
- **Transactions**: Add one-time or recurring transactions (weekly, monthly) with custom intervals.
- **Daily Balance**: View your projected balance for each day of the calendar.
- **Balance adjustement**: Adjust the daily balance manually.
- **Dockerized**: Easy deployment with Docker.

## Preview

- **Calendar view**:
  <img width="1239" height="882" alt="image" src="https://github.com/user-attachments/assets/4c8adb3a-f480-4bf7-a5c5-dc3426fe93f2" />
  

- **Transaction view**:
  
  <img width="501" height="732" alt="image" src="https://github.com/user-attachments/assets/80850ba2-664d-4cb3-b45b-0f4317dced26" />


- **Mobile view, light theme**:
  
  <img width="512" height="1000" alt="Screenshot_20260212-094414" src="https://github.com/user-attachments/assets/ff8bc116-da75-4eed-ab3e-9e100eeb0615" />


## How to launch

### With Docker

```bash
docker build -t chero .
docker run -p 3003:3003 chero
```

The application will be available at `http://localhost:3003`.

## Database Backups
1. Copy of the database:
  ``` 
   docker cp chero:/app/backend/prisma/dev.db /host/docker/data/any/appdata/dev.db
```
3. Import the database into the container:
```
   docker cp /host/docker/data/any/appdata/dev.db chero:/app/backend/prisma/dev.db
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
