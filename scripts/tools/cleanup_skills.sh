#!/bin/bash

# lole Restaurant OS - Skills Cleanup Script
# This script removes unnecessary skills from the SKILLS folder
# based on the comprehensive audit for a SaaS restaurant platform

SKILLS_DIR="SKILLS"

echo "==================================================="
echo "  lole Restaurant OS - Skills Cleanup Script"
echo "==================================================="
echo ""
echo "This script will remove unnecessary skills while keeping"
echo "essential ones for building a multi-tenant SaaS platform."
echo ""

# Count total skills before cleanup
TOTAL_BEFORE=$(find "$SKILLS_DIR" -mindepth 2 -maxdepth 2 -type d | wc -l)
echo "Total skills before cleanup: $TOTAL_BEFORE"
echo ""

# ============================================
# 1. REMOVE ENTIRE SCIENTIFIC CATEGORY
# ============================================
echo "[1/10] Removing Scientific category (entire folder)..."
rm -rf "$SKILLS_DIR/scientific"
echo "  ✓ Removed scientific/ (~150 skills)"

# ============================================
# 2. REMOVE ENTIRE VIDEO CATEGORY
# ============================================
echo "[2/10] Removing Video category (entire folder)..."
rm -rf "$SKILLS_DIR/video"
echo "  ✓ Removed video/ (4 skills)"

# ============================================
# 3. REMOVE SENTRY CATEGORY (if not using Sentry)
# ============================================
echo "[3/10] Removing Sentry category..."
rm -rf "$SKILLS_DIR/sentry"
echo "  ✓ Removed sentry/ (6 skills)"

# ============================================
# 4. CLEANUP AI-RESEARCH - Keep only essential
# ============================================
echo "[4/10] Cleaning AI-Research category..."

# Keep these: llm-app-patterns, prompt-engineering, prompt-engineer, rag-implementation, rag-engineer
KEEP_AI_RESEARCH=(
    "llm-app-patterns"
    "prompt-engineering"
    "prompt-engineer"
    "rag-implementation"
    "rag-engineer"
    "prompt-library"
    "prompt-caching"
)

for dir in "$SKILLS_DIR/ai-research"/*/; do
    folder_name=$(basename "$dir")
    should_keep=false
    for keep in "${KEEP_AI_RESEARCH[@]}"; do
        if [[ "$folder_name" == "$keep" ]]; then
            should_keep=true
            break
        fi
    done
    if [[ "$should_keep" == false ]]; then
        rm -rf "$dir"
    fi
done

AI_REMAINING=$(find "$SKILLS_DIR/ai-research" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned ai-research/ (kept $AI_REMAINING essential skills)"

# ============================================
# 5. CLEANUP SECURITY - Remove offensive/red team
# ============================================
echo "[5/10] Cleaning Security category..."

REMOVE_SECURITY=(
    "active-directory-attacks"
    "aws-penetration-testing"
    "burp-suite-testing"
    "cloud-penetration-testing"
    "ethical-hacking-methodology"
    "linux-privilege-escalation"
    "metasploit-framework"
    "pentest-checklist"
    "pentest-commands"
    "privilege-escalation-methods"
    "red-team-tactics"
    "red-team-tools"
    "scanning-tools"
    "shodan-reconnaissance"
    "smtp-penetration-testing"
    "ssh-penetration-testing"
    "wireshark-analysis"
    "wordpress-penetration-testing"
    "windows-privilege-escalation"
    "sqlmap-database-pentesting"
    "api-fuzzing-bug-bounty"
    "broken-authentication"
    "file-path-traversal"
    "file-uploads"
    "html-injection-testing"
    "idor-testing"
    "xss-html-injection"
    "top-web-vulnerabilities"
)

for skill in "${REMOVE_SECURITY[@]}"; do
    rm -rf "$SKILLS_DIR/security/$skill"
done

SEC_REMAINING=$(find "$SKILLS_DIR/security" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned security/ (kept $SEC_REMAINING essential skills)"

# ============================================
# 6. CLEANUP ENTERPRISE-COMMUNICATION - Medical/regulatory
# ============================================
echo "[6/10] Cleaning Enterprise-Communication category..."

REMOVE_ENTERPRISE=(
    "fda-consultant-specialist"
    "mdr-745-specialist"
    "quality-manager-qms-iso13485"
    "quality-manager-qmr"
    "quality-documentation-manager"
    "qms-audit-expert"
    "isms-audit-expert"
    "risk-management-specialist"
    "regulatory-affairs-head"
    "capa-officer"
    "information-security-manager-iso27001"
    "clinical-decision-support"
    "clinical-reports"
    "internal-comms-anthropic"
    "internal-comms-community"
    "brand-guidelines"
    "slack-gif-creator"
    "discord-bot-architect"
)

for skill in "${REMOVE_ENTERPRISE[@]}"; do
    rm -rf "$SKILLS_DIR/enterprise-communication/$skill"
done

ENT_REMAINING=$(find "$SKILLS_DIR/enterprise-communication" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned enterprise-communication/ (kept $ENT_REMAINING essential skills)"

# ============================================
# 7. CLEANUP CREATIVE-DESIGN - Games/3D/art
# ============================================
echo "[7/10] Cleaning Creative-Design category..."

REMOVE_CREATIVE=(
    "game-development"
    "develop-web-game"
    "3d-web-experience"
    "algorithmic-art"
    "meme-factory"
    "interactive-portfolio"
    "scroll-experience"
    "theme-factory"
    "remotion-best-practices"
    "slack-gif-creator"
)

for skill in "${REMOVE_CREATIVE[@]}"; do
    rm -rf "$SKILLS_DIR/creative-design/$skill"
done

CRE_REMAINING=$(find "$SKILLS_DIR/creative-design" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned creative-design/ (kept $CRE_REMAINING essential skills)"

# ============================================
# 8. CLEANUP DOCUMENT-PROCESSING - Duplicates
# ============================================
echo "[8/10] Cleaning Document-Processing category..."

REMOVE_DOCS=(
    "docx-official"
    "pdf-official"
    "pptx-official"
    "xlsx-official"
    "pdf-anthropic"
    "doc"
    "docx"
    "pptx"
    "pptx-posters"
    "latex-posters"
    "json-canvas"
    "obsidian-bases"
    "obsidian-markdown"
)

for skill in "${REMOVE_DOCS[@]}"; do
    rm -rf "$SKILLS_DIR/document-processing/$skill"
done

DOC_REMAINING=$(find "$SKILLS_DIR/document-processing" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned document-processing/ (kept $DOC_REMAINING essential skills)"

# ============================================
# 9. CLEANUP PRODUCTIVITY - Personal tools
# ============================================
echo "[9/10] Cleaning Productivity category..."

REMOVE_PROD=(
    "invoice-organizer"
    "raffle-winner-picker"
    "obsidian-clipper-template-creator"
    "notion-knowledge-capture"
    "notion-meeting-intelligence"
    "notion-research-documentation"
    "notion-spec-to-implementation"
    "notion-template-business"
    "notebooklm"
    "meeting-insights-analyzer"
    "humanizer"
    "ship-learn-next"
    "nowait"
)

for skill in "${REMOVE_PROD[@]}"; do
    rm -rf "$SKILLS_DIR/productivity/$skill"
done

PROD_REMAINING=$(find "$SKILLS_DIR/productivity" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned productivity/ (kept $PROD_REMAINING essential skills)"

# ============================================
# 10. CLEANUP DEVELOPMENT - Unrelated tech
# ============================================
echo "[10/10] Cleaning Development category..."

REMOVE_DEV=(
    # .NET/Avalonia
    "avalonia-layout-zafiro"
    "avalonia-viewmodels-zafiro"
    "avalonia-zafiro-development"
    # Salesforce
    "salesforce-development"
    # Moodle
    "moodle-external-api-development"
    # Move language (blockchain)
    "move-code-quality"
    # Rust
    "rust-cli-builder"
    # WordPress/Plugins
    "plugin-forge"
    "plugin-settings"
    "plugin-structure"
    # Shopify
    # Keep hubspot and telegram for integrations
    # Remove duplicates and less relevant
    "heygen-best-practices"
    "cocoindex"
    "mcp-integration"
    "fastmcp-server"
    "skill-creation-guide"
    "skill-creator"
    "skill-developer"
    "skill-installer"
    "writing-skills"
    "writing-rules"
    "codex"
    "codex-review"
    "claude-opus-4-5-migration"
    "command-creator"
    "command-development"
    "hook-development"
    "web-artifacts-builder"
    "artifacts-builder"
    "using-superpowers"
    "using-git-worktrees"
    "receiving-code-requesting-code-review"
    "cc-skill-backend-patterns"
    "cc-skill-coding-standards"
    "cc-skill-continuous-learning"
    "cc-skill-frontend-patterns"
    "cc-skill-project-guidelines-example"
    "cc-skill-security-review"
    "cc-skill-strategic-compact"
    "changelog-generator"
    "dependency-updater"
    "environment-setup-guide"
    "finishing-a-development-branch"
    "gh-address-comments"
    "gh-fix-ci"
    "web-to-markdown"
    "screenshot-feature-extractor"
    "developer-growth-analysis"
)

for skill in "${REMOVE_DEV[@]}"; do
    rm -rf "$SKILLS_DIR/development/$skill"
done

DEV_REMAINING=$(find "$SKILLS_DIR/development" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned development/ (kept $DEV_REMAINING essential skills)"

# ============================================
# CLEANUP BUSINESS-MARKETING - Not applicable
# ============================================
echo "[Bonus] Cleaning Business-Marketing category..."

REMOVE_BIZ=(
    "viral-generator-builder"
    "meme-factory"
    "shopify-apps"
    "competitor-alternatives"
    "competitive-ads-extractor"
    "brand-guidelines-anthropic"
    "brand-guidelines-community"
    "free-tool-strategy"
    "marketing-ideas"
    "marketing-psychology"
    "marketing-demand-acquisition"
    "content-research-writer"
    "copy-editing"
    "popup-cro"
    "page-cro"
    "form-cro"
    "paywall-upgrade-cro"
    "programmatic-seo"
    "schema-markup"
    "seo-audit"
    "lead-research-assistant"
    "ceo-advisor"
    "cto-advisor"
    "ai-product"
    "ai-wrapper-product"
)

for skill in "${REMOVE_BIZ[@]}"; do
    rm -rf "$SKILLS_DIR/business-marketing/$skill"
done

BIZ_REMAINING=$(find "$SKILLS_DIR/business-marketing" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned business-marketing/ (kept $BIZ_REMAINING essential skills)"

# ============================================
# CLEANUP MEDIA
# ============================================
echo "[Bonus] Cleaning Media category..."

REMOVE_MEDIA=(
    "video-downloader"
    "image-enhancer"
    "screenshot"
    "transcribe"
)

for skill in "${REMOVE_MEDIA[@]}"; do
    rm -rf "$SKILLS_DIR/media/$skill"
done

MED_REMAINING=$(find "$SKILLS_DIR/media" -mindepth 1 -maxdepth 1 -type d | wc -l 2>/dev/null || echo "0")
echo "  ✓ Cleaned media/ (kept $MED_REMAINING essential skills)"

# ============================================
# CLEANUP WORKFLOW-AUTOMATION
# ============================================
echo "[Bonus] Cleaning Workflow-Automation category..."

REMOVE_WORKFLOW=(
    "n8n"
    "zapier-make-patterns"
    "trigger-dev"
    "inngest"
    "yeet"
    "planning-with-files"
    "workflow-automation"
)

for skill in "${REMOVE_WORKFLOW[@]}"; do
    rm -rf "$SKILLS_DIR/workflow-automation/$skill"
done

WORK_REMAINING=$(find "$SKILLS_DIR/workflow-automation" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned workflow-automation/ (kept $WORK_REMAINING essential skills)"

# ============================================
# CLEANUP UTILITIES
# ============================================
echo "[Bonus] Cleaning Utilities category..."

REMOVE_UTIL=(
    "busybox-on-windows"
    "domain-name-brainstormer"
    "geo-fundamentals"
    "network-101"
    "web-artifacts-builder"
    "template-skill"
    "skill-share"
)

for skill in "${REMOVE_UTIL[@]}"; do
    rm -rf "$SKILLS_DIR/utilities/$skill"
done

UTIL_REMAINING=$(find "$SKILLS_DIR/utilities" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned utilities/ (kept $UTIL_REMAINING essential skills)"

# ============================================
# CLEANUP WEB-DEVELOPMENT
# ============================================
echo "[Bonus] Cleaning Web-Development category..."

REMOVE_WEB=(
    "shopify-development"
    "shopify-apps"
    "blockrun"
    "segment-cdp"
    "upstash-qstash"
    "roier-seo"
)

for skill in "${REMOVE_WEB[@]}"; do
    rm -rf "$SKILLS_DIR/web-development/$skill"
done

WEB_REMAINING=$(find "$SKILLS_DIR/web-development" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "  ✓ Cleaned web-development/ (kept $WEB_REMAINING essential skills)"

# ============================================
# CLEANUP DESIGN-TO-CODE
# ============================================
echo "[Bonus] Removing Design-to-Code category..."
rm -rf "$SKILLS_DIR/design-to-code"
echo "  ✓ Removed design-to-code/"

# ============================================
# CLEANUP RAILWAY (if not using Railway)
# ============================================
echo "[Bonus] Removing Railway category..."
rm -rf "$SKILLS_DIR/railway"
echo "  ✓ Removed railway/"

# ============================================
# FINAL SUMMARY
# ============================================
echo ""
echo "==================================================="
echo "                   CLEANUP COMPLETE"
echo "==================================================="

TOTAL_AFTER=$(find "$SKILLS_DIR" -mindepth 2 -maxdepth 2 -type d | wc -l)
REMOVED=$((TOTAL_BEFORE - TOTAL_AFTER))

echo ""
echo "Skills before cleanup: $TOTAL_BEFORE"
echo "Skills after cleanup:  $TOTAL_AFTER"
echo "Skills removed:        $REMOVED"
echo ""
echo "Remaining skills by category:"
echo "  • ai-research:            $AI_REMAINING"
echo "  • business-marketing:     $BIZ_REMAINING"
echo "  • creative-design:        $CRE_REMAINING"
echo "  • database:               (all kept)"
echo "  • development:            $DEV_REMAINING"
echo "  • document-processing:    $DOC_REMAINING"
echo "  • enterprise-communication: $ENT_REMAINING"
echo "  • media:                  $MED_REMAINING"
echo "  • productivity:           $PROD_REMAINING"
echo "  • security:               $SEC_REMAINING"
echo "  • utilities:              $UTIL_REMAINING"
echo "  • web-development:        $WEB_REMAINING"
echo "  • workflow-automation:    $WORK_REMAINING"
echo ""
echo "✅ Cleanup complete! Your SKILLS folder is now optimized."
echo "==================================================="