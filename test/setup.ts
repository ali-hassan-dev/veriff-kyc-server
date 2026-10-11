import axios from 'axios';
import { beforeEach } from 'vitest';
import { fakeVeriff } from './helpers/fake-veriff';
import { BASE_URL, KEY_PAIRS, VERSION } from './helpers/fixtures';

// The app reads these on import. dotenv never overrides variables that are already set,
// so a local .env with real keys is ignored while the tests run.
process.env.API_KEYS = JSON.stringify(KEY_PAIRS);
process.env.BASE_URL = BASE_URL;
process.env.VERSION = VERSION;

// Route every axios request, including instances that axios.create() makes later, to the fake Veriff API
axios.defaults.adapter = fakeVeriff.adapter;

beforeEach(() => {
  fakeVeriff.reset();
});
