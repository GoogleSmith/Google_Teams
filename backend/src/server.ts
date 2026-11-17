import { createApiApp } from './app.ts';

const port = Number(process.env.PORT) || 4000;
const app = createApiApp();

app.listen(port, '0.0.0.0', () => {
  console.log(`NovaWorks CRM backend listening on http://localhost:${port}`);
});
