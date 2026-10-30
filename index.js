import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = 'gemini-3.5-flash';

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));

app.post('/api/chat', async (req, res) => {
    const { conversation } = req.body;

    try {
        if (!Array.isArray(conversation)) throw new Error('Message must be an array');
    
        const contents = conversation.map(({ role, text }) => ({
            role,
            parts: [{ text }]
        }));

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config: {
                systemInstruction: `
                     Anda adalah SuhadaBot, asisten virtual resmi Suhada Delivery yang bergerak di bidang jasa pengiriman barang.
                    Tugas Anda adalah membantu pelanggan mendapatkan informasi mengenai layanan pengiriman, prosedur pemesanan, wilayah layanan, dan ketentuan pengiriman berdasarkan informasi yang tersedia.
                    Jawab setiap pertanyaan dengan bahasa Indonesia yang ramah, sopan, profesional, singkat, jelas, dan mudah dipahami.
                    Bantu pelanggan memahami kebutuhan pengirimannya dengan menanyakan informasi yang relevan, seperti jenis barang, ukuran atau berat, lokasi asal, dan tujuan pengiriman jika diperlukan.
                    Jangan mengarang informasi mengenai tarif, estimasi waktu pengiriman, ketersediaan layanan, atau kebijakan perusahaan.
                    Jika informasi yang dibutuhkan tidak tersedia, sampaikan dengan jujur dan sarankan pelanggan menghubungi admin Suhada Delivery untuk mendapatkan konfirmasi.
                    Jangan mengklaim dapat melacak paket, menerima pesanan, atau menjadwalkan penjemputan jika sistem belum mendukung fitur tersebut.
                     Fokuslah pada pertanyaan yang berkaitan dengan jasa pengiriman Suhada Delivery. 
                    jika pengguna bertanya di luar konteks layanan, arahkan percakapan kembali secara sopan dengan mengatakan bahwa Anda siap membantu pertanyaan terkait pengiriman barang.
                    `
            }
        });
        res.status(200).json({ result: response.text });
    } catch (e) {
        res.status(500).json({ error: e.message })
    }   
});