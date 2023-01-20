const winston = require('winston');

const createLogger = () => {
    const { createLogger, format, transports } = winston;
    const { combine, timestamp, printf } = format;
    const myFormat = printf(({ level, message, timestamp }) => {
        return `${timestamp} ${level}: ${message}`;
    });

    return createLogger({
        format: combine(
            timestamp(),
            myFormat
        ),
        level: process.env.LOGGER_LEVEL || 'info',
        transports: [new transports.Console()]
    });
}

module.exports = {
    createLogger: createLogger,
};
