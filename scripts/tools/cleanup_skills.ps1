# lole Restaurant OS - Skills Cleanup Script (PowerShell)
# This script removes unnecessary skills from the SKILLS folder
# based on the comprehensive audit for a SaaS restaurant platform

$SkillsDir = "SKILLS"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  lole Restaurant OS - Skills Cleanup Script" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will remove unnecessary skills while keeping"
Write-Host "essential ones for building a multi-tenant SaaS platform."
Write-Host ""

# Count total skills before cleanup
$TotalBefore = (Get-ChildItem -Path $SkillsDir -Directory -Recurse | Where-Object { $_.Parent.Parent.Name -eq $SkillsDir }).Count
Write-Host "Total skills before cleanup: $TotalBefore" -ForegroundColor Yellow
Write-Host ""

# ============================================
# 1. REMOVE ENTIRE SCIENTIFIC CATEGORY
# ============================================
Write-Host "[1/10] Removing Scientific category (entire folder)..." -ForegroundColor White
Remove-Item -Path "$SkillsDir\scientific" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  [OK] Removed scientific/ (~150 skills)" -ForegroundColor Green

# ============================================
# 2. REMOVE ENTIRE VIDEO CATEGORY
# ============================================
Write-Host "[2/10] Removing Video category (entire folder)..." -ForegroundColor White
Remove-Item -Path "$SkillsDir\video" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  [OK] Removed video/ (4 skills)" -ForegroundColor Green

# ============================================
# 3. REMOVE SENTRY CATEGORY
# ============================================
Write-Host "[3/10] Removing Sentry category..." -ForegroundColor White
Remove-Item -Path "$SkillsDir\sentry" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  [OK] Removed sentry/ (6 skills)" -ForegroundColor Green

# ============================================
# 4. CLEANUP AI-RESEARCH - Keep only essential
# ============================================
Write-Host "[4/10] Cleaning AI-Research category..." -ForegroundColor White

$KeepAiResearch = @(
    "llm-app-patterns",
    "prompt-engineering",
    "prompt-engineer",
    "rag-implementation",
    "rag-engineer",
    "prompt-library",
    "prompt-caching"
)

$AiFolders = Get-ChildItem -Path "$SkillsDir\ai-research" -Directory -ErrorAction SilentlyContinue
foreach ($folder in $AiFolders) {
    if ($KeepAiResearch -notcontains $folder.Name) {
        Remove-Item -Path $folder.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$AiRemaining = (Get-ChildItem -Path "$SkillsDir\ai-research" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned ai-research/ (kept $AiRemaining essential skills)" -ForegroundColor Green

# ============================================
# 5. CLEANUP SECURITY - Remove offensive/red team
# ============================================
Write-Host "[5/10] Cleaning Security category..." -ForegroundColor White

$RemoveSecurity = @(
    "active-directory-attacks",
    "aws-penetration-testing",
    "burp-suite-testing",
    "cloud-penetration-testing",
    "ethical-hacking-methodology",
    "linux-privilege-escalation",
    "metasploit-framework",
    "pentest-checklist",
    "pentest-commands",
    "privilege-escalation-methods",
    "red-team-tactics",
    "red-team-tools",
    "scanning-tools",
    "shodan-reconnaissance",
    "smtp-penetration-testing",
    "ssh-penetration-testing",
    "wireshark-analysis",
    "wordpress-penetration-testing",
    "windows-privilege-escalation",
    "sqlmap-database-pentesting",
    "api-fuzzing-bug-bounty",
    "broken-authentication",
    "file-path-traversal",
    "file-uploads",
    "html-injection-testing",
    "idor-testing",
    "xss-html-injection",
    "top-web-vulnerabilities"
)

foreach ($skill in $RemoveSecurity) {
    Remove-Item -Path "$SkillsDir\security\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}

$SecRemaining = (Get-ChildItem -Path "$SkillsDir\security" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned security/ (kept $SecRemaining essential skills)" -ForegroundColor Green

# ============================================
# 6. CLEANUP ENTERPRISE-COMMUNICATION
# ============================================
Write-Host "[6/10] Cleaning Enterprise-Communication category..." -ForegroundColor White

$RemoveEnterprise = @(
    "fda-consultant-specialist",
    "mdr-745-specialist",
    "quality-manager-qms-iso13485",
    "quality-manager-qmr",
    "quality-documentation-manager",
    "qms-audit-expert",
    "isms-audit-expert",
    "risk-management-specialist",
    "regulatory-affairs-head",
    "capa-officer",
    "information-security-manager-iso27001",
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
Write-Host "  [OK] Cleaned enterprise-communication/ (kept $EntRemaining essential skills)" -ForegroundColor Green

# ============================================
# 7. CLEANUP CREATIVE-DESIGN
# ============================================
Write-Host "[7/10] Cleaning Creative-Design category..." -ForegroundColor White

$RemoveCreative = @(
    "game-development",
    "develop-web-game",
    "3d-web-experience",
    "algorithmic-art",
    "meme-factory",
    "interactive-portfolio",
    "scroll-experience",
    "theme-factory",
    "remotion-best-practices"
)

foreach ($skill in $RemoveCreative) {
    Remove-Item -Path "$SkillsDir\creative-design\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}

$CreRemaining = (Get-ChildItem -Path "$SkillsDir\creative-design" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned creative-design/ (kept $CreRemaining essential skills)" -ForegroundColor Green

# ============================================
# 8. CLEANUP DOCUMENT-PROCESSING
# ============================================
Write-Host "[8/10] Cleaning Document-Processing category..." -ForegroundColor White

$RemoveDocs = @(
    "docx-official",
    "pdf-official",
    "pptx-official",
    "xlsx-official",
    "pdf-anthropic",
    "doc",
    "docx",
    "pptx",
    "pptx-posters",
    "latex-posters",
    "json-canvas",
    "obsidian-bases",
    "obsidian-markdown"
)

foreach ($skill in $RemoveDocs) {
    Remove-Item -Path "$SkillsDir\document-processing\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}

$DocRemaining = (Get-ChildItem -Path "$SkillsDir\document-processing" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned document-processing/ (kept $DocRemaining essential skills)" -ForegroundColor Green

# ============================================
# 9. CLEANUP PRODUCTIVITY
# ============================================
Write-Host "[9/10] Cleaning Productivity category..." -ForegroundColor White

$RemoveProd = @(
    "invoice-organizer",
    "raffle-winner-picker",
    "obsidian-clipper-template-creator",
    "notion-knowledge-capture",
    "notion-meeting-intelligence",
    "notion-research-documentation",
    "notion-spec-to-implementation",
    "notion-template-business",
    "notebooklm",
    "meeting-insights-analyzer",
    "humanizer",
    "ship-learn-next",
    "nowait"
)

foreach ($skill in $RemoveProd) {
    Remove-Item -Path "$SkillsDir\productivity\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}

$ProdRemaining = (Get-ChildItem -Path "$SkillsDir\productivity" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned productivity/ (kept $ProdRemaining essential skills)" -ForegroundColor Green

# ============================================
# 10. CLEANUP DEVELOPMENT
# ============================================
Write-Host "[10/10] Cleaning Development category..." -ForegroundColor White

$RemoveDev = @(
    "avalonia-layout-zafiro",
    "avalonia-viewmodels-zafiro",
    "avalonia-zafiro-development",
    "salesforce-development",
    "moodle-external-api-development",
    "move-code-quality",
    "rust-cli-builder",
    "plugin-forge",
    "plugin-settings",
    "plugin-structure",
    "heygen-best-practices",
    "cocoindex",
    "mcp-integration",
    "fastmcp-server",
    "skill-creation-guide",
    "skill-creator",
    "skill-developer",
    "skill-installer",
    "writing-skills",
    "writing-rules",
    "codex",
    "codex-review",
    "claude-opus-4-5-migration",
    "command-creator",
    "command-development",
    "hook-development",
    "web-artifacts-builder",
    "artifacts-builder",
    "using-superpowers",
    "using-git-worktrees",
    "receiving-code-requesting-code-review",
    "cc-skill-backend-patterns",
    "cc-skill-coding-standards",
    "cc-skill-continuous-learning",
    "cc-skill-frontend-patterns",
    "cc-skill-project-guidelines-example",
    "cc-skill-security-review",
    "cc-skill-strategic-compact",
    "changelog-generator",
    "dependency-updater",
    "environment-setup-guide",
    "finishing-a-development-branch",
    "gh-address-comments",
    "gh-fix-ci",
    "web-to-markdown",
    "screenshot-feature-extractor",
    "developer-growth-analysis"
)

foreach ($skill in $RemoveDev) {
    Remove-Item -Path "$SkillsDir\development\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}

$DevRemaining = (Get-ChildItem -Path "$SkillsDir\development" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned development/ (kept $DevRemaining essential skills)" -ForegroundColor Green

# ============================================
# BONUS CLEANUPS
# ============================================
Write-Host ""
Write-Host "[Bonus] Cleaning additional categories..." -ForegroundColor White

# Business-Marketing
$RemoveBiz = @(
    "viral-generator-builder",
    "shopify-apps",
    "competitor-alternatives",
    "competitive-ads-extractor",
    "brand-guidelines-anthropic",
    "brand-guidelines-community",
    "free-tool-strategy",
    "marketing-ideas",
    "marketing-psychology",
    "marketing-demand-acquisition",
    "content-research-writer",
    "copy-editing",
    "popup-cro",
    "page-cro",
    "form-cro",
    "paywall-upgrade-cro",
    "programmatic-seo",
    "schema-markup",
    "seo-audit",
    "lead-research-assistant",
    "ceo-advisor",
    "cto-advisor",
    "ai-product",
    "ai-wrapper-product"
)

foreach ($skill in $RemoveBiz) {
    Remove-Item -Path "$SkillsDir\business-marketing\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}

$BizRemaining = (Get-ChildItem -Path "$SkillsDir\business-marketing" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned business-marketing/ (kept $BizRemaining essential skills)" -ForegroundColor Green

# Media
$RemoveMedia = @(
    "video-downloader",
    "image-enhancer",
    "screenshot",
    "transcribe"
)

foreach ($skill in $RemoveMedia) {
    Remove-Item -Path "$SkillsDir\media\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}

$MedRemaining = (Get-ChildItem -Path "$SkillsDir\media" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned media/ (kept $MedRemaining essential skills)" -ForegroundColor Green

# Workflow-Automation
$RemoveWorkflow = @(
    "n8n",
    "zapier-make-patterns",
    "trigger-dev",
    "inngest",
    "yeet",
    "planning-with-files",
    "workflow-automation"
)

foreach ($skill in $RemoveWorkflow) {
    Remove-Item -Path "$SkillsDir\workflow-automation\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}

$WorkRemaining = (Get-ChildItem -Path "$SkillsDir\workflow-automation" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned workflow-automation/ (kept $WorkRemaining essential skills)" -ForegroundColor Green

# Utilities
$RemoveUtil = @(
    "busybox-on-windows",
    "domain-name-brainstormer",
    "geo-fundamentals",
    "network-101",
    "web-artifacts-builder",
    "template-skill",
    "skill-share"
)

foreach ($skill in $RemoveUtil) {
    Remove-Item -Path "$SkillsDir\utilities\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}

$UtilRemaining = (Get-ChildItem -Path "$SkillsDir\utilities" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned utilities/ (kept $UtilRemaining essential skills)" -ForegroundColor Green

# Web-Development
$RemoveWeb = @(
    "shopify-development",
    "shopify-apps",
    "blockrun",
    "segment-cdp",
    "upstash-qstash",
    "roier-seo"
)

foreach ($skill in $RemoveWeb) {
    Remove-Item -Path "$SkillsDir\web-development\$skill" -Recurse -Force -ErrorAction SilentlyContinue
}

$WebRemaining = (Get-ChildItem -Path "$SkillsDir\web-development" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "  [OK] Cleaned web-development/ (kept $WebRemaining essential skills)" -ForegroundColor Green

# Design-to-Code
Remove-Item -Path "$SkillsDir\design-to-code" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  [OK] Removed design-to-code/" -ForegroundColor Green

# Railway
Remove-Item -Path "$SkillsDir\railway" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  [OK] Removed railway/" -ForegroundColor Green

# ============================================
# FINAL SUMMARY
# ============================================
Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "                   CLEANUP COMPLETE" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$TotalAfter = (Get-ChildItem -Path $SkillsDir -Directory -Recurse | Where-Object { $_.Parent.Parent.Name -eq $SkillsDir }).Count
$Removed = $TotalBefore - $TotalAfter

Write-Host ""
Write-Host "Skills before cleanup: $TotalBefore" -ForegroundColor Yellow
Write-Host "Skills after cleanup:  $TotalAfter" -ForegroundColor Yellow
Write-Host "Skills removed:        $Removed" -ForegroundColor Green
Write-Host ""
Write-Host "Remaining skills by category:" -ForegroundColor White
Write-Host "  - ai-research:              $AiRemaining"
Write-Host "  - analytics:                (all kept)"
Write-Host "  - business-marketing:       $BizRemaining"
Write-Host "  - creative-design:          $CreRemaining"
Write-Host "  - database:                 (all kept)"
Write-Host "  - development:              $DevRemaining"
Write-Host "  - document-processing:      $DocRemaining"
Write-Host "  - enterprise-communication: $EntRemaining"
Write-Host "  - media:                    $MedRemaining"
Write-Host "  - productivity:             $ProdRemaining"
Write-Host "  - security:                 $SecRemaining"
Write-Host "  - utilities:                $UtilRemaining"
Write-Host "  - web-development:          $WebRemaining"
Write-Host "  - workflow-automation:      $WorkRemaining"
Write-Host ""
Write-Host "[SUCCESS] Cleanup complete! Your SKILLS folder is now optimized." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan