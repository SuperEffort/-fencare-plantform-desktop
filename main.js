const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
// 开发环境下忽略 SSL 证书错误（自签名证书）
app.commandLine.appendSwitch('ignore-certificate-errors')

function loadUrl() {
    const defaultUrl = 'https://saas.fenmind.com/s/vJu5pO'
    // 从安装目录读取用户配置的 URL
    const urlFile = path.join(path.dirname(app.getPath('exe')), 'url.txt')
    try {
        if (fs.existsSync(urlFile)) {
            const fileUrl = fs.readFileSync(urlFile, 'utf-8').trim()
            if (fileUrl) return fileUrl
        }
    } catch (_) {}
    return defaultUrl
}

function createWindow () {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: '心理测评',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    win.loadURL(loadUrl())

    // 伪装高版本浏览器（很多后台会用 UA 判断）
    win.webContents.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    )

    // 禁止打开新窗口，统一在当前窗口跳转
    win.webContents.setWindowOpenHandler(({ url }) => {
        win.loadURL(url)
        return { action: 'deny' }
    })

    // 打开调试
    // win.webContents.openDevTools()
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})
