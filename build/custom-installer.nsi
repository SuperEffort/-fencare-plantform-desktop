; 安装时静默写入固定的测评系统 URL，不显示输入页面

!macro customInstall
    !define DEFAULT_URL "https://saas.fenmind.com/group/surveyList?evalId=IYwa8mtVDEousSWjzA2CN3rv"
    FileOpen $0 "$INSTDIR\url.txt" w
    FileWrite $0 "${DEFAULT_URL}"
    FileClose $0
!macroend
