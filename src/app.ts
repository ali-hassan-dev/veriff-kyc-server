import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import VeriffAPI from './services/VeriffAPI';
import DecisionEvents from './services/DecisionEvents';
import VerificationEvents from './services/VerificationEvents';
import ProofOfAddress from './services/ProofOfAddress';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const { VERSION, BASE_URL, API_KEYS } = process.env;
if (!API_KEYS) throw new Error('API keys not found');
if (!BASE_URL) throw new Error('API version not found');
if (!VERSION) throw new Error('API version not found');
const veriffAPI = new VeriffAPI(JSON.parse(API_KEYS), BASE_URL);
app.use(bodyParser.json());

app.post('/webhooks/decision', async (req: Request, res: Response) => {
  const payload = req.body;
  const signature = req.get('x-hmac-signature');

  if (!signature) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate received signature
  const isValid = veriffAPI.isSignatureValid({
    signature,
    payload,
  });

  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const handler = await DecisionEvents.new();
  await handler.handleWebhook(payload, res);
  return res.status(200).send();
});

app.post('/webhooks/verification-event', async (req, res) => {
  const payload = req.body;
  const signature = req.get('x-hmac-signature');

  if (!signature) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate received signature
  const isValid = veriffAPI.isSignatureValid({
    signature,
    payload,
  });

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const handler = await VerificationEvents.new();
  await handler.handleWebhook(payload, res);
  return res.status(200).send();
});

app.post('/webhooks/proof-of-address', async (req, res) => {
  const payload = req.body;
  const signature = req.get('x-hmac-signature');

  if (!signature) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate received signature
  const isValid = veriffAPI.isSignatureValid({
    signature,
    payload,
  });

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  const handler = await ProofOfAddress.new();
  await handler.handleWebhook(payload, res);
  return res.status(200).send();
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}).on('error', (error) => {
  throw new Error(error.message);
});