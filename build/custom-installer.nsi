; 自定义 NSIS 安装页面 - 让用户输入测评系统 URL

Var UrlDialog
Var UrlInput
Var UrlValue

Function UrlPage
    nsDialogs::Create 1018
    Pop $UrlDialog

    ${If} $UrlDialog == error
        Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 12u "请输入心理测评系统URL地址:"
    Pop $0

    ${NSD_CreateText} 0 15u 100% 12u "https://saas.fenmind.com/s/vJu5pO"
    Pop $UrlInput

    nsDialogs::Show
FunctionEnd

Function UrlPageLeave
    ${NSD_GetText} $UrlInput $UrlValue
FunctionEnd

!macro customPageAfterChangeDir
    Page custom UrlPage UrlPageLeave
!macroend

!macro customInstall
    ; 将用户输入的 URL 写入配置文件
    FileOpen $0 "$INSTDIR\url.txt" w
    FileWrite $0 "$UrlValue"
    FileClose $0
!macroend