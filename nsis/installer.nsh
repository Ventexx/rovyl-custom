; Injected by electron-builder (see package.json build.nsis.include).
; Shortcut selection for the assisted installer. Keep electron-builder's standard
; running-app checks and Finish page; never kill processes by executable name here.

!include "nsDialogs.nsh"

!macro preInit
  !ifndef BUILD_UNINSTALLER
    ; The downloadable installer keeps the same name as the app. Run a temporary
    ; copy with a distinct process name before acquiring the installer mutex or
    ; calling older uninstallers (some kill every process named Rovyl.exe).
    ${GetParameters} $0
    ClearErrors
    ${GetOptions} $0 "--rovyl-setup-parent=" $1
    ${IfNot} ${Errors}
      System::Call 'kernel32::OpenProcess(i 0x100000, i 0, i r1) p.r2'
      ${If} $2 != 0
        System::Call 'kernel32::WaitForSingleObject(p r2, i 15000) i.r3'
        System::Call 'kernel32::CloseHandle(p r2)'
        ${If} $3 != 0
          MessageBox MB_OK|MB_ICONSTOP "The setup launcher did not close. Please retry the installation."
          Abort
        ${EndIf}
      ${EndIf}
    ${EndIf}

    ${If} $EXEFILE == "${PRODUCT_FILENAME}.exe"
      InitPluginsDir
      System::Call 'kernel32::GetCurrentProcessId() i.r1'
      ClearErrors
      CopyFiles /SILENT "$EXEPATH" "$PLUGINSDIR\rovyl-setup.exe"
      ${If} ${Errors}
        MessageBox MB_OK|MB_ICONSTOP "Could not prepare the installer. Please retry the installation."
        Abort
      ${EndIf}
      ; Keep /D (if supplied) last, as required by NSIS. The child waits for this
      ; process to exit before touching the old installation.
      ; NSIS removes /D from GetParameters, but has already applied it to INSTDIR.
      ${If} $INSTDIR != ""
        StrCpy $0 "$0 /D=$INSTDIR"
      ${EndIf}
      ClearErrors
      Exec '"$PLUGINSDIR\rovyl-setup.exe" --rovyl-setup-parent=$1 $0'
      ${If} ${Errors}
        MessageBox MB_OK|MB_ICONSTOP "Could not start the installer. Please retry the installation."
        Abort
      ${EndIf}
      Quit
    ${EndIf}
  !endif
!macroend

!ifndef BUILD_UNINSTALLER
  Var desktopShortcutCheckbox
  Var desktopShortcutSelected
!endif

!macro customInit
  ; Silent installs also default to no new desktop shortcut.
  StrCpy $desktopShortcutSelected ${BST_UNCHECKED}
!macroend

!macro customPageAfterChangeDir
  Page custom DesktopShortcutPage DesktopShortcutPageLeave

  Function DesktopShortcutPage
    !insertmacro MUI_HEADER_TEXT "Shortcuts" "Choose whether to add a desktop shortcut."
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0 12u 100% 12u "Create a desktop shortcut"
    Pop $desktopShortcutCheckbox
    ${NSD_SetState} $desktopShortcutCheckbox $desktopShortcutSelected
    nsDialogs::Show
  FunctionEnd

  Function DesktopShortcutPageLeave
    ${NSD_GetState} $desktopShortcutCheckbox $desktopShortcutSelected
  FunctionEnd
!macroend

!macro customInstall
  ; Automatic shortcut creation is disabled in package.json; only this opt-in creates one.
  ${If} $desktopShortcutSelected == ${BST_CHECKED}
  ${AndIfNot} ${isNoDesktopShortcut}
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${EndIf}
!macroend

!macro customUnInstall
  ; Match the standard uninstaller cleanup, preserving shortcuts during an upgrade.
  ${IfNot} ${isKeepShortcuts}
    WinShell::UninstShortcut "$oldDesktopLink"
    Delete "$oldDesktopLink"
  ${EndIf}
!macroend
