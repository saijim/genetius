export interface PaperData {
  title: string;
  authors: string[];
  date: string;
  version: number;
  doi: string;
  category: string;
  abstract?: string;
  summary?: string;
  keywords?: string[];
}

export function toMarkdown(data: PaperData): string {
  const lines: string[] = [];

  lines.push(`# ${data.title}`);
  lines.push('');

  if (data.authors.length > 0) {
    lines.push(`**Authors:** ${data.authors.join(', ')}`);
    lines.push('');
  }

  lines.push(`**Date:** ${data.date}`);
  lines.push(`**Version:** ${data.version}`);
  lines.push(`**DOI:** ${data.doi}`);
  lines.push(`**Category:** ${data.category}`);
  lines.push('');

  if (data.abstract) {
    lines.push('## Abstract');
    lines.push(data.abstract);
    lines.push('');
  }

  if (data.summary) {
    lines.push('## AI Summary');
    lines.push(data.summary);
    lines.push('');
  }

  if (data.keywords && data.keywords.length > 0) {
    lines.push('## Keywords');
    lines.push(data.keywords.join(', '));
  }

  return lines.join('\n');
}
