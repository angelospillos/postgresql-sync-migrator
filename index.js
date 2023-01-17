const { exec } = require('child_process');
const winston = require('winston');
require('dotenv').config()

const sourceDbString = process.env.DATABASE_URL_SOURCE;
const targetDbString = process.env.DATABASE_URL_TARGET;
const backupFile = `${sourceDbName}_${new Date().toISOString()}.sql`;

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
        exec(`pg_dump --dbname=${sourceDbString} -f ${backupFile}`, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Error creating backup: ${error}`);
                return;
            }
            logger.info(`Backup created at ${backupFile}`);
            dropAndRestore();
        });
    } else {
        logger.info(`Using existing backup at ${backupFile}`);
        dropAndRestore();
    }
};

// Drop target database
const dropAndRestore = () => {
    exec(`dropdb --dbname=${targetDbString}`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Error dropping database: ${error}`);
            return;
        }
        logger.info(`Target database ${targetDbString} dropped`);
        createAndRestore();
    });
};

// Create and restore target database
const createAndRestore = () => {
    exec(`createdb --dbname=${targetDbString} && psql --dbname=${targetDbString} < ${backupFile}`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Error restoring database: ${error}`);
            return;
        }
        logger.info(`Target database ${targetDbString} restored`);
        fs.unlink(backupFile, (err) => {
            if (err) {
                logger.error(`Error deleting backup file: ${err}`);
            } else {
                logger.info(`Backup file ${backupFile} deleted`);
            }
        });
    });
};

const retry = (fn, retriesLeft = 5, interval = 10000) => {
    fn()
        .catch(error => {
            if (retriesLeft === 0) {
                logger.error(`Retries exhausted, giving up: ${error}`);
                return;
            }
            logger.warn(`Retrying in ${interval}ms: ${error}`);
            setTimeout(() => retry(fn, retriesLeft - 1, interval), interval);
        });
};

cron.schedule(process.env.SCHEDULE_TIME, () => {
    retry(backup, process.env.FAILOVER_RETRIES, process.env.FAILOVER_RETRY_DELAY_MS);
}, {
    scheduled: true,
    timezone: process.env.SCHEDULE_TIMEZONE
});

if (process.env.RUN_ON_STARTUP === 'true') {
    retry(backup, process.env.FAILOVER_RETRIES, process.env.FAILOVER_RETRY_DELAY_MS);
}
