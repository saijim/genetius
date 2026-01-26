import { defineDb, defineTable, column, NOW } from 'astro:db';

export default defineDb({
  tables: {
    papers: defineTable({
      columns: {
        id: column.number({ primaryKey: true }),
        doi: column.text({ unique: true }),
        title: column.text(),
        authors: column.json({ default: [] }),
        date: column.date(),
        version: column.number(),
        type: column.text(),
        abstract: column.text({ optional: true }),
        summary: column.text({ optional: true }),
        modelOrganism: column.text({ optional: true }),
        keywords: column.json({ default: [] }),
        methods: column.json({ default: [] }),
        markdown: column.text(),
        createdAt: column.date({ default: NOW }),
        updatedAt: column.date({ default: NOW }),
      },
      indexes: [
        { on: ['date'], unique: false },
        { on: ['type'], unique: false },
        { on: ['modelOrganism'], unique: false },
      ],
    }),
    refreshLogs: defineTable({
      columns: {
        id: column.number({ primaryKey: true }),
        date: column.date({ default: NOW }),
        intervalStart: column.date(),
        intervalEnd: column.date(),
        papersFetched: column.number({ default: 0 }),
        papersProcessed: column.number({ default: 0 }),
        status: column.text({ default: 'pending' }),
      },
      indexes: [
        { on: ['date'], unique: false },
      ],
    }),
  },
});
