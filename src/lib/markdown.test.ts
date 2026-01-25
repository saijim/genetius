import { describe, it, expect } from 'vitest';
import { toMarkdown, type PaperData } from '~/lib/markdown';

describe('toMarkdown', () => {
  it('should generate markdown with all fields', () => {
    const paper: PaperData = {
      title: 'Test Paper Title',
      authors: ['Author One', 'Author Two', 'Author Three'],
      date: '2026-01-24',
      version: 1,
      doi: '10.1101/123456',
      category: 'plant_biology',
      abstract: 'This is the abstract of the paper.',
      summary: 'AI-generated summary of the paper.',
      keywords: ['plant', 'genetics', 'biology'],
    };

    const result = toMarkdown(paper);

    expect(result).toContain('# Test Paper Title');
    expect(result).toContain('**Authors:** Author One, Author Two, Author Three');
    expect(result).toContain('**Date:** 2026-01-24');
    expect(result).toContain('**Version:** 1');
    expect(result).toContain('**DOI:** 10.1101/123456');
    expect(result).toContain('**Category:** plant_biology');
    expect(result).toContain('## Abstract');
    expect(result).toContain('This is the abstract of the paper.');
    expect(result).toContain('## AI Summary');
    expect(result).toContain('AI-generated summary of the paper.');
    expect(result).toContain('## Keywords');
    expect(result).toContain('plant, genetics, biology');
  });

  it('should generate markdown without abstract', () => {
    const paper: PaperData = {
      title: 'Test Paper Title',
      authors: ['Author One'],
      date: '2026-01-24',
      version: 1,
      doi: '10.1101/123456',
      category: 'plant_biology',
      summary: 'AI-generated summary of the paper.',
      keywords: ['plant', 'genetics'],
    };

    const result = toMarkdown(paper);

    expect(result).toContain('# Test Paper Title');
    expect(result).not.toContain('## Abstract');
    expect(result).toContain('## AI Summary');
    expect(result).toContain('## Keywords');
  });

  it('should generate markdown without summary', () => {
    const paper: PaperData = {
      title: 'Test Paper Title',
      authors: ['Author One'],
      date: '2026-01-24',
      version: 1,
      doi: '10.1101/123456',
      category: 'plant_biology',
      abstract: 'This is the abstract of the paper.',
      keywords: ['plant', 'genetics'],
    };

    const result = toMarkdown(paper);

    expect(result).toContain('# Test Paper Title');
    expect(result).toContain('## Abstract');
    expect(result).not.toContain('## AI Summary');
    expect(result).toContain('## Keywords');
  });

  it('should generate markdown without keywords', () => {
    const paper: PaperData = {
      title: 'Test Paper Title',
      authors: ['Author One'],
      date: '2026-01-24',
      version: 1,
      doi: '10.1101/123456',
      category: 'plant_biology',
      abstract: 'This is the abstract of the paper.',
      summary: 'AI-generated summary of the paper.',
    };

    const result = toMarkdown(paper);

    expect(result).toContain('# Test Paper Title');
    expect(result).toContain('## Abstract');
    expect(result).toContain('## AI Summary');
    expect(result).not.toContain('## Keywords');
  });

  it('should handle empty authors array', () => {
    const paper: PaperData = {
      title: 'Test Paper Title',
      authors: [],
      date: '2026-01-24',
      version: 1,
      doi: '10.1101/123456',
      category: 'plant_biology',
    };

    const result = toMarkdown(paper);

    expect(result).toContain('# Test Paper Title');
    expect(result).toContain('**Date:** 2026-01-24');
  });

  it('should handle empty keywords array', () => {
    const paper: PaperData = {
      title: 'Test Paper Title',
      authors: ['Author One'],
      date: '2026-01-24',
      version: 1,
      doi: '10.1101/123456',
      category: 'plant_biology',
      keywords: [],
    };

    const result = toMarkdown(paper);

    expect(result).toContain('# Test Paper Title');
    expect(result).not.toContain('## Keywords');
  });

  it('should properly format markdown line breaks', () => {
    const paper: PaperData = {
      title: 'Test Paper Title',
      authors: ['Author One'],
      date: '2026-01-24',
      version: 1,
      doi: '10.1101/123456',
      category: 'plant_biology',
      abstract: 'Abstract content.',
      summary: 'Summary content.',
      keywords: ['plant'],
    };

    const result = toMarkdown(paper);
    const lines = result.split('\n');

    expect(lines[0]).toBe('# Test Paper Title');
    expect(lines[1]).toBe('');
    expect(lines[2]).toContain('**Authors:**');
  });
});
