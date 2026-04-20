; 自定义 NSIS 安装页面 - 让用户输入 URL
; 使用 electron-builder 提供的宏钩子，避免与模板冲突
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var UrlValue

!ifndef BUILD_UNINSTALLER
Var Dialog
Var UrlLabel
Var UrlText

; 自定义页面创建函数
Function UrlPageCreate
    nsDialogs::Create 1018
    Pop $Dialog
    ${If} $Dialog == error
        Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 20u "系统访问地址（URL）："
    Pop $UrlLabel

    ${NSD_CreateText} 0 25u 100% 14u "https://saas.fenmind.com/s/vJu5pO"
    Pop $UrlText

    nsDialogs::Show
FunctionEnd

; 自定义页面离开函数（点下一步时触发）
Function UrlPageLeave
    ${NSD_GetText} $UrlText $UrlValue
    ${If} $UrlValue == ""
        MessageBox MB_OK "请输入系统访问地址"
        Abort
    ${EndIf}
FunctionEnd

; 在"选择安装目录"和"开始安装"之间插入自定义页面
!macro customPageAfterChangeDir
    Page custom UrlPageCreate UrlPageLeave
!macroend

!endif

; 安装完成后，将用户输入的 URL 写入 config.json
!macro customInstall
    ${If} $UrlValue != ""
        FileOpen $0 "$INSTDIR\config.json" w
        FileWrite $0 '{"url":"'
        FileWrite $0 $UrlValue
        FileWrite $0 '"}'
        FileClose $0
    ${EndIf}
!macroend