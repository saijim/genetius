import { describe, it, expect } from 'vitest';

describe('index page integration', () => {
  it('should be configured with prerender = false', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'index.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain("export const prerender = false");
  });

  it('should import database and components', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'index.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Check that home-data is imported (which handles database queries)
    expect(content).toContain("from '~/lib/home-data'");
    expect(content).toContain("import MainLayout from '~/layouts/MainLayout.astro'");
    expect(content).toContain("import PaperCard from '~/components/PaperCard.astro'");
  });

  it('should use PaperCard component', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'index.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('<PaperCard');
  });

  it('should query database with limit', () => {
    const fs = require('fs');
    const path = require('path');
    // Check that home-data.ts limits queries
    const filePath = path.join(__dirname, '..', 'lib', 'home-data.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('.limit(PAGE_SIZE)');
  });

  it('should order by date descending', () => {
    const fs = require('fs');
    const path = require('path');
    // Check that home-data.ts orders by date descending
    const filePath = path.join(__dirname, '..', 'lib', 'home-data.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('orderBy(desc(papers.date))');
  });

  it('should handle empty results', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'index.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain("latestPapers.length > 0");
    expect(content).toContain('No papers available yet');
  });

  it('should have link to trends page', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'index.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('href="/trends"');
  });
});
