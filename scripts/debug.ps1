# Playwright Inspector で scraping.spec.js をステップ実行
# 使い方: .\scripts\debug.ps1

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-paths.ps1"

if (-not (Test-Path $ProjectPath)) {
    Write-Host "プロジェクトが見つかりません: $ProjectPath"
    Write-Host "  net use U: \\wsl`$`Ubuntu"
    exit 1
}

Set-Location $ProjectPath
Write-Host "Playwright Inspector を起動します (ステップ実行モード)..."
npx playwright test scraping/scraping.spec.js --debug --workers=1
