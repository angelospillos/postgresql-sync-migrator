const util = require('util');
const exec = util.promisify(require('child_process').exec);
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

const createBackup = async () => {
    logger.info(`Source DB backup is being created`);
    logger.debug(`Souece DB ${sourceDbString} backup is being created at ${backupFile}`);
    try {
        const { stdout, stderr } = await exec(`pg_dump --dbname=${sourceDbString} --clean --if-exists --no-owner --no-acl -f ${backupFile}`, { maxBuffer: 1024 * 500000 });
        logger.info('Source DB backup stdout:', stdout);
        logger.info('Source DB backup stderr:', stderr);
        logger.info(`Source DB backup created successfully`);
        logger.debug(`Source DB backup created at ${backupFile} successfully`);
        await restoreDb();
    } catch (error) {
        // should contain code (exit code) and signal (that caused the termination)
        throw new Error(`Error creating Source DB backup: ${error}`);
    }
};

const restoreDb = async () => {
    logger.info(`Target DB is being restored with Source DB backup`);
    logger.debug(`Target DB ${targetDbString} is being restored with Source DB backup ${backupFile}`);
    try {
        const { stdout, stderr } = await exec(`psql --dbname=${targetDbString} -f ${backupFile}`, { maxBuffer: 1024 * 500000 });
        logger.info('Target DB backup stdout:', stdout);
        logger.info('Target DB backup stderr:', stderr);
        logger.info(`Target DB restored with Source DB backup successfully`);
        logger.debug(`Target DB ${targetDbString} restored with Source DB backup ${backupFile} successfully`);
        await removeBackup();
    } catch (error) {
        // should contain code (exit code) and signal (that caused the termination)
        throw new Error(`Error restoring to Target DB: ${error}`);
    }
};

const removeBackup = () => {
    logger.info(`Source DB backup is being deleted from server`);
    logger.debug(`Source DB backup ${backupFile} is being deleted from server`);
    fs.unlink(backupFile, (err) => {
        if (err) {
            throw new Error(`Error deleting backup file: ${error}`);
        } else {
            logger.info(`Source DB backup file deleted from server successfully`);
            logger.debug(`Source DB backup file ${backupFile} deleted from server successfully`);
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
