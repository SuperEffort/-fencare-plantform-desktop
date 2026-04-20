const { app, BrowserWindow } = require('electron')
// const path = require('path')
// const fs = require('fs')

// 开发环境下忽略 SSL 证书错误（自签名证书）
app.commandLine.appendSwitch('ignore-certificate-errors')


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

    // 打包后 config.json 在 exe 同级目录，开发时在项目根目录
    // const configPath = app.isPackaged
    //     ? path.join(path.dirname(app.getPath('exe')), 'config.json')
    //     : path.join(__dirname, 'config.json')

    let url = 'https://saas.fenmind.com/s/vJu5pO' // 默认值
    // try {
    //     const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    //     if (config.url) url = config.url
    // } catch (e) {
    //     console.error('读取配置文件失败:', e)
    // }

    win.loadURL(url)

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
