const { exec } = require('child_process');
const fs = require('fs');
const cron = require('node-cron');
const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, label, printf } = format;
const myFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

const logger = createLogger({
    format: combine(
        timestamp(),
        myFormat
    ),
    level: process.env.LOGGER_LEVEL || 'info',
    transports: [new transports.Console()]
});

require('dotenv').config();

const sourceDbString = process.env.DATABASE_URL_SOURCE;
const targetDbString = process.env.DATABASE_URL_TARGET;
const backupFile = `${new Date().toISOString()}.sql`;

const retry = (fn, retriesLeft = 5, interval = 1000) => {
    while (retriesLeft) {
        try {
            fn();
            return;
        } catch (error) {
            logger.error(`Error: ${error}`);
            retriesLeft--;
            if (retriesLeft) {
                logger.warn(`Retrying in ${interval}ms: ${error}`);
                setTimeout(() => { }, interval);
            }
            if (retriesLeft === 0) {
                logger.error(`Retries exhausted, giving up: ${error}`);
                return;
            }
        }
    }
};

const createBackup = () => {
    logger.info(`Source DB backup is being created`);
    logger.debug(`Souece DB ${sourceDbString} backup is being created at ${backupFile}`);
    exec(`pg_dump --dbname=${sourceDbString} --clean --if-exists --no-owner --no-acl -f ${backupFile}`, { maxBuffer: 1024 * 500000 }, (error, stdout, stderr) => {
        if (error) {
            throw new Error(`Error creating backup: ${error}`);
        }
        logger.info(`Backup created at ${backupFile}`);
        restoreDb();
    });
};

const restoreDb = () => {
    logger.info(`Target DB is being restored with backup`);
    logger.debug(`Target DB ${targetDbString} is being restored with backup ${backupFile}`);
    exec(`psql --dbname=${targetDbString} -f ${backupFile}`, { maxBuffer: 1024 * 500000 }, (error, stdout, stderr) => {
        if (error) {
            throw new Error(`Error restoring database: ${error}`);
        }
        logger.info(`Database ${targetDbString} restored`);
        removeBackup();
    });
};

const removeBackup = () => {
    logger.info(`Backup is being deleted from server`);
    logger.debug(`Backup ${backupFile} is being deleted from server`);
    fs.unlink(backupFile, (err) => {
        if (err) {
            throw new Error(`Error deleting backup file: ${error}`);
        } else {
            logger.info(`Backup file deleted from server`);
            logger.debug(`Backup file ${backupFile} deleted from server: ${backupFile}`);
        }
    });
};

const run = () => {
    if (process.env.FAILOVER_RETRIES && process.env.FAILOVER_RETRY_DELAY_MS) {
        retry(createBackup, process.env.FAILOVER_RETRIES, process.env.FAILOVER_RETRY_DELAY_MS);
    } else {
        retry(createBackup);
    }
};

cron.schedule(process.env.SCHEDULE_TIME, () => {
    run();
}, {
    scheduled: true,
    timezone: process.env.SCHEDULE_TIMEZONE
});

if (process.env.RUN_ON_STARTUP === 'true') {
    run();
}

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Up and running')
})

app.listen(port, () => {
    logger.info(`PostgreSQL Sync Migrator listening on port ${port}`);
})
