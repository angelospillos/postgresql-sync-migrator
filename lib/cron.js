const { DateTime } = require('luxon');
const { createLogger } = require('./logger');
const logger = createLogger();

/**
 * Parses a name or short name for a month or day of the week, returning the numeric index.
 * @param {string} value - The name or short name to parse.
 * @param {string[]} values - The array of full names for the month or day of the week.
 * @returns {number|null} - The numeric index of the name or short name, or null if not found.
 */
function parseNameOrShortName(value, values) {
    const index = values.indexOf(value);
    if (index !== -1) return index + 1;
    const shortNames = values.map(value => value.slice(0, 3).toLowerCase());
    const shortIndex = shortNames.indexOf(value.toLowerCase());
    if (shortIndex !== -1) return shortIndex + 1;
    return null;
}

/**
 * Parses a month value.
 * @param {string} value - The month value to parse.
 * @returns {number|null} - The numeric index of the month, or null if not found.
 */
function parseMonth(value) {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    return parseNameOrShortName(value, months);
}

/**
 * Parses a day of the week value.
 * @param {string} value - The day of the week value to parse.
 * @returns {number|null} - The numeric index of the day of the week, or null if not found.
 */
function parseDayOfWeek(value) {
    const daysOfWeek = [
        "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ];
    return parseNameOrShortName(value, daysOfWeek);
}

/**
 * Parses a range of values.
 * @param {string} range - The range string, in the format "min-max".
 * @param {number} stepValue - The step value for the range.
 * @param {number} currentValue - The current value to check against the range.
 * @returns {boolean} - Whether the current value is within the range.
 */
function parseRange(range, stepValue, currentValue) {
    const [min, max] = range.split('-').map(Number);
    for (let i = min; i <= max; i += stepValue) {
        if (i === currentValue) return true;
    }
    return false;
}

/**
* Parses a list of values and/or ranges, with optional step values.
* @param {string[]} values - The array of values and/or ranges to parse.
* @param {number} stepValue - The step value for the values.
* @param {number} currentValue - The current value to check against the values.
* @returns {boolean} - Whether the current value matches any of the values or ranges.
*/
function parseValues(values, stepValue, currentValue) {
    for (const value of values) {
        if (value === '*') return true;
        if (value.includes('/')) {
            const [range, step] = value.split('/');
            const stepValue = step ? parseInt(step) : 1;
            if (parseRange(range, stepValue, currentValue)) return true;
        } else if (value.includes('-')) {
            const [min, max] = value.split('-').map(Number);
            if (currentValue >= min && currentValue <= max) {
                const rangeValues = Array.from({ length: max - min + 1 }, (_, i) => min + i);
                if (stepValue > 1) {
                    const stepValues = rangeValues.filter(value => value % stepValue === min % stepValue);
                    if (stepValues.includes(currentValue)) return true;
                } else {
                    if (rangeValues.includes(currentValue)) return true;
                }
            }
        } else {
            const numberValue = parseInt(value);
            if (currentValue === numberValue) return true;
        }
    }
    return false;
}

/**
 * Parse a cron-like schedule and determine whether the current date and time
 * matches the schedule.
 *
 * @param {string} schedule The cron-like schedule string.
 * @param {DateTime} now The current date and time as a Luxon DateTime object.
 * @returns {boolean} True if the current date and time matches the schedule, false otherwise.
 */
function parseSchedule(schedule, now) {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = schedule.split(' ');

    const matchMinute = parseValues(minute.split(','), 1, now.minute);
    if (!matchMinute) return false;

    const matchHour = parseValues(hour.split(','), 1, now.hour);
    if (!matchHour) return false;

    const matchDayOfMonth = parseValues(dayOfMonth.split(','), 1, now.day);
    if (!matchDayOfMonth) return false;

    const matchMonth = parseValues(month.split(','), 1, now.month);
    if (!matchMonth) return false;

    let matchDayOfWeek = parseValues(dayOfWeek.split(','), 1, now.weekday);
    if (!matchDayOfWeek) {
        const dayOfWeekValues = dayOfWeek.split('-');
        if (dayOfWeekValues.length > 1) {
            const [min, max] = dayOfWeekValues.map(value => parseDayOfWeek(value));
            if (now.weekday >= min && now.weekday <= max) {
                const rangeValues = Array.from({ length: max - min + 1 }, (_, i) => min + i);
                if (rangeValues.includes(now.weekday)) matchDayOfWeek = true;
            }
        } else {
            const matchDayOfWeekValues = parseValues(dayOfWeek.split(','), 1, now.weekday);
            if (matchDayOfWeekValues) matchDayOfWeek = true;
        }
    }
    return matchDayOfWeek;
}

function cronJob(schedule, timeZone, fn) {
    const now = DateTime.now().setZone(timeZone);
    const match = parseSchedule(schedule, now);
    if (match) {
        try {
            fn();
            console.log(`Cron job executed function at ${now.toISO()}`);
        } catch (error) {
            console.error(`Cron job failed to execute function at ${now.toISO()}:`, error);
        }
    }
}

function startCronJob(schedule, timeZone, fn, interval) {

    logger.info(`Starting cron job with schedule "${schedule}"`);
    logger.info(`Cron job will check schedule every ${interval}ms`);

    setInterval(() => {
        const now = DateTime.now().setZone(timeZone);
        const match = parseSchedule(schedule, now);
        if (match) {
            try {
                fn();
                logger.info(`Cron job executed function at ${now.toISO()}`);
            } catch (error) {
                logger.error(`Cron job failed to execute function at ${now.toISO()}:`, error);
            }
        }
    }, interval);
}

module.exports = {
    startCronJob
};
