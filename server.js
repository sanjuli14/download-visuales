const express = require('express');
const axios = require('axios');
const archiver = require('archiver');
const path = require('path');
const cors = require('cors');
const cheerio = require('cheerio'); // Para raspar el HTML

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Servir el archivo HTML en la ruta raíz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint para recibir la URL y descargar los archivos
app.post('/download-url', async (req, res) => {
    const { folderUrl } = req.body;

    if (!folderUrl) {
        return res.status(400).json({ error: 'Se requiere una URL de carpeta' });
    }

    try {
        // Realiza la solicitud para obtener el HTML de la URL proporcionada
        const response = await axios.get(folderUrl);
        const html = response.data;

        // Utiliza cheerio para cargar y raspar el HTML
        const $ = cheerio.load(html);
        const files = [];

        // Encuentra todos los enlaces a archivos (ajusta el selector según tu caso)
        $('a').each((i, element) => {
            const href = $(element).attr('href');
            if (href && (href.endsWith('.mp4') || href.endsWith('.mkv') || href.endsWith('.avi'))) { // Ajusta las extensiones según sea necesario
                files.push(href.startsWith('http') ? href : `${folderUrl}/${href}`);
            }
        });

        if (files.length === 0) {
            return res.status(404).json({ error: 'No se encontraron archivos en la carpeta' });
        }

        // Configura el archivo ZIP para descargar
        res.attachment('archivos.zip');
        const archive = archiver('zip', { zlib: { level: 9 } });

        // Manejo de errores al crear el archivo ZIP
        archive.on('error', (err) => {
            console.error('Error al crear el archivo ZIP:', err);
            res.status(500).send('Error al crear el archivo ZIP');
        });

        // Pipe del archivo ZIP a la respuesta HTTP
        archive.pipe(res);

        // Agrega cada archivo al archivo ZIP
        for (const file of files) {
            try {
                const fileResponse = await axios.get(file, { responseType: 'stream' });
                archive.append(fileResponse.data, { name: path.basename(file) });
            } catch (fileError) {
                console.error(`Error al descargar el archivo ${file}:`, fileError.message);
            }
        }

        // Finaliza el archivo ZIP
        archive.finalize();
    } catch (error) {
        console.error('Error general:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
