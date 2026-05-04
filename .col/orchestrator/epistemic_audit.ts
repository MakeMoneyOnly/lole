import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const WIKI_ENTITIES_DIR = path.join(__dirname, '../memory/wiki/entities');
const SRC_DIR = path.join(__dirname, '../../src');

// Helper to safely execute ripgrep or fallback to grep
function searchCodebase(keyword: string): string[] {
    try {
        // Search for the keyword inside the src directory, return file paths
        // We use grep -rl or a similar cross-platform approach.
        // For Node.js across platforms, a simple recursive read can work, but exec is faster if ripgrep/grep is available.
        // In Windows, findstr can be used, but since this runs in various environments, let's do a simple node-based search for reliability.
        return findFilesWithKeyword(SRC_DIR, keyword);
    } catch (e) {
        return [];
    }
}

function findFilesWithKeyword(dir: string, keyword: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            findFilesWithKeyword(filePath, keyword, fileList);
        } else if (
            filePath.endsWith('.ts') ||
            filePath.endsWith('.tsx') ||
            filePath.endsWith('.js')
        ) {
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.toLowerCase().includes(keyword.toLowerCase())) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
}

function runAudit() {
    console.log('🚀 Starting Automated Epistemic Audit...');

    if (!fs.existsSync(WIKI_ENTITIES_DIR)) {
        console.error('❌ Wiki entities directory not found.');
        return;
    }

    const entityFiles = fs.readdirSync(WIKI_ENTITIES_DIR).filter(f => f.endsWith('.md'));

    let totalFindings = 0;

    for (const file of entityFiles) {
        const filePath = path.join(WIKI_ENTITIES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract coreSkills from frontmatter
        const coreSkillsMatch = content.match(/coreSkills:\s*\[(.*?)\]/);
        if (!coreSkillsMatch) continue;

        const skillsStr = coreSkillsMatch[1];
        // Parse skills, removing quotes
        const skills = skillsStr.split(',').map(s => s.trim().replace(/"/g, '').replace(/'/g, ''));

        let boundaries = '## Codebase Boundaries\n';
        const foundFiles = new Set<string>();

        // We use parts of the skills as keywords
        for (const skill of skills) {
            // Split skill by hyphen and use significant words > 3 chars
            const keywords = skill.split('-').filter(k => k.length > 3);
            for (const kw of keywords) {
                const matches = searchCodebase(kw);
                matches.forEach(m => foundFiles.add(m));
            }
        }

        const relativeFiles = Array.from(foundFiles).map(f =>
            path.relative(path.join(__dirname, '../../'), f)
        );

        if (relativeFiles.length > 0) {
            boundaries += `Based on the \`coreSkills\` mapped to this functional unit, the following codebase boundaries were identified during the audit:\n\n`;
            relativeFiles.slice(0, 10).forEach(f => {
                boundaries += `- \`${f}\`\n`;
            });
            if (relativeFiles.length > 10) {
                boundaries += `- *...and ${relativeFiles.length - 10} more files.*\n`;
            }
            totalFindings += relativeFiles.length;
        } else {
            boundaries += `> [!WARNING] Implementation Gap\n> No direct codebase boundaries were found matching the expected skills. This may indicate technical debt or an undocumented integration.\n`;
        }

        // Replace the existing Codebase Boundaries section
        const newContent = content.replace(
            /## Codebase Boundaries[\s\S]*?(?=## Current State & Capabilities)/,
            boundaries + '\n'
        );

        fs.writeFileSync(filePath, newContent);
        console.log(`✅ Audited ${file} (Found ${relativeFiles.length} file mappings)`);
    }

    // Log the audit in the Wiki Log
    const logPath = path.join(__dirname, '../memory/wiki/log.md');
    if (fs.existsSync(logPath)) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const logEntry = `\n## [${timestamp}] lint | Epistemic Audit\n- Ran codebase boundary sweeps across all 23 functional units.\n- Mapped ${totalFindings} files to Wiki entities based on core skill keywords.\n`;
        fs.appendFileSync(logPath, logEntry);
    }

    console.log('🎉 Epistemic Audit complete. Wiki updated.');
}

runAudit();
