; 自定义 NSIS 安装页面 - 让用户输入测评系统 URL

!ifndef BUILD_UNINSTALLER

Var UrlInput
Var UrlValue

Function UrlPage
    nsDialogs::Create 1018
    Pop $0

    StrCmp $0 "error" 0 +2
    Abort

    ; 创建标签 (STATIC: WS_CHILD|WS_VISIBLE)
    nsDialogs::CreateControl "STATIC" 0x40000000|0x10000000 0 0 0 100% 12u "请输入心理测评系统URL地址:"
    Pop $0

    ; 创建输入框 (EDIT: WS_CHILD|WS_VISIBLE|WS_TABSTOP|ES_AUTOHSCROLL, exStyle=WS_EX_CLIENTEDGE)
    nsDialogs::CreateControl "EDIT" 0x40000000|0x10000000|0x00010000|0x00000080 0x00000200 0 15u 100% 12u "https://saas.fenmind.com/s/vJu5pO"
    Pop $UrlInput

    nsDialogs::Show
FunctionEnd

Function UrlPageLeave
    ; 通过 GetWindowText 获取输入内容（.s 输出到栈，Pop 取出）
    System::Call "user32::GetWindowText(i $UrlInput, t .s, i 1024)"
    Pop $UrlValue
FunctionEnd

!endif

!macro customPageAfterChangeDir
    Page custom UrlPage UrlPageLeave
!macroend

!macro customInstall
    ; 如果为空则使用默认值
    StrCmp $UrlValue "" 0 +2
    StrCpy $UrlValue "https://saas.fenmind.com/s/vJu5pO"
    ; 写入配置文件
    FileOpen $0 "$INSTDIR\url.txt" w
    FileWrite $0 "$UrlValue"
    FileClose $0
!macroend