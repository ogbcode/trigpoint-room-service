import { DEFAULT_PORT, PAYSTACK_TEST_KEY_PREFIX } from './constants.js';
import { required } from './env.js';

const paystackSecretKey = required('PAYSTACK_SECRET_KEY');
if (!paystackSecretKey.startsWith(PAYSTACK_TEST_KEY_PREFIX)) {
  throw new Error('PAYSTACK_SECRET_KEY must be a Paystack test key');
}

export const config = {
  port: Number(process.env.PORT || DEFAULT_PORT),
  serverUrl: required('SERVER_URL').replace(/\/$/, ''),
  databaseUrl: required('DATABASE_URL'),
  chordToolsToken: required('CHORD_TOOLS_TOKEN'),
  boardPassword: required('BOARD_PASSWORD'),
  paystackSecretKey,
};
