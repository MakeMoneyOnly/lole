# lole Restaurant OS - Skills Cleanup Script V2
# This script removes the new redundant folders and cleans up remaining irrelevant skills

$SkillsDir = "SKILLS"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  lole Restaurant OS - Skills Cleanup Script V2" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1. DELETE agents-main FOLDER (not using Claude Code Plugins)
# ============================================
Write-Host "[1/5] Removing agents-main folder..." -ForegroundColor White
Remove-Item -Path "$SkillsDir\agents-main" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  [OK] Removed agents-main/" -ForegroundColor Green

# ============================================
# 2. EXTRACT NEW MARKETING SKILLS from marketingskills-main
# ============================================
Write-Host "[2/5] Extracting new marketing skills..." -ForegroundColor White

$NewMarketingSkills = @(
    "content-strategy",
    "copy-editing",
    "form-cro",
    "page-cro",
    "paywall-upgrade-cro",
    "product-marketing-context",
    "programmatic-seo",
    "schema-markup",
    "seo-audit"
)

foreach ($skill in $NewMarketingSkills) {
    $sourcePath = "$SkillsDir\marketingskills-main\skills\$skill"
    $destPath = "$SkillsDir\business-marketing\$skill"
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Added: $skill" -ForegroundColor Green
    }
}

# ============================================
# 3. DELETE marketingskills-main FOLDER (duplicates extracted)
# ============================================
Write-Host "[3/5] Removing marketingskills-main folder..." -ForegroundColor White
Remove-Item -Path "$SkillsDir\marketingskills-main" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  [OK] Removed marketingskills-main/" -ForegroundColor Green

# ============================================
# 4. CLEANUP CREATIVE-DESIGN - Remove irrelevant skills
# ============================================
Write-Host "[4/5] Cleaning creative-design folder..." -ForegroundColor White

$RemoveCreativeDesign = @(
    "canvas-design",
    "claude-d3js-skill",
    "draw-io",
    "imagegen",
    "marp-slide",
    "slack-gif-creator"
)

foreach ($skill in $RemoveCreativeDesign) {
    Remove-Item -Path "$SkillsDir\creative-design\$skill" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Removed: $skill" -ForegroundColor Yellow
}

$CreRemaining = (Get-ChildItem -Path "$SkillsDir\creative-design" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [DONE] Cleaned creative-design/ (kept $CreRemaining skills)" -ForegroundColor Green

# ============================================
# 5. CLEANUP ALL OTHER FOLDERS
# ============================================
Write-Host "[5/5] Cleaning all remaining folders..." -ForegroundColor White

# Productivity - Remove skill creation/writing related
$RemoveProductivity = @(
    "skill-creator",
    "skill-developer",
    "skill-judge",
    "writing-plans",
    "writing-rules",
    "writing-skills",
    "linear"
)

foreach ($skill in $RemoveProductivity) {
    Remove-Item -Path "$SkillsDir\productivity\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}
$ProdRemaining = (Get-ChildItem -Path "$SkillsDir\productivity" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned productivity/ (kept $ProdRemaining skills)" -ForegroundColor Green

# Development - Remove non-tech-stack skills
$RemoveDevelopment = @(
    "algolia-search",
    "aws-serverless",
    "azure-functions",
    "bun-development",
    "cc-skill-clickhouse-io",
    "cloudflare-deploy",
    "firebase",
    "gcp-cloud-run",
    "jupyter-notebook",
    "mui",
    "neon-postgres",
    "netlify-deploy",
    "powershell-windows",
    "render-deploy",
    "senior-computer-vision",
    "senior-data-engineer",
    "senior-data-scientist",
    "senior-ml-engineer",
    "zapier-workflows",
    "plaid-fintech",
    "agent-development",
    "agent-md-refactor",
    "dispatching-parallel-agents",
    "mcp-builder",
    "subagent-driven-development",
    "task-execution-engine",
    "verification-before-completion"
)

foreach ($skill in $RemoveDevelopment) {
    Remove-Item -Path "$SkillsDir\development\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}
$DevRemaining = (Get-ChildItem -Path "$SkillsDir\development" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned development/ (kept $DevRemaining skills)" -ForegroundColor Green

# Document-Processing - Keep only essential
$KeepDocumentProcessing = @(
    "pdf-processing",
    "xlsx",
    "spreadsheet"
)

$DocFolders = Get-ChildItem -Path "$SkillsDir\document-processing" -Directory -ErrorAction SilentlyContinue
foreach ($folder in $DocFolders) {
    if ($KeepDocumentProcessing -notcontains $folder.Name) {
        Remove-Item -Path $folder.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}
$DocRemaining = (Get-ChildItem -Path "$SkillsDir\document-processing" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned document-processing/ (kept $DocRemaining skills)" -ForegroundColor Green

# Enterprise-Communication - Remove medical/regulatory
$RemoveEnterprise = @(
    "clinical-decision-support",
    "clinical-reports",
    "internal-comms-anthropic",
    "internal-comms-community",
    "brand-guidelines",
    "slack-gif-creator",
    "discord-bot-architect"
)

foreach ($skill in $RemoveEnterprise) {
    Remove-Item -Path "$SkillsDir\enterprise-communication\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}
$EntRemaining = (Get-ChildItem -Path "$SkillsDir\enterprise-communication" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned enterprise-communication/ (kept $EntRemaining skills)" -ForegroundColor Green

# Utilities - Keep only essential
$KeepUtilities = @(
    "browser-automation",
    "playwright-skill"
)

$UtilFolders = Get-ChildItem -Path "$SkillsDir\utilities" -Directory -ErrorAction SilentlyContinue
foreach ($folder in $UtilFolders) {
    if ($KeepUtilities -notcontains $folder.Name) {
        Remove-Item -Path $folder.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}
$UtilRemaining = (Get-ChildItem -Path "$SkillsDir\utilities" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned utilities/ (kept $UtilRemaining skills)" -ForegroundColor Green

# Web-Development - Remove non-relevant
$RemoveWebDev = @(
    "shopify-development",
    "shopify-apps",
    "segment-cdp",
    "upstash-qstash"
)

foreach ($skill in $RemoveWebDev) {
    Remove-Item -Path "$SkillsDir\web-development\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}
$WebRemaining = (Get-ChildItem -Path "$SkillsDir\web-development" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned web-development/ (kept $WebRemaining skills)" -ForegroundColor Green

# ============================================
# FINAL SUMMARY
# ============================================
Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "                   CLEANUP COMPLETE" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$TotalSkills = (Get-ChildItem -Path $SkillsDir -Directory -Recurse | Where-Object { $_.Parent.Parent.Name -eq $SkillsDir }).Count

Write-Host ""
Write-Host "Final skills count: $TotalSkills" -ForegroundColor Yellow
Write-Host ""
Write-Host "Remaining skills by category:" -ForegroundColor White

$Categories = Get-ChildItem -Path $SkillsDir -Directory -ErrorAction SilentlyContinue
foreach ($cat in $Categories) {
    $count = (Get-ChildItem -Path $cat.FullName -Directory -ErrorAction SilentlyContinue).Count
    Write-Host "  - $($cat.Name): $count skills"
}

Write-Host ""
Write-Host "[SUCCESS] Cleanup complete! Your SKILLS folder is optimized." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan