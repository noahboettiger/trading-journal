' Starts the trading journal with no visible window, so it can run quietly in
' the background from Windows startup.
'
' To run the journal automatically every time you log in:
'   1. Press Windows key + R, type   shell:startup   and press Enter.
'   2. Right-click this file, choose Copy.
'   3. In the Startup window that opened, right-click and choose
'      "Paste shortcut" (not plain Paste).
'
' After that, http://localhost:4317 just works. Bookmark it.
'
' To stop it starting automatically, delete the shortcut from that folder.
' Anything the server prints is written to data\server.log.

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' This file lives in <project>\scripts\windows, so walk up two levels.
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(fso.GetParentFolderName(scriptDir))

shell.CurrentDirectory = projectDir
shell.Run "cmd /c npm start >> ""data\server.log"" 2>&1", 0, False
