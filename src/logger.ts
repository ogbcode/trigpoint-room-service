import pino from 'pino';
import { DEFAULT_LOG_LEVEL } from './constants.js';

export const logger = pino({ level: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL });
