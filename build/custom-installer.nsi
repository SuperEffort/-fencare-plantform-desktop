; 安装时静默播种用户配置的 URL，不显示输入页面
; 无需在安装时生成 url.txt：
; 项目根目录的 url.txt 已通过 package.json 的 extraFiles 复制到安装目录（与 exe 同级），
; 用户直接修改该文件即可切换测评地址（保存后自动生效）。
; 注意：不要再在此处 FileWrite 覆盖 $INSTDIR\url.txt，否则会把发布配置冲掉。

!macro customInstall
!macroend
