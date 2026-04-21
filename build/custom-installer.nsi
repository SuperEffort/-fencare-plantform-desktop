; 自定义 NSIS 安装页面 - 让用户输入测评系统 URL

Var UrlInput
Var UrlValue

; 函数定义放在 BUILD_UNINSTALLER 条件外，避免卸载程序编译时报 "not referenced" 错误
!ifndef BUILD_UNINSTALLER

Function UrlPage
    nsDialogs::Create 1018
    Pop $0

    StrCmp $0 "error" 0 +2
    Abort

    nsDialogs::CreateControl "STATIC" 0x40000000|0x10000000 0 0 0 100% 12u "请输入心理测评系统URL地址:"
    Pop $0

    nsDialogs::CreateControl "EDIT" 0x40000000|0x10000000|0x80000000|0x00000004 0 0 15u 100% 12u "https://saas.fenmind.com/s/vJu5pO"
    Pop $UrlInput

    nsDialogs::Show
FunctionEnd

Function UrlPageLeave
    ; 通过窗口消息获取文本 (WM_GETTEXT = 0x000D)
    SendMessage $UrlInput 0x000D 0 "s" $UrlValue
FunctionEnd

!endif

!macro customPageAfterChangeDir
    Page custom UrlPage UrlPageLeave
!macroend

!macro customInstall
    ; 将用户输入的 URL 写入配置文件
    FileOpen $0 "$INSTDIR\url.txt" w
    FileWrite $0 "$UrlValue"
    FileClose $0
!macroend