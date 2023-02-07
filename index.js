const { spawn } = require('child_process');
const fs = require('fs');
const cron = require('node-cron');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const { sendDiscordMessage } = require('./lib/discord');
const { isProcessRunning } = require('./lib/process');
const { createLogger } = require('./lib/logger');
const logger = createLogger();
require('dotenv').config();

app.get('/', (req, res) => {
    res.send('Up and running')
})

app.listen(port, () => {
    logger.info(`PostgreSQL Sync Migrator listening on port ${port}`);
})

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
    logger.debug(`Source DB ${sourceDbString} backup is being created at ${backupFile}`);
    const pg_dump = spawn('pg_dump', ['--dbname=' + sourceDbString, '--clean', '--if-exists', '--no-owner', '--no-acl', '-f', backupFile]);
    pg_dump.stdout.on('data', (data) => {
        logger.debug(`Source DB backup stdout: ${data}`);
    });

    pg_dump.stderr.on('data', (data) => {
        logger.error(`Source DB backup stderr: ${data}`);
    });

    pg_dump.on('exit', (code) => {
        if (code === 0) {
            logger.info('Process pg_dump terminated successfully');
            restoreDb();
        } else {
            logger.info('Process pg_dump terminated with code', code);
        }
    });

    pg_dump.on('close', (code) => {
        if (code === 0) {
            logger.info(`Source DB backup created successfully`);
            logger.debug(`Source DB backup created at ${backupFile} successfully`);
            sendDiscordMessage(`Source DB backup created successfully`);
        } else {
            sendDiscordMessage(`Error creating Source DB backup`);
            throw new Error(`Error creating Source DB backup. Exit code: ${code}`);
        }
        terminateProcess('pg_dump');
        pg_dump.kill();
    });
};

const restoreDb = () => {
    terminateProcess('psql');
    sendDiscordMessage(`Target DB is being restored with Source DB backup`);
    logger.info(`Target DB is being restored with Source DB backup`);
    logger.debug(`Target DB ${targetDbString} is being restored with Source DB backup ${backupFile}`);
    const psql = spawn('psql', ['--dbname=' + targetDbString, '-f', backupFile]);
    psql.stdout.on('data', (data) => {
        logger.debug(`Target DB restore stdout: ${data}`);
    });

    psql.stderr.on('data', (data) => {
        logger.error(`Target DB restore stderr: ${data}`);
    });

    psql.on('exit', (code) => {
        if (code === 0) {
            logger.info('Process psql terminated successfully');
            removeBackup();
        } else {
            logger.info('Process psql terminated with code', code);
        }
    });

    psql.on('close', (code) => {
        if (code === 0) {
            logger.info(`Target DB restored with Source DB backup successfully`);
            logger.debug(`Target DB ${targetDbString} restored with Source DB backup ${backupFile} successfully`);
            sendDiscordMessage(`Target DB restored with Source DB backup successfully`);
        } else {
            sendDiscordMessage(`Error restoring to Target DB`);
            throw new Error(`Error restoring to Target DB. Exit code: ${code}`);
        }
        psql.kill();
        terminateProcess('psql');
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

const terminateProcess = async (processName) => {

    if (!isProcessRunning(processName)) {
        logger.info(`${processName} is not running, will not terminate`);
    }

    logger.info(`Terminating process ${processName}`);
    const pkill = spawn('pkill', ['-f', processName]);
    pkill.stdout.on('data', (data) => {
        logger.info(`Terminating process stdout ${data}`);
    });

    pkill.stderr.on('data', (data) => {
        logger.error(`Terminating process stderr ${data}`);
    });

    pkill.on('close', (code) => {
        if (code === 0) {
            logger.info(`${processName} process terminated`);
        } else {
            logger.error(`Error terminating process ${processName}`);
        }
    });
};

const run = () => {
    if (process.env.FAILOVER_RETRIES && process.env.FAILOVER_RETRY_DELAY_MS) {
        sendDiscordMessage(`Going to retry ${process.env.FAILOVER_RETRIES} times with ${process.env.FAILOVER_RETRY_DELAY_MS}ms delay`)
        logger.info(`Going to retry ${process.env.FAILOVER_RETRIES} times with ${process.env.FAILOVER_RETRY_DELAY_MS}ms delay`);
        retry(createBackup, process.env.FAILOVER_RETRIES, process.env.FAILOVER_RETRY_DELAY_MS);
    } else {
        sendDiscordMessage(`Going to retry 3 times with 10000ms delay`)
        logger.info(`Going to retry 3 times with 10000ms delay`);
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
