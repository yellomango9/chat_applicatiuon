// Simple Logger utility for demonstration
export default class Logger {
  static info(...args: any[]) {
    console.log('[INFO]', ...args);
  }
  static error(...args: any[]) {
    console.error('[ERROR]', ...args);
  }
  static warn(...args: any[]) {
    console.warn('[WARN]', ...args);
  }
}
