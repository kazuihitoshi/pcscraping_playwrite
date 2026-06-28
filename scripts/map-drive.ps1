# U: ドライブ（net use U: \\wsl$\Ubuntu）のマウントを確認する
. "$PSScriptRoot\windows-paths.ps1"

if (-not (Test-Path $ProjectPath)) {
    Write-Host "プロジェクトが見つかりません: $ProjectPath"
    Write-Host ""
    Write-Host "次のコマンドで U: をマップしてください:"
    Write-Host "  net use U: \\wsl`$`Ubuntu"
    exit 1
}

Write-Host "U: ドライブ経由でプロジェクトを確認しました"
Write-Host "プロジェクトパス: $ProjectPath"
