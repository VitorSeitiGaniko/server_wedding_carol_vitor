import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference } from 'mercadopago';

dotenv.config();

const app = express();

app.use(express.json());

const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL].filter(
  Boolean,
) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (como rotas server-to-server, cURL ou Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS não permitido para esta origem'));
    },
    credentials: true,
  }),
);

app.get('/api/health', (req, res) => {
  console.log('Healthcheck endpoint called');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/create-preference', async (req, res) => {
  console.log('Create preference endpoint called');
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Nenhum item válido foi fornecido' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('MP_ACCESS_TOKEN não configurado nas variáveis de ambiente.');
    return res
      .status(500)
      .json({ error: 'Configuração do servidor incompleta (token Mercado Pago ausente)' });
  }

  try {
    const client = new MercadoPagoConfig({ accessToken });

    // Obtém a URL do frontend
    let frontendUrl = process.env.FRONTEND_URL || (req.headers.origin as string) || 'http://localhost:5173';

    if (!frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
      frontendUrl = `https://${frontendUrl}`;
    }

    frontendUrl = frontendUrl.replace(/\/$/, '');

    // Mercado Pago exige obrigatoriamente auto_return: 'approved' e que back_urls.success seja uma URL HTTPS pública.
    // Se estiver chamando do localhost em desenvolvimento, usamos um fallback HTTPS para a validação da API do Mercado Pago passar.
    const isLocalhost = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');
    const publicFrontendUrl = isLocalhost
      ? process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost')
        ? process.env.FRONTEND_URL
        : 'https://wedding-carol-vitor.vercel.app'
      : frontendUrl;

    const successUrl = `${publicFrontendUrl}/sucesso`;
    const failureUrl = `${publicFrontendUrl}/falha`;
    const pendingUrl = `${publicFrontendUrl}/pendente`;

    console.log('FRONTEND_URL detectada:', frontendUrl);
    console.log('URLs de retorno enviadas ao Mercado Pago:', { successUrl, failureUrl, pendingUrl });

    const preference = await new Preference(client).create({
      body: {
        items,
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        auto_return: 'approved',
      },
    });

    return res.json({
      id: preference.id,
      initPoint: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    });
  } catch (error) {
    console.error('Erro ao criar preferência Mercado Pago:', error);
    return res.status(500).json({ error: 'Erro ao processar pagamento com Mercado Pago' });
  }
});

export default app;

// Executa app.listen apenas em ambiente local (fora da Vercel)
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server rodando em http://localhost:${PORT}`);
  });
}
