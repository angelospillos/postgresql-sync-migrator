const { execSync } = require('child_process');

const isProcessRunning = (processName) => {
    try {
        const result = execSync(`ps aux | grep ${processName} | grep -v grep`).toString();
        if (result.includes(processName)) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        logger.error(`Error checking ${processName}: ${error}`);
        return false;
    }
}

module.exports = {
    isProcessRunning: isProcessRunning,
};
