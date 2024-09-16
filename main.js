const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const { Client, Authenticator } = require('minecraft-launcher-core');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('download-mods', async (event) => {
  const appDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
  const minecraftModsPath = path.join(appDataPath, '.minecraft', 'mods');

  // สร้างโฟลเดอร์ mods หากยังไม่มี
  if (!fs.existsSync(minecraftModsPath)) {
    fs.mkdirSync(minecraftModsPath, { recursive: true });
  }

  try {
    // 1. ดึงรายการ mod จากเซิร์ฟเวอร์
    const response = await axios.get('https://pastebin.com/raw/7EWZACwF');
    const serverMods = response.data.mods; // ต้องปรับใช้ให้ตรงกับรูปแบบ JSON
    console.log(serverMods);
    // 2. ตรวจสอบ mod ที่มีอยู่ในเครื่องแล้ว
    const localMods = fs.readdirSync(minecraftModsPath);
    const modsToDownload = serverMods.filter(mod => !localMods.includes(mod.fileName));

    // ถ้าไม่มี mod ที่ต้องโหลดให้ return กลับไปว่าเสร็จแล้ว
    if (modsToDownload.length === 0) {
      return { success: true, message: "No mods to download" };
    }

    // 3. ดาวน์โหลด mod ที่ขาดหายไป
    for (const mod of modsToDownload) {
      const destPath = path.join(minecraftModsPath, mod.fileName);

      const writer = fs.createWriteStream(destPath);
      const downloadResponse = await axios({
        url: mod.url, // URL ที่ได้จาก JSON
        method: 'GET',
        responseType: 'stream'
      });

      downloadResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      for (let i = 0; i <= 100; i += 10) {
        event.sender.send('download-progress', i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`${mod.fileName} downloaded successfully.`);
    }

    return { success: true, modsDownloaded: modsToDownload.length };
  } catch (error) {
    console.error('Error fetching mod list or downloading mods:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('start-minecraft', async () => {
  const launcher = new Client();
  const appDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
  const minecraftPath = path.join(appDataPath, '.minecraft');

  let opts = {
      authorization: Authenticator.getAuth("SkyShine"),
      root: minecraftPath, 
      version: {
          number: "1.20", 
          type: "release",
      },
      memory: {
          max: "6G",
          min: "4G"
      }
  }

  launcher.launch(opts);

  launcher.on('debug', (e) => console.log(e));
  launcher.on('data', (e) => console.log(e));
});