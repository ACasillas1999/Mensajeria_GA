$file = "src\components\ChatPane.jsx"
$content = Get-Content $file -Raw

# Reemplazar burbujas de mensajes
$content = $content -replace "ml-auto bg-emerald-600/20 border-emerald-700", "ml-auto bg-emerald-100 dark:bg-emerald-600/20 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-50"
$content = $content -replace "'bg-slate-800 border-slate-700'}", "'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'}"

Set-Content $file $content -NoNewline

Write-Host "✅ Burbujas de mensajes arregladas!" -ForegroundColor Green
Write-Host "Reinicia el servidor: npm run dev" -ForegroundColor Cyan
