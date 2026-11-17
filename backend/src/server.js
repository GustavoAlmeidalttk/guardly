import 'dotenv/config';
import { app } from './app.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => console.log(`API disponível em http://${host}:${port}`));

process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
