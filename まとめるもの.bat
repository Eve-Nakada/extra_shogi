@echo off
setlocal enabledelayedexpansion

rem バッチファイルがあるディレクトリを取得
set "baseDir=%~dp0"

echo 処理を開始します...

rem 全ての下位フォルダを再帰的にループ
for /d /r %%D in (*) do (
    set "targetDir=%%D"
    set "folderName=%%~nxD"
    
    rem フォルダ内にjsファイルが存在するか確認
    if exist "%%D\*.js" (
        echo フォルダを処理中: !folderName!
        
        rem 出力先ファイルパス（バッチファイルと同じ階層）
        set "outputFile=%baseDir%!folderName!.txt"
        
        rem 出力ファイルを初期化（既存があれば上書き）
        if exist "!outputFile!" del "!outputFile!"

        rem フォルダ内の各jsファイルを一つずつ処理
        for %%F in ("%%D\*.js") do (
            echo ========================================== >> "!outputFile!"
            echo FILE: %%~nxF >> "!outputFile!"
            echo ========================================== >> "!outputFile!"
            echo. >> "!outputFile!"
            
            rem ファイルの内容を結合
            type "%%F" >> "!outputFile!"
            
            rem 可読性のために改行を追加
            echo. >> "!outputFile!"
            echo. >> "!outputFile!"
        )
    )
)

echo 完了しました。
pause
