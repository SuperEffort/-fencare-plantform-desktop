const { app, BrowserWindow, Menu, MenuItem, dialog } = require('electron')
const fs = require('fs')
const path = require('path')
// 忽略 SSL 证书错误（自签名证书）
app.commandLine.appendSwitch('ignore-certificate-errors')

// 测评系统地址前缀，配置里只需要维护 evalId
const BASE_URL = 'https://saas.fenmind.com/group/surveyList'
const DEFAULT_EVAL_ID = ''
const EVAL_ID_PATTERN = /^[A-Za-z0-9._-]+$/

// 去掉地址里的 evalId 参数，得到基础地址
function stripEvalId (url) {
    const value = (url || '').trim()
    if (!value) return ''
    try {
        const parsed = new URL(value)
        parsed.searchParams.delete('evalId')
        return parsed.toString().replace(/[?&]$/, '')
    } catch (_) {
        return value.split(/[?&]evalId=/i)[0].replace(/[?&]$/, '') || value
    }
}

// baseUrl：基础地址（来自 url= / baseUrl=，缺省用内置 BASE_URL），evalId：单独配置的编号
function buildUrl (evalId, baseUrl) {
    const base = stripEvalId(baseUrl || '') || BASE_URL
    if (!evalId) return base
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}evalId=${encodeURIComponent(evalId)}`
}

// 从完整地址中反解 evalId
function extractEvalId (url) {
    const match = /[?&]evalId=([^&#]+)/i.exec(url || '')
    if (!match) return ''
    try {
        return decodeURIComponent(match[1])
    } catch (_) {
        return match[1]
    }
}

const FALLBACK_URL = buildUrl(DEFAULT_EVAL_ID)

// 配置文件名，按顺序命中：新格式优先，兼容旧的纯文本 url.txt
const CONFIG_NAMES = ['config.ini', 'url.txt']

// 安装目录：打包后是 exe 所在目录，开发时是项目根目录
function installDir () {
    return app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()
}

// 待读取的配置文件列表：安装目录优先，asar 内只读兜底
function configFiles () {
    const dirs = app.isPackaged ? [installDir(), app.getAppPath()] : [installDir()]
    const files = []
    for (const dir of dirs) {
        for (const name of CONFIG_NAMES) files.push(path.join(dir, name))
    }
    return [...new Set(files)]
}

// 兼容 ANSI / UTF-8(含 BOM) / UTF-16 几种记事本编码
function decodeText (buf) {
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
        return buf.subarray(2).toString('utf16le')
    }
    if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
        const swapped = Buffer.from(buf.subarray(2))
        swapped.swap16()
        return swapped.toString('utf16le')
    }
    return buf.toString('utf-8').replace(/^\uFEFF/, '')
}

// 解析 key=value 配置，忽略空行与 # ; 注释
function parseConfig (text) {
    const conf = {}
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith('#') || line.startsWith(';')) continue
        const index = line.indexOf('=')
        if (index < 0) continue
        const key = line.slice(0, index).trim().toLowerCase()
        if (!key) continue
        conf[key] = line.slice(index + 1).trim().replace(/^["']|["']$/g, '')
    }
    return conf
}

// 解析配置文本中的地址：url/baseUrl 提供路径，evalId 提供编号
function parseAddr (text) {
    const conf = parseConfig(text || '')
    const baseKey = (conf.baseurl || conf.url || conf.home || '').trim()
    const evalId = (conf.evalid || '').trim()
    const hasBase = /^https?:\/\//i.test(baseKey)
    const hasEvalId = EVAL_ID_PATTERN.test(evalId)

    // 只有完整地址：直接使用（保留其中的 evalId）
    if (hasBase && !hasEvalId) {
        return {
            url: baseKey,
            baseUrl: stripEvalId(baseKey),
            evalId: extractEvalId(baseKey)
        }
    }
    // 基础地址 + 单独编号：以 evalId 为准重新拼接
    if (hasBase && hasEvalId) {
        const base = stripEvalId(baseKey)
        return { url: buildUrl(evalId, base), baseUrl: base, evalId }
    }
    // 只有编号：用内置基础地址
    if (hasEvalId) {
        return { url: buildUrl(evalId), baseUrl: BASE_URL, evalId }
    }
    // 兼容纯文本单行地址
    const plain = (text || '').split(/\r?\n/)
        .map(s => s.trim())
        .find(s => /^https?:\/\//i.test(s))
    if (plain) {
        return { url: plain, baseUrl: stripEvalId(plain), evalId: extractEvalId(plain) }
    }
    return null
}

function readConfigAddr (file) {
    try {
        if (!fs.existsSync(file)) return null
        return parseAddr(decodeText(fs.readFileSync(file)))
    } catch (_) {
        return null
    }
}

function readUrlFrom (file) {
    const addr = readConfigAddr(file)
    return addr ? addr.url : ''
}

function resolveUrl () {
    const env = (process.env.PSY_URL || '').trim()
    if (env) return env
    for (const file of configFiles()) {
        const url = readUrlFrom(file)
        if (url) return url
    }
    return FALLBACK_URL
}

// 当前地址来源，菜单里显示，方便自检读的是哪个文件
function currentSource () {
    if ((process.env.PSY_URL || '').trim()) return '环境变量 PSY_URL'
    for (const file of configFiles()) {
        if (readUrlFrom(file)) return file
    }
    return '内置默认值'
}

function buildTemplate (url, evalId) {
    const base = stripEvalId(url || '')
    const lines = [
        '# 心理测评客户端配置',
        '# url：测评系统地址（写到路径即可，带不带 evalId 都可以）',
        '# evalId：团测编号，单独配置；与 url 同时存在时以 evalId 为准拼接',
        '# 保存后 1 秒内自动生效（也可重启程序）；以 # 或 ; 开头的行会被忽略'
    ]
    if (base) lines.push(`url=${base}`)
    if (evalId) lines.push(`evalId=${evalId}`)
    if (!base && !evalId) lines.push(`url=${BASE_URL}`)
    lines.push('')
    return lines.join('\r\n')
}

// 安装目录里是否存在完整配置（必须有有效的 evalId/团测编号）
function hasUserConfig () {
    for (const name of CONFIG_NAMES) {
        const addr = readConfigAddr(path.join(installDir(), name))
        if (addr && addr.evalId) return true
    }
    return false
}

// 未配置时显示的本地引导页（不依赖网络）
function guidePage () {
    const file = path.join(installDir(), CONFIG_NAMES[0])
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>尚未配置</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #f6f7f9; color: #333;
         font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
  .card { width: 560px; padding: 32px 36px; background: #fff; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.08); }
  h1 { margin: 0 0 14px; font-size: 18px; }
  p { margin: 8px 0; font-size: 13px; line-height: 1.8; color: #555; }
  code { padding: 1px 6px; background: #f0f2f5; border-radius: 4px; font-size: 12px; }
  .path { margin-top: 18px; font-size: 12px; color: #999; word-break: break-all; }
</style>
</head>
<body>
  <div class="card">
    <h1>尚未配置测评地址</h1>
    <p>请点击顶部菜单 <code>配置 → 手动配置</code>，输入团测编号；</p>
    <p>或点击 <code>配置 → 导入配置</code>，选择管理员提供的 <code>config.ini</code> 文件。</p>
    <p>如需协助，请联系管理员获取配置文件。</p>
    <div class="path">配置文件位置：${escapeHtml(file)}</div>
  </div>
</body>
</html>`
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}

// 启动时引导用户完成配置
async function promptConfigGuide () {
    const file = path.join(installDir(), CONFIG_NAMES[0])
    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: '尚未配置测评地址',
        message: '未找到有效的配置文件',
        detail: `请点击「手动配置」输入团测编号，或点击「导入配置」选择管理员提供的配置文件。\n\n配置文件位置：\n${file}`,
        buttons: ['手动配置', '导入配置', '稍后'],
        defaultId: 0,
        cancelId: 2,
        noLink: true
    })
    if (response === 0) openUrlEditor()
    else if (response === 1) await importConfigFile()
}

// 选择本地配置文件
async function importConfigFile () {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: '选择配置文件（config.ini）',
        defaultPath: installDir(),
        properties: ['openFile'],
        filters: [
            { name: '配置文件', extensions: ['ini', 'cfg', 'conf', 'txt'] },
            { name: '所有文件', extensions: ['*'] }
        ]
    })
    if (result.canceled || !result.filePaths || !result.filePaths.length) return
    replaceConfig(result.filePaths[0])
}

// 校验后覆盖安装目录的 config.ini，并立即切换地址
function replaceConfig (source) {
    const target = path.join(installDir(), CONFIG_NAMES[0])
    try {
        const text = decodeText(fs.readFileSync(source))
        const addr = parseAddr(text)
        if (!addr || !addr.url) {
            dialog.showErrorBox(
                '配置文件无效',
                `文件里既没有完整地址（url=http(s)://…），也没有有效的 evalId，已保留原配置。\n\n文件：${source}`
            )
            return
        }

        // 备份现有配置，方便回滚
        if (fs.existsSync(target)) {
            try { fs.copyFileSync(target, `${target}.bak`) } catch (_) {}
        }

        // 有 key=value 结构的原样保留（注释、其它配置项都不动）；
        // 只是裸地址的文件则规范化为 url= + evalId=
        const conf = parseConfig(text)
        const content = Object.keys(conf).length > 0
            ? (text.endsWith('\n') ? text : `${text}\n`)
            : buildTemplate(addr.baseUrl, addr.evalId)
        fs.writeFileSync(target, content, 'utf-8')

        // 先同步 lastUrl，避免文件监听再次触发重复加载
        lastUrl = addr.url
        openUrl(addr.url)

        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '配置已替换',
            message: '配置文件已替换，地址已切换',
            detail: `新地址：${addr.url}\n配置路径：${target}`,
            buttons: ['知道了'],
            noLink: true
        })
    } catch (err) {
        dialog.showErrorBox(
            '导入失败',
            `无法写入配置文件：\n${target}\n\n${err.message}\n\n若程序安装在 Program Files 下，请以管理员身份运行，或改装到可写目录。`
        )
    }
}

function escapeHtml (text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

let urlEditor = null

// 弹出输入窗口，手动修改地址
function openUrlEditor () {
    if (urlEditor && !urlEditor.isDestroyed()) {
        urlEditor.focus()
        return
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>设置团测编号</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px 18px; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 13px; color: #222; }
  .label { margin-bottom: 6px; color: #444; }
  input { width: 100%; padding: 8px 10px; font-size: 13px; border: 1px solid #c9c9c9; border-radius: 4px; outline: none; }
  input:focus { border-color: #3d7eff; }
  .tip { margin-top: 8px; color: #999; font-size: 12px; }
  .err { margin-top: 6px; min-height: 16px; color: #d93025; font-size: 12px; }
  .btns { margin-top: 14px; text-align: right; }
  button { min-width: 76px; margin-left: 8px; padding: 6px 14px; font-size: 13px; border: 1px solid #c9c9c9; border-radius: 4px; background: #fff; cursor: pointer; }
  #ok { border-color: #3d7eff; background: #3d7eff; color: #fff; }
</style>
</head>
<body>
  <div class="label">团测编号</div>
  <input id="url" type="text" spellcheck="false" value="${escapeHtml(extractEvalId(resolveUrl()))}">
  <div class="tip">请输入团测编号，保存后立即生效</div>
  <div class="err" id="err"></div>
  <div class="btns">
    <button id="cancel">取消</button>
    <button id="ok">保存</button>
  </div>
</body>
</html>`

    urlEditor = new BrowserWindow({
        width: 560,
        height: 260,
        parent: mainWindow,
        modal: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        title: '设置团测编号',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    })
    urlEditor.setMenu(null)
    urlEditor.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {})

    urlEditor.webContents.once('did-finish-load', () => {
        const win = urlEditor
        if (!win || win.isDestroyed()) return
        win.webContents.executeJavaScript(`
            new Promise((resolve) => {
                const input = document.getElementById('url')
                const err = document.getElementById('err')
                const submit = () => {
                    const value = input.value.trim()
                    if (!value) {
                        err.textContent = '请输入团测编号'
                        return
                    }
                    // 允许直接粘贴完整地址，自动取出 evalId
                    if (/^https?:\\/\\//i.test(value)) {
                        const match = /[?&]evalId=([^&#]+)/i.exec(value)
                        if (!match) {
                            err.textContent = '该地址中没有 evalId 参数'
                            return
                        }
                        resolve(match[1])
                        return
                    }
                    if (!/^[A-Za-z0-9._-]+$/.test(value)) {
                        err.textContent = '团测编号只能包含字母、数字、下划线、点和横线'
                        return
                    }
                    resolve(value)
                }
                document.getElementById('ok').addEventListener('click', submit)
                document.getElementById('cancel').addEventListener('click', () => resolve(null))
                input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit() })
                input.focus()
                input.select()
            })
        `).then((value) => {
            const current = urlEditor
            urlEditor = null
            if (current && !current.isDestroyed()) current.close()
            if (value) saveEvalId(value)
        }).catch(() => {})
    })

    urlEditor.on('closed', () => { urlEditor = null })
}

// 只更新 config.ini 中的 evalId 行，url= / baseUrl= 原样保留
function updateEvalIdInConfig (evalId) {
    const file = path.join(installDir(), CONFIG_NAMES[0])
    const valueLine = `evalId=${evalId}`
    try {
        let text = ''
        if (fs.existsSync(file)) text = decodeText(fs.readFileSync(file))

        if (!text.trim()) {
            fs.writeFileSync(file, buildTemplate(BASE_URL, evalId), 'utf-8')
            return null
        }

        try { fs.copyFileSync(file, `${file}.bak`) } catch (_) {}

        let written = false
        const next = []
        for (const raw of text.split(/\r?\n/)) {
            const trimmed = raw.trim()
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
                next.push(raw)
                continue
            }
            const index = trimmed.indexOf('=')
            const key = index < 0 ? '' : trimmed.slice(0, index).trim().toLowerCase()
            // 只替换 evalId 行，其它行（含 url=）保持原样
            if (key !== 'evalid') {
                next.push(raw)
                continue
            }
            if (!written) {
                next.push(valueLine)
                written = true
            }
        }
        if (!written) next.push(valueLine)
        while (next.length && !next[next.length - 1].trim()) next.pop()
        next.push('')

        fs.writeFileSync(file, next.join('\r\n'), 'utf-8')
        return null
    } catch (err) {
        return err
    }
}

function saveEvalId (value) {
    const evalId = (value || '').trim()
    if (!EVAL_ID_PATTERN.test(evalId)) {
        dialog.showErrorBox('团测编号无效', `只能包含字母、数字、下划线、点和横线：\n${evalId}`)
        return
    }
    const err = updateEvalIdInConfig(evalId)
    if (err) {
        dialog.showErrorBox(
            '保存失败',
            `无法写入配置文件：\n${path.join(installDir(), CONFIG_NAMES[0])}\n\n${err.message}`
        )
        return
    }
    // 用配置里的基础地址拼接新编号（配置里写的是别的域名也能保留）
    const addr = readConfigAddr(path.join(installDir(), CONFIG_NAMES[0]))
    lastUrl = addr ? addr.url : buildUrl(evalId)
    openUrl(lastUrl)
}

let mainWindow = null
// 是否停留在"未配置"引导页
let guideMode = false

function openUrl (url) {
    guideMode = false
    // 窗口已关闭（macOS 应用未退出，菜单仍可点）时先重建窗口
    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow(url)
        return Promise.resolve()
    }
    return mainWindow.loadURL(url).catch((err) => {
        dialog.showErrorBox('页面打开失败', `地址：${url}\n\n${err.message}`)
    })
}

let watching = false
let lastUrl = ''

// 配置文件改动后自动切换地址（不重启也能生效）
function watchConfig () {
    if (watching) return
    watching = true
    lastUrl = resolveUrl()
    for (const file of configFiles()) {
        if (file.includes('.asar')) continue
        fs.watchFile(file, { interval: 1000 }, onConfigChanged)
    }
}

function onConfigChanged () {
    // 配置被清空（例如把 evalId 删掉）：回到引导页等待重新配置
    if (!hasUserConfig()) {
        if (!guideMode) {
            guideMode = true
            lastUrl = ''
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.loadURL(guidePage()).catch(() => {})
            }
        }
        return
    }
    const next = resolveUrl()
    // 引导页期间一旦出现有效配置，立即切换到该地址（即使与内置默认值相同）
    if (guideMode) {
        lastUrl = next
        openUrl(next)
        return
    }
    if (next === lastUrl) return
    lastUrl = next
    if (mainWindow && !mainWindow.isDestroyed()) openUrl(next)
}

// 重新加载当前地址；未配置时回到引导页并弹窗
function reloadCurrent () {
    if (!hasUserConfig()) {
        guideMode = true
        lastUrl = ''
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(guidePage()).catch(() => {})
        }
        promptConfigGuide()
        return
    }
    openUrl(resolveUrl())
}

function enhanceMenu () {
    const menu = Menu.getApplicationMenu()
    if (!menu) return
    const configMenu = Menu.buildFromTemplate([
        { label: '手动配置', click: () => openUrlEditor() },
        { label: '导入配置', click: () => importConfigFile() },
        { label: '查看配置', click: () => showConfigDetail() },
        { label: '重新加载', click: () => reloadCurrent() }
    ])
    menu.append(new MenuItem({ label: '配置', submenu: configMenu }))
}

// 排查用：把每个候选文件的"是否存在、解析出什么"都列出来
function showConfigDetail () {
    const lines = configFiles().map((file) => {
        const exists = fs.existsSync(file)
        const addr = readConfigAddr(file)
        return `${exists ? '[存在]' : '[缺失]'} ${file}\n    -> ${addr ? addr.url : '（无有效配置）'}`
    })
    const current = resolveUrl()
    dialog.showMessageBox({
        type: 'info',
        title: '配置详情',
        message: `当前生效地址：\n${current}\n\n基础地址：${stripEvalId(current)}\n团测编号：${extractEvalId(current) || '（无）'}\n\n生效来源：${currentSource()}`,
        detail: `候选配置文件（按优先级从上到下）：\n${lines.join('\n')}`,
        buttons: ['知道了'],
        noLink: true
    })
}

function createWindow (initialUrl) {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: '心理测评',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    // 伪装高版本浏览器（很多后台会用 UA 判断）
    mainWindow.webContents.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    )

    // 禁止打开新窗口，统一在当前窗口跳转
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) openUrl(url)
        return { action: 'deny' }
    })

    mainWindow.on('closed', () => { mainWindow = null })

    // 防止远程页面标题覆盖窗口标题
    mainWindow.on('page-title-updated', (event) => event.preventDefault())

    if (initialUrl === null) {
        // 未配置：显示本地引导页，不加载内置默认地址
        guideMode = true
        mainWindow.loadURL(guidePage()).catch(() => {})
    } else {
        openUrl(initialUrl || resolveUrl())
    }
    watchConfig()

    // 打开调试
    // mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
    enhanceMenu()

    const configured = hasUserConfig()
    createWindow(configured ? resolveUrl() : null)
    if (!configured) promptConfigGuide()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            const ok = hasUserConfig()
            createWindow(ok ? resolveUrl() : null)
            if (!ok) promptConfigGuide()
        }
    })
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})
