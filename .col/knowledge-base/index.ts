// Knowledge Base - Recursive Documentation Ingestion
// Parses, chunks, and vectorizes all docs/ for contextual intelligence

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface DocChunk {
    id: string;
    source: string;
    title: string;
    content: string;
    section: string;
    domain: string;
    tokens: number;
    embedding?: number[];
}

interface EmbeddingVector {
    [docId: string]: {
        embedding: number[];
        chunks: string[];
    };
}

export class KnowledgeBase {
    private docDir: string;
    private chunks: DocChunk[] = [];
    private embeddings: EmbeddingVector = {};
    private dimensions = 1536;

    constructor(private techConfig?: { domains: string[] }) {
        this.docDir = path.join(process.cwd(), 'docs');
    }

    async ingestDocs(): Promise<void> {
        console.log(`📚 Ingesting docs from ${this.docDir}...`);
        const allDocs = this.findAllDocs(this.docDir);
        console.log(`📄 Found ${allDocs.length} documentation files`);

        for (const docPath of allDocs) {
            await this.processDoc(docPath);
        }

        await this.generateEmbeddings();
        await this.saveKnowledgeBase();
        console.log(`✅ Ingested ${this.chunks.length} knowledge chunks`);
    }

    private findAllDocs(dir: string): string[] {
        const files: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...this.findAllDocs(fullPath));
            } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
                files.push(fullPath);
            }
        }
        return files;
    }

    private async processDoc(docPath: string): Promise<void> {
        const content = fs.readFileSync(docPath, 'utf-8');
        const relativePath = path.relative(process.cwd(), docPath);
        const domain = this.extractDomain(relativePath);
        const sections = this.extractSections(content);

        for (const section of sections) {
            const chunks = this.chunkText(section.content, 500, 50);
            for (let i = 0; i < chunks.length; i++) {
                this.chunks.push({
                    id: `${relativePath}-${section.heading}-${i}`,
                    source: relativePath,
                    title: section.heading || path.basename(relativePath, '.md'),
                    content: chunks[i],
                    section: section.heading,
                    domain,
                    tokens: Math.ceil(chunks[i].length / 4),
                });
            }
        }
    }

    private extractDomain(relativePath: string): string {
        const normalizedPath = relativePath.split(/[/\\]/);
        if (normalizedPath.length > 2) {
            const section = normalizedPath[1];
            if (section?.startsWith('01-')) return 'foundation';
            if (section?.startsWith('02-')) return 'security';
            if (section?.startsWith('03-')) return 'product';
            if (section?.startsWith('04-')) return 'operations';
            if (section?.startsWith('05-')) return 'infrastructure';
            if (section?.startsWith('06-')) return 'integrations';
            if (section?.startsWith('08-')) return 'reports';
            if (section?.startsWith('09-')) return 'runbooks';
            if (section?.startsWith('10-')) return 'reference';
        }
        if (relativePath.includes('archive')) return 'archive';
        return 'general';
    }

    private extractSections(content: string): { heading: string; content: string }[] {
        const sections: { heading: string; content: string }[] = [];
        const lines = content.split('\n');
        let currentHeading = '';
        let currentContent: string[] = [];

        for (const line of lines) {
            if (line.startsWith('## ')) {
                if (currentHeading) {
                    sections.push({ heading: currentHeading, content: currentContent.join('\n') });
                }
                currentHeading = line.substring(3).trim();
                currentContent = [];
            } else if (line.startsWith('#')) {
                continue;
            } else {
                currentContent.push(line);
            }
        }

        if (currentHeading) {
            sections.push({ heading: currentHeading, content: currentContent.join('\n') });
        }

        if (sections.length === 0) {
            sections.push({ heading: 'Introduction', content });
        }

        return sections;
    }

    private chunkText(text: string, maxTokens: number, overlap: number): string[] {
        const words = text.split(/\s+/);
        const chunks: string[] = [];
        const wordsPerChunk = Math.floor(maxTokens * 0.75);

        for (let i = 0; i < words.length; i += wordsPerChunk - overlap) {
            const chunk = words.slice(i, i + wordsPerChunk).join(' ');
            if (chunk.trim()) {
                chunks.push(chunk.trim());
            }
        }

        return chunks;
    }

    private async generateEmbeddings(): Promise<void> {
        console.log('🔢 Generating vector embeddings...');
        for (const chunk of this.chunks) {
            const embedding = this.mockEmbedding(chunk.content);
            chunk.embedding = embedding;
            const sourceId = chunk.source;
            if (!this.embeddings[sourceId]) {
                this.embeddings[sourceId] = { embedding, chunks: [] };
            }
            this.embeddings[sourceId].chunks.push(chunk.id);
        }
    }

    private mockEmbedding(content: string): number[] {
        const hash = this.simpleHash(content);
        const embedding = new Array(this.dimensions).fill(0).map((_, i) => {
            const val = Math.sin(hash + i * 0.01) * 0.5;
            return val;
        });
        const magnitude = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
        return embedding.map(v => v / magnitude);
    }

    private simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    private async saveKnowledgeBase(): Promise<void> {
        const outputDir = path.join(process.cwd(), '.col/memory/knowledge-base');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(path.join(outputDir, 'chunks.json'), JSON.stringify(this.chunks, null, 2));

        fs.writeFileSync(
            path.join(outputDir, 'embeddings.json'),
            JSON.stringify(this.embeddings, null, 2)
        );

        fs.writeFileSync(
            path.join(outputDir, 'index.json'),
            JSON.stringify(
                {
                    totalChunks: this.chunks.length,
                    domains: Array.from(new Set(this.chunks.map(c => c.domain))),
                    sources: Array.from(new Set(this.chunks.map(c => c.source))).length,
                },
                null,
                2
            )
        );
    }

    query(query: string, topK: number = 5): DocChunk[] {
        const queryEmbedding = this.mockEmbedding(query);
        const similarities = this.chunks.map(chunk => ({
            chunk,
            similarity: chunk.embedding
                ? this.cosineSimilarity(queryEmbedding, chunk.embedding)
                : 0,
        }));
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK)
            .map(s => s.chunk);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
        return (dot + 1) / 2;
    }

    getStats(): { chunks: number; domains: string[]; sources: number } {
        return {
            chunks: this.chunks.length,
            domains: Array.from(new Set(this.chunks.map(c => c.domain))),
            sources: Array.from(new Set(this.chunks.map(c => c.source))).length,
        };
    }
}
