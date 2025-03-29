// Enhanced error logging module for server-side implementation
// Provides detailed error tracking, formatting, and reporting

const fs = require('fs');
const path = require('path');
const util = require('util');

class ErrorLogger {
  constructor(options = {}) {
    this.logDirectory = options.logDirectory || path.join(process.cwd(), 'logs');
    this.logToConsole = options.logToConsole !== false;
    this.logToFile = options.logToFile !== false;
    this.logLevel = options.logLevel || 'info'; // debug, info, warn, error
    this.maxLogSize = options.maxLogSize || 5 * 1024 * 1024; // 5MB
    this.maxLogFiles = options.maxLogFiles || 5;
    this.logFilename = options.logFilename || 'chatty-server.log';
    
    // Create log directory if it doesn't exist
    if (this.logToFile && !fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
    
    // Initialize log file
    this.currentLogFile = path.join(this.logDirectory, this.logFilename);
    
    // Log levels
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    // Initialize
    this.init();
  }
  
  // Initialize logger
  init() {
    console.log(`Initializing ErrorLogger with log level: ${this.logLevel}`);
    
    // Override console methods to add our logging
    if (this.logToConsole) {
      const originalConsoleLog = console.log;
      const originalConsoleInfo = console.info;
      const originalConsoleWarn = console.warn;
      const originalConsoleError = console.error;
      
      console.log = (...args) => {
        this.debug(...args);
        originalConsoleLog.apply(console, args);
      };
      
      console.info = (...args) => {
        this.info(...args);
        originalConsoleInfo.apply(console, args);
      };
      
      console.warn = (...args) => {
        this.warn(...args);
        originalConsoleWarn.apply(console, args);
      };
      
      console.error = (...args) => {
        this.error(...args);
        originalConsoleError.apply(console, args);
      };
    }
    
    // Log initialization
    this.info('ErrorLogger initialized');
  }
  
  // Format log message
  formatLogMessage(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        return util.inspect(arg, { depth: null, colors: false });
      }
      return String(arg);
    }).join(' ');
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }
  
  // Write to log file
  writeToLogFile(message) {
    if (!this.logToFile) return;
    
    try {
      // Check if log file exists
      const fileExists = fs.existsSync(this.currentLogFile);
      
      // Check log file size
      if (fileExists) {
        const stats = fs.statSync(this.currentLogFile);
        
        // Rotate log if it exceeds max size
        if (stats.size >= this.maxLogSize) {
          this.rotateLogFiles();
        }
      }
      
      // Append to log file
      fs.appendFileSync(this.currentLogFile, message + '\n');
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }
  
  // Rotate log files
  rotateLogFiles() {
    try {
      // Rename existing log files
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = path.join(this.logDirectory, `${this.logFilename}.${i}`);
        const newFile = path.join(this.logDirectory, `${this.logFilename}.${i + 1}`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            // Delete oldest log file
            fs.unlinkSync(oldFile);
          } else {
            // Rename log file
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // Rename current log file
      const newFile = path.join(this.logDirectory, `${this.logFilename}.1`);
      fs.renameSync(this.currentLogFile, newFile);
    } catch (error) {
      console.error('Error rotating log files:', error);
    }
  }
  
  // Log methods
  debug(...args) {
    if (this.levels[this.logLevel] <= this.levels.debug) {
      const message = this.formatLogMessage('debug', args);
      this.writeToLogFile(message);
    }
  }
  
  info(...args) {
    if (this.levels[this.logLevel] <= this.levels.info) {
      const message = this.formatLogMessage('info', args);
      this.writeToLogFile(message);
    }
  }
  
  warn(...args) {
    if (this.levels[this.logLevel] <= this.levels.warn) {
      const message = this.formatLogMessage('warn', args);
      this.writeToLogFile(message);
    }
  }
  
  error(...args) {
    if (this.levels[this.logLevel] <= this.levels.error) {
      const message = this.formatLogMessage('error', args);
      this.writeToLogFile(message);
    }
  }
  
  // Log error with stack trace and additional details
  logError(error, context = {}) {
    if (!error) return;
    
    const errorDetails = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: error.code,
      context: context
    };
    
    this.error('Error occurred:', errorDetails);
    
    return errorDetails;
  }
  
  // Log API request
  logApiRequest(req, context = {}) {
    const requestDetails = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      context: context
    };
    
    this.info('API Request:', requestDetails);
    
    return requestDetails;
  }
  
  // Log API response
  logApiResponse(res, responseBody, context = {}) {
    const responseDetails = {
      statusCode: res.statusCode,
      headers: res.getHeaders(),
      body: responseBody,
      timestamp: new Date().toISOString(),
      context: context
    };
    
    this.info('API Response:', responseDetails);
    
    return responseDetails;
  }
  
  // Log socket event
  logSocketEvent(eventName, data, context = {}) {
    const eventDetails = {
      event: eventName,
      data: data,
      timestamp: new Date().toISOString(),
      context: context
    };
    
    this.info('Socket Event:', eventDetails);
    
    return eventDetails;
  }
  
  // Log session activity
  logSessionActivity(sessionId, activity, data = {}, context = {}) {
    const activityDetails = {
      sessionId: sessionId,
      activity: activity,
      data: data,
      timestamp: new Date().toISOString(),
      context: context
    };
    
    this.info('Session Activity:', activityDetails);
    
    return activityDetails;
  }
  
  // Log performance metrics
  logPerformance(operation, duration, metadata = {}) {
    const performanceDetails = {
      operation: operation,
      duration: duration,
      timestamp: new Date().toISOString(),
      metadata: metadata
    };
    
    this.info('Performance Metric:', performanceDetails);
    
    return performanceDetails;
  }
}

module.exports = ErrorLogger;
