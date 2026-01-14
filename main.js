const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// -------------------- INICIALIZAR CLIENTE --------------------
const client = new Client({ authStrategy: new LocalAuth() });

// -------------------- QR --------------------
client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🐿 Mang Bot Ardilla listo!'));

// -------------------- BASE DE DATOS --------------------
let data = {};
if (fs.existsSync('./data.json'))
    data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

function saveData() {
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

// -------------------- IA --------------------
const { ChatGPTAPI } = require("chatgpt");

const ia = new ChatGPTAPI({
    apiKey: "no-key-required",
    completionParams: { model: "gpt-4o-mini" }
});

async function usarIA(texto) {
    try {
        const r = await ia.sendMessage(texto);
        return r.text;
    } catch (e) {
        return "❌ Error en la IA.";
    }
}

// -------------------- AUTO-BIENVENIDA --------------------
client.on("group_join", async (n) => {
    try {
        const chat = await n.getChat();
        const user = await client.getContactById(n.id.participant);

        chat.sendMessage(
            `👋 Bienvenido/a ${user.pushname || "nuevo miembro"}\n🐿 Mang Bot Ardilla te saluda!`
        );
    } catch (e) { console.log("Error bienvenida:", e); }
});

// -------------------- AUTO-DESPEDIDA --------------------
client.on("group_leave", async (n) => {
    try {
        const chat = await n.getChat();
        const user = await client.getContactById(n.id.participant);

        chat.sendMessage(
            `👋 ${user.pushname || "Miembro"} ha salido.\n🐿 ¡Le deseamos lo mejor!`
        );
    } catch (e) { console.log("Error despedida:", e); }
});

// -------------------- FUNCIONES ADMIN --------------------
async function abrirGrupo(chat) {
    await chat.setMessagesAdminsOnly(false);
}
async function cerrarGrupo(chat) {
    await chat.setMessagesAdminsOnly(true);
}

async function enviarNotificacion(chat, texto) {
    const miembros = await chat.participants;
    const menciones = miembros.map(p => p.id._serialized);
    await chat.sendMessage(texto, { mentions: menciones });
}

// -------------------- MENSAJES --------------------
client.on('message', async msg => {
    const texto = msg.body.trim();
    if (!texto.startsWith('.')) return;

    const comando = texto.split(' ')[0].toLowerCase();
    const args = texto.slice(comando.length).trim();

    const chat = await msg.getChat();
    const isGroup = chat.isGroup;
    const botNumber = client.info.wid._serialized;
    const botInGroup = isGroup ? chat.participants.find(p => p.id._serialized === botNumber) : null;
    const isBotAdmin = botInGroup?.isAdmin || false;

    // -------------------- MENÚ --------------------
    if (comando === '.menu') {
        msg.reply(`🐿 Mang Bot Ardilla - Comandos:
💬 .hola
🧠 .ia texto
📦 .set clave=valor
🔍 .get clave
🗑 .del clave
📋 .list
👑 .promote @usuario
❌ .demote @usuario
🚪 .kick @usuario
📢 .noty texto
🔓 .abrir
🔒 .cerrar`);
        return;
    }

    // -------------------- SALUDO --------------------
    if (comando === '.hola') {
        msg.reply(`🐿 ¡Hola ${msg._data.notifyName || 'Usuario'}!`);
        return;
    }

    // -------------------- IA --------------------
    if (comando === '.ia') {
        if (!args) return msg.reply("❌ Escribe algo: .ia ¿qué es JavaScript?");
        msg.reply("⌛ Pensando con IA...");
        const r = await usarIA(args);
        msg.reply(r);
        return;
    }

    // -------------------- COMANDOS DINÁMICOS --------------------
    if (comando === '.set') {
        const [clave, valor] = args.split('=');
        if (!clave || !valor) return msg.reply('❌ Usa: .set comando=mensaje');
        data[clave.trim()] = valor.trim();
        saveData();
        msg.reply(`✅ Guardado: .${clave.trim()} → "${valor.trim()}"`);
        return;
    }

    if (comando === '.get') {
        if (!args || !data[args]) return msg.reply('⚠ Ese comando no existe');
        msg.reply(`📌 .${args}: ${data[args]}`);
        return;
    }

    if (comando === '.del') {
        if (!args || !data[args]) return msg.reply('⚠ Ese comando no existe');
        delete data[args];
        saveData();
        msg.reply('🗑 Comando eliminado');
        return;
    }

    if (comando === '.list') {
        if (Object.keys(data).length === 0) return msg.reply('📭 No hay comandos guardados.');
        let lista = '📋 Comandos guardados:\n';
        for (const [k, v] of Object.entries(data)) lista += `• .${k} → ${v}\n`;
        msg.reply(lista);
        return;
    }

    // Si el usuario creó un comando personalizado
    const nombre = comando.slice(1);
    if (data[nombre]) {
        msg.reply(data[nombre]);
        return;
    }

    // -------------------- SOLO GRUPOS --------------------
    if (!isGroup) return;

    // -------------------- ADMIN --------------------
    if (!isBotAdmin && ['.promote', '.demote', '.kick', '.noty', '.abrir', '.cerrar'].includes(comando)) {
        return msg.reply("❌ Necesito ser admin para hacer eso.");
    }

    // -------------------- PROMOTE --------------------
    if (comando === '.promote') {
        if (!msg.mentionedIds.length) return msg.reply('❌ Menciona a alguien.');
        await chat.promoteParticipants(msg.mentionedIds);
        msg.reply('👑 Usuario promovido.');
        return;
    }

    // -------------------- DEMOTE --------------------
    if (comando === '.demote') {
        if (!msg.mentionedIds.length) return msg.reply('❌ Menciona a alguien.');
        await chat.demoteParticipants(msg.mentionedIds);
        msg.reply('❌ Admin removido.');
        return;
    }

    // -------------------- KICK --------------------
    if (comando === '.kick') {
        if (!msg.mentionedIds.length) return msg.reply('❌ Menciona a alguien.');
        await chat.removeParticipants(msg.mentionedIds);
        msg.reply('🚪 Usuario expulsado.');
        return;
    }

    // -------------------- NOTY --------------------
    if (comando === '.noty') {
        if (!args) return msg.reply('❌ Escribe el mensaje.');
        await enviarNotificacion(chat, args);
        return;
    }

    // -------------------- ABRIR --------------------
    if (comando === '.abrir') {
        await abrirGrupo(chat);
        msg.reply("🔓 Grupo abierto.");
        return;
    }

    // -------------------- CERRAR --------------------
    if (comando === '.cerrar') {
        await cerrarGrupo(chat);
        msg.reply("🔒 Grupo cerrado.");
        return;
    }
});

// -------------------- INICIAR --------------------
client.initialize();