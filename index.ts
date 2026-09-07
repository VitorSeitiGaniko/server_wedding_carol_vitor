import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference } from 'mercadopago';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' })); // URL do Vite em dev

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN ?? '',
});

app.post('/api/create-preference', async (req, res) => {
  const { items } = req.body; // itens enviados pelo frontend
  console.log('items recebidos:', JSON.stringify(items));

  try {
    const preference = await new Preference(client).create({
      body: {
        items,
        back_urls: {
          success: 'http://localhost:5173/sucesso',
          failure: 'http://localhost:5173/falha',
        },
      },
    });

    res.json({
      id: preference.id,
      initPoint: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar preferência' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server rodando em http://0.0.0.0:${PORT}`));
