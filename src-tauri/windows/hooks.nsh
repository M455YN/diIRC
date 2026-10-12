; Shown in Settings > Apps and on Start menu / desktop shortcuts.
; productName stays "di-irc": that is the install folder (%LOCALAPPDATA%\di-irc),
; the uninstall registry key, and the name the next installer uses to find this app.
; Message history lives in the WebView data directory, which follows identifier
; (com.diirc.app), not this display name.
!define LUNA_DISPLAY_NAME "Luna IRC"

; Rename a shortcut only when it points at this install, so an unrelated .lnk is left alone.
!macro RenameOwnedShortcut _from _to
  !insertmacro IsShortcutTarget "${_from}" "$INSTDIR\${MAINBINARYNAME}.exe"
  Pop $0
  ${If} $0 = 1
    Delete "${_to}"
    ClearErrors
    Rename "${_from}" "${_to}"
  ${EndIf}
!macroend

!macro ApplyLunaDisplayName
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayName" "${LUNA_DISPLAY_NAME}"
  !insertmacro RenameOwnedShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$SMPROGRAMS\${LUNA_DISPLAY_NAME}.lnk"
  !insertmacro RenameOwnedShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$DESKTOP\${LUNA_DISPLAY_NAME}.lnk"
!macroend

!macro DeleteLunaShortcut _path
  ${If} ${FileExists} "${_path}"
    !insertmacro UnpinShortcut "${_path}"
    Delete "${_path}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro ApplyLunaDisplayName
!macroend

; The finish page creates the desktop shortcut after POSTINSTALL.
; Skip when this run never registered an uninstaller, so a cancelled setup
; does not create a stray uninstall key.
Function .onGUIEnd
  ReadRegStr $0 SHCTX "${UNINSTKEY}" "UninstallString"
  ${If} $0 != ""
    !insertmacro ApplyLunaDisplayName
  ${EndIf}
FunctionEnd

; Skip during an update: the updater does not recreate shortcuts, so deleting them here
; would remove the Start menu entry.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    !insertmacro DeleteLunaShortcut "$SMPROGRAMS\${LUNA_DISPLAY_NAME}.lnk"
    !insertmacro DeleteLunaShortcut "$DESKTOP\${LUNA_DISPLAY_NAME}.lnk"
  ${EndIf}
!macroend
