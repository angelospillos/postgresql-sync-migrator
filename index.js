const { spawn } = require('child_process');
const fs = require('fs');
const cron = require('node-cron');
const winston = require('winston');

const { createLogger, format, transports } = winston;
const { combine, timestamp, printf } = format;
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

const retry = (fn, retriesLeft = 3, interval = 10000) => {
    while (retriesLeft) {
        try {
            fn();
            return;
        } catch (error) {
            logger.error(`Error: ${error}`);
            retriesLeft--;
            if (retriesLeft) {
                sendDiscordMessage(`Retrying in ${interval}ms: ${error}`);
                logger.warn(`Retrying in ${interval}ms: ${error}`);
                setTimeout(() => { }, interval);
            }
            if (retriesLeft === 0) {
                sendDiscordMessage(`Retries exhausted, giving up: ${error}`);
                logger.error(`Retries exhausted, giving up: ${error}`);
                return;
            }
        }
    }
};

const createBackup = () => {
    terminateProcess('pg_dump');
    sendDiscordMessage(`Source DB backup is being created`);
    logger.info(`Source DB backup is being created`);
    logger.debug(`Souece DB ${sourceDbString} backup is being created at ${backupFile}`);
    const pg_dump = spawn('pg_dump', ['--dbname=' + sourceDbString, '--clean', '--if-exists', '--no-owner', '--no-acl', '-f', backupFile]);
    pg_dump.stdout.on('data', (data) => {
        logger.info(`stdout: ${data}`);
    });

    pg_dump.stderr.on('data', (data) => {
        logger.error(`stderr: ${data}`);
    });

    pg_dump.on('close', (code) => {
        if (code === 0) {
            terminateProcess('pg_dump');
            logger.info(`Source DB backup created successfully`);
            logger.debug(`Source DB backup created at ${backupFile} successfully`);
            sendDiscordMessage(`Source DB backup created successfully`);
            restoreDb();
        } else {
            sendDiscordMessage(`Error creating Source DB backup`);
            throw new Error(`Error creating Source DB backup. Exit code: ${code}`);
        }
    });
};

const restoreDb = () => {
    terminateProcess('psql');
    sendDiscordMessage(`Target DB is being restored with Source DB backup`);
    logger.info(`Target DB is being restored with Source DB backup`);
    logger.debug(`Target DB ${targetDbString} is being restored with Source DB backup ${backupFile}`);
    const psql = spawn('psql', ['--dbname=' + targetDbString, '-f', backupFile]);
    psql.stdout.on('data', (data) => {
        logger.info(`stdout: ${data}`);
    });

    psql.stderr.on('data', (data) => {
        logger.error(`stderr: ${data}`);
    });

    psql.on('close', (code) => {
        if (code === 0) {
            terminateProcess('psql');
            logger.info(`Target DB restored with Source DB backup successfully`);
            logger.debug(`Target DB ${targetDbString} restored with Source DB backup ${backupFile} successfully`);
            sendDiscordMessage(`Target DB restored with Source DB backup successfully`);
            removeBackup();
        } else {
            sendDiscordMessage(`Error restoring to Target DB`);
            throw new Error(`Error restoring to Target DB. Exit code: ${code}`);
        }
    });
};

const removeBackup = () => {
    fs.unlink(backupFile, (err) => {
        if (err) {
            logger.error(`Error deleting backup file: ${err}`);
        } else {
            logger.info(`Backup file ${backupFile} deleted`);
        }
    });
};

const terminateProcess = (processName) => {
    logger.info(`Terminating ${processName}`);
    sendDiscordMessage(`Terminating ${processName}`);
    const pkill = spawn('pkill', ['-f', processName]);
    pkill.on('close', (code) => {
        if (code === 0) {
            sendDiscordMessage(`${processName} terminated`);
            logger.info(`${processName} terminated`);
        } else {
            sendDiscordMessage(`Error terminating ${processName}`);
            logger.error(`Error terminating ${processName}`);
        }
    });
};

const run = () => {
    if (process.env.FAILOVER_RETRIES && process.env.FAILOVER_RETRY_DELAY_MS) {
        senddiscordMessage(`Retrying ${process.env.FAILOVER_RETRIES} times with ${process.env.FAILOVER_RETRY_DELAY_MS}ms delay`)
        logger.info(`Retrying ${process.env.FAILOVER_RETRIES} times with ${process.env.FAILOVER_RETRY_DELAY_MS}ms delay`);
        retry(createBackup, process.env.FAILOVER_RETRIES, process.env.FAILOVER_RETRY_DELAY_MS);
    } else {
        sendDiscordMessage(`Retrying 3 times with 10000ms delay`)
        logger.info(`Retrying 3 times with 10000ms delay`);
        retry(createBackup);
    }
};

cron.schedule(process.env.SCHEDULE_TIME, () => {
    logger.info(`Running scheduled job`);
    sendDiscordMessage(`Running scheduled job`);
    run();
}, {
    scheduled: true,
    timezone: process.env.SCHEDULE_TIMEZONE
});

if (process.env.RUN_ON_STARTUP === 'true') {
    logger.info(`Running on startup`);
    sendDiscordMessage(`Running on startup`);
    run();
}

const express = require('express');
const { default: sendDiscordMessage } = require('./lib/sendDiscordMessage');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Up and running')
})

app.listen(port, () => {
    logger.info(`PostgreSQL Sync Migrator listening on port ${port}`);
})
