const { exec } = require('child_process');
const winston = require('winston');
const cron = require('node-cron');
const fs = require('fs');
require('dotenv').config()

const sourceDbString = process.env.DATABASE_URL_SOURCE;
const targetDbString = process.env.DATABASE_URL_TARGET;
const backupFile = `${new Date().toISOString()}.sql`;

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'backup.log' }),
        new winston.transports.Console({
            level: 'debug',
            format: winston.format.simple()
        }),
    ],
});

// Backup source database
const backup = () => {
    if (!fs.existsSync(backupFile)) {
        logger.info(`Backup is being created at ${backupFile}`);
        exec(`pg_dump --dbname=${sourceDbString} --format=c -f ${backupFile}`, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Error creating backup: ${error}`);
                return;
            }
            logger.info(`Backup created at ${backupFile}`);
            createTempDb();
        });
    } else {
        logger.info(`Using existing backup at ${backupFile}`);
        createTempDb();
    }
};

// Create temporary database
const tempDbString = `${targetDbString}_temp`;
const tempDbUrl = new URL(tempDbString);
const createTempDb = () => {
    logger.info(`Temporary database ${tempDbString} is being created`);
    exec(`createdb -h ${tempDbUrl.hostname} -p ${tempDbUrl.port} -U ${tempDbUrl.username} -T template0 ${tempDbUrl.pathname.substring(1)} -O ${tempDbUrl.username}`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Error creating temporary database: ${error}`);
            return;
        }
        logger.info(`Temporary database ${tempDbString} created`);
        restoreDb();
    });
};

// Restore to temporary database
const restoreDb = () => {
    logger.info(`Temporary database ${tempDbString} is being restored`);
    exec(`pg_restore --dbname=${tempDbString} --format=c ${backupFile}`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Error restoring database: ${error}`);
            return;
        }
        logger.info(`Temporary database ${tempDbString} restored`);
        renameDb();
    });
};

// Rename temporary database to target database
const renameDb = () => {
    logger.info(`Temporary database ${tempDbString} is being renamed to ${targetDbString}`);
    exec(`psql --dbname=${tempDbString} -c "ALTER DATABASE ${tempDbString} RENAME TO ${targetDbString};"`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Error renaming database: ${error}`);
            return;
        }
        logger.info(`Temporary database ${tempDbString} renamed to ${targetDbString}`);
        fs.unlink(backupFile, (err) => {
            if (err) {
                logger.error(`Error deleting backup file: ${err}`);
            } else {
                logger.info(`Backup file ${backupFile} deleted`);
            }
        });
    });
};

const retry = (fn, retriesLeft = 3, interval = 10000) => {
    try {
        fn();
    } catch (error) {
        if (retriesLeft === 0) {
            logger.error(`Retries exhausted, giving up: ${error}`);
            return;
        }
        logger.warn(`Retrying in ${interval}ms: ${error}`);
        setTimeout(() => retry(fn, retriesLeft - 1, interval), interval);
    };
};

cron.schedule(process.env.SCHEDULE_TIME, () => {
    if (process.env.FAILOVER_RETRIES && process.env.FAILOVER_RETRY_DELAY_MS) {
        retry(backup, process.env.FAILOVER_RETRIES, process.env.FAILOVER_RETRY_DELAY_MS);
    } else {
        retry(backup);
    }
}, {
    scheduled: true,
    timezone: process.env.SCHEDULE_TIMEZONE
});

if (process.env.RUN_ON_STARTUP === 'true') {
    if (process.env.FAILOVER_RETRIES && process.env.FAILOVER_RETRY_DELAY_MS) {
        retry(backup, process.env.FAILOVER_RETRIES, process.env.FAILOVER_RETRY_DELAY_MS);
    } else {
        retry(backup);
    }
}
