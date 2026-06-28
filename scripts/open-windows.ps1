# U: ドライブから Cursor で開く（ブレークポイントのパス不一致を防ぐ）
. "$PSScriptRoot\windows-paths.ps1"

if (-not (Test-Path $ProjectPath)) {
    Write-Host "プロジェクトが見つかりません: $ProjectPath"
    Write-Host "  net use U: \\wsl`$`Ubuntu"
    exit 1
}

Write-Host ""
Write-Host "ブレークポイントを使う場合は、次のフォルダを Cursor で開いてください:"
Write-Host "  $ProjectPath"
Write-Host ""
Write-Host "Cursor を開く例:"
Write-Host "  cursor `"$ProjectPath`""
