// Import necessary modules (if needed)
import { format } from 'date-fns';

// Define log levels
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// Define your logger
const logger = {
  debug: (message: string, ...args: any[]) => log(LogLevel.DEBUG, message, ...args),
  info: (message: string, ...args: any[]) => log(LogLevel.INFO, message, ...args),
  warn: (message: string, ...args: any[]) => log(LogLevel.WARN, message, ...args),
  error: (message: string, ...args: any[]) => log(LogLevel.ERROR, message, ...args),
};

// Helper function to format and log messages
function log(level: LogLevel, message: string, ...args: any[]) {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const formattedMessage = `[${timestamp}] [${level}] ${message}`;
  
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formattedMessage, ...args);
      break;
    case LogLevel.INFO:
      console.info(formattedMessage, ...args);
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage, ...args);
      break;
    case LogLevel.ERROR:
      console.error(formattedMessage, ...args);
      break;
  }
}

// Export the logger
export { logger };