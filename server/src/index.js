import 'dotenv/config';
import { createApp } from './app.js';
import { startWhatsApp } from './whatsapp/client.js';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`FinançasAI API rodando em http://localhost:${PORT}`);
});

// Reconnects automatically if a paired session already exists on the persistent volume;
// otherwise stays idle until an admin starts pairing from the WhatsApp panel.
startWhatsApp().catch((err) => console.error('[whatsapp] Falha ao iniciar:', err.message));
