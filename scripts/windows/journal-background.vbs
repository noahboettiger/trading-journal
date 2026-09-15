' Starts the trading journal with no visible window, so it runs quietly in the
' background and http://localhost:4317 simply works.
'
' To run it automatically every time you log in:
'   1. Press Windows key + R, type   shell:startup   and press Enter.
'   2. Right-click this file and choose Copy.
'      (On Windows 11 you may need "Show more options" to see everything.)
'   3. In the Startup window that opened, right-click an empty area and choose
'      "Paste shortcut". A plain Paste will not work: it would copy this file
'      out of the project and it would no longer find the rest of the code.
'
' After that, bookmark http://localhost:4317 and forget this exists.
'
' To stop it starting automatically, delete the shortcut from that folder.
' To stop it right now, double-click "Stop Journal.bat".
' Anything the server prints goes to data\server.log.

Option Explicit

Dim fso, shell, scriptDir, projectDir
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' This file lives in <project>\scripts\windows, so walk up two levels to the
' project root. Using the script's own location means the Startup shortcut
' keeps working no matter where the project folder is moved to.
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(fso.GetParentFolderName(scriptDir))

If Not fso.FileExists(fso.BuildPath(projectDir, "package.json")) Then
  MsgBox "Could not find the trading journal project." & vbCrLf & vbCrLf & _
         "Looked in: " & projectDir & vbCrLf & vbCrLf & _
         "If you pasted this file into the Startup folder, delete it and paste a " & _
         "SHORTCUT to it instead.", vbExclamation, "Trading Journal"
  WScript.Quit 1
End If

shell.CurrentDirectory = projectDir
shell.Run "cmd /c npm start >> ""data\server.log"" 2>&1", 0, False
