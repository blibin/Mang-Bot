const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const express = require('express');

// ------------------- SERVIDOR EXPRESS -------------------
const app = express();
app.get('/', (req, res) => {
    res.send('MangBot activo 🚀');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🌐 Servidor activo en puerto', PORT);
});

// ------------------- CONFIGURAR CLIENTE -------------------
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }
});

// ------------------- ESTADOS -------------------
client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Cargando WhatsApp: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
    console.log('🔐 Sesión autenticada correctamente');
});

// ------------------- QR Y READY -------------------
client.on('qr', qr => {
    console.log("📌 QR recibido:");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ 🐿️ MangBot listo!');
});

// ------------------- BASE DE DATOS -------------------
let data = {};
if (fs.existsSync('./data.json')) {
    try {
        data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    } catch {
        data = {};
    }
}

function saveData() {
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

// ------------------- BIENVENIDAS -------------------
client.on('group_join', async notif => {
    try {
        const chat = await notif.getChat();
        const user = await client.getContactById(notif.id.participant);
        chat.sendMessage(`👋 ¡Bienvenido/a ${user.pushname || "nuevo miembro"}!`);
    } catch {}
});

client.on('group_leave', async notif => {
    try {
        const chat = await notif.getChat();
        const user = await client.getContactById(notif.id.participant);
        chat.sendMessage(`👋 ${user.pushname || "Miembro"} salió del grupo.`);
    } catch {}
});

// ------------------- ADMIN CHECK -------------------
async function botEsAdmin(chat) {
    try {
        const botId = client.info.wid._serialized;
        const p = chat.participants.find(u => u.id._serialized === botId);
        return p && (p.isAdmin || p.isSuperAdmin);
    } catch {
        return false;
    }
}

// ------------------- COMANDOS -------------------
client.on('message', async msg => {
    if (!msg.body || !msg.body.startsWith('.')) return;

    const texto = msg.body.trim();
    const comando = texto.split(" ")[0].toLowerCase();
    const args = texto.replace(comando, "").trim();
    const chat = await msg.getChat();

    if (comando === ".menu")
        return msg.reply(
`🐿️ *Mang Bot - MENÚ*
👋 .hola
📦 .set clave=valor | .get clave | .del clave | .list
🛡️ ADMIN: .abrir .cerrar`
        );

    if (comando === ".hola") return msg.reply("🐿️ ¡Hola!");

    if (comando === ".set") {
        const i = args.indexOf('=');
        if (i === -1) return msg.reply("❌ Uso: .set clave=valor");
        data[args.slice(0, i)] = args.slice(i + 1);
        saveData();
        return msg.reply("✅ Guardado");
    }

    if (comando === ".get") {
        if (!data[args]) return msg.reply("❌ No existe");
        return msg.reply(data[args]);
    }

    if (comando === ".del") {
        delete data[args];
        saveData();
        return msg.reply("🗑️ Eliminado");
    }

    if (comando === ".list") {
        if (!Object.keys(data).length) return msg.reply("📭 Vacío");
        return msg.reply(Object.keys(data).map(c => `• .${c}`).join('\n'));
    }

    const nombre = comando.slice(1);
    if (data[nombre]) return msg.reply(data[nombre]);

    if (!chat.isGroup) return;
    if (!await botEsAdmin(chat)) return;

    if (comando === ".abrir") {
        await chat.setMessagesAdminsOnly(false);
        return msg.reply("🔓 Grupo abierto");
    }

    if (comando === ".cerrar") {
        await chat.setMessagesAdminsOnly(true);
        return msg.reply("🔒 Grupo cerrado");
    }
});

// ------------------- INICIAR -------------------
console.log("🚀 Inicializando MangBot...");
client.initialize();