import { describe, it, expect } from 'vitest';

describe('trends page integration', () => {
  it('should be configured with prerender = false', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'trends.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain("export const prerender = false");
  });

  it('should import trends module and components', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'trends.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain("import { getAllTrends, type TrendsData } from '~/lib/trends'");
    expect(content).toContain("import MainLayout from '~/layouts/MainLayout.astro'");
    expect(content).toContain("import TrendList from '~/components/TrendList.astro'");
  });

  it('should call getAllTrends function', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'trends.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('allTrends = await getAllTrends()');
  });

  it('should render all four trend periods', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'trends.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain("allTrends.day && <TrendList trends={allTrends.day} />");
    expect(content).toContain("allTrends.week && <TrendList trends={allTrends.week} />");
    expect(content).toContain("allTrends.month && <TrendList trends={allTrends.month} />");
    expect(content).toContain("allTrends.year && <TrendList trends={allTrends.year} />");
  });

  it('should handle empty trends', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'trends.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain("Object.keys(allTrends).length > 0");
    expect(content).toContain('No trend data available yet');
  });

  it('should have link back to home page', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'trends.astro');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('href="/"');
  });
});
