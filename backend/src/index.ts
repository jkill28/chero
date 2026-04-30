import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Serve static files from the frontend build directory
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany();
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions', async (req, res) => {
  const { amount, description, date, recurrence, recurrenceInterval, recurrenceEndDate, excludedDates, isAdjustment } = req.body;
  try {
    const transaction = await prisma.transaction.create({
      data: {
        amount: parseFloat(amount),
        description,
        date: new Date(date),
        recurrence,
        isAdjustment: !!isAdjustment,
        recurrenceInterval: recurrenceInterval ? parseInt(recurrenceInterval) : 1,
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        excludedDates,
      },
    });
    res.json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const { amount, description, date, recurrence, recurrenceInterval, recurrenceEndDate, excludedDates, isAdjustment } = req.body;
  try {
    const transaction = await prisma.transaction.update({
      where: { id: parseInt(id) },
      data: {
        amount: parseFloat(amount),
        description,
        date: new Date(date),
        recurrence,
        isAdjustment: !!isAdjustment,
        recurrenceInterval: recurrenceInterval ? parseInt(recurrenceInterval) : 1,
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        excludedDates,
      },
    });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.transaction.delete({
      where: { id: parseInt(id) },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Settings
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 1, currency: 'AUD', initialBalance: 0, language: 'fr' },
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  const { currency, initialBalance, language } = req.body;
  try {
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: { currency, initialBalance: parseFloat(initialBalance), language: language || 'fr' },
      create: { id: 1, currency, initialBalance: parseFloat(initialBalance), language: language || 'fr' },
    });
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Backup & Restore
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const upload = multer({ dest: uploadsDir });

app.get('/api/backup', (req, res) => {
  const dbPath = path.join(__dirname, '../prisma/dev.db');
  if (fs.existsSync(dbPath)) {
    res.download(dbPath, 'cher_backup.db');
  } else {
    res.status(404).json({ error: 'Database file not found' });
  }
});

app.post('/api/restore', upload.single('backup'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const dbPath = path.join(__dirname, '../prisma/dev.db');
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  const backupPath = req.file.path;

  try {
    // Close prisma connection before replacing the file
    await prisma.$disconnect();

    // Delete WAL and SHM files if they exist to prevent corruption
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // Copy uploaded file to dev.db
    fs.copyFileSync(backupPath, dbPath);

    // Delete temporary upload
    fs.unlinkSync(backupPath);

    // Re-initialize prisma
    prisma = new PrismaClient();

    res.json({ success: true });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// Fallback to index.html for SPA
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
