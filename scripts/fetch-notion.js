/**
 * fetch-notion.js
 * Pulls data from all 4 Notion databases and writes data/notion-data.json
 * Runs via GitHub Actions every 15 minutes.
 */

const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// ── Helpers ──────────────────────────────────────────────────────────────────

function getProperty(page, name) {
  const prop = page.properties?.[name];
  if (!prop) return null;
  switch (prop.type) {
    case 'title':        return prop.title.map(t => t.plain_text).join('');
    case 'rich_text':    return prop.rich_text.map(t => t.plain_text).join('');
    case 'checkbox':     return prop.checkbox;
    case 'number':       return prop.number;
    case 'select':       return prop.select?.name ?? null;
    case 'multi_select': return prop.multi_select.map(s => s.name);
    case 'date':         return prop.date?.start ?? null;
    case 'created_time': return prop.created_time;
    case 'formula':      return prop.formula?.number ?? prop.formula?.string ?? null;
    case 'url':          return prop.url;
    default:             return null;
  }
}

async function queryAll(databaseId, filter = undefined, sorts = undefined) {
  if (!databaseId) return [];
  const results = [];
  let cursor;
  do {
    const resp = await notion.databases.query({
      database_id: databaseId,
      filter,
      sorts,
      start_cursor: cursor,
      page_size: 100,
    });
    results.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  return results;
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchHabits() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const pages = await queryAll(
      process.env.DB_HABITS,
      { property: 'Date', date: { equals: today } }
    );

    if (pages.length === 0) {
      // No entry for today — return schema so the UI knows what habits exist
      const schema = await notion.databases.retrieve({ database_id: process.env.DB_HABITS });
      const checkboxProps = Object.entries(schema.properties)
        .filter(([, v]) => v.type === 'checkbox')
        .map(([name]) => name);
      return { today: null, habitNames: checkboxProps, lastUpdated: new Date().toISOString() };
    }

    const page = pages[0];
    const habits = {};
    Object.entries(page.properties).forEach(([name, prop]) => {
      if (prop.type === 'checkbox') habits[name] = prop.checkbox;
    });
    return { today: habits, pageId: page.id, lastUpdated: new Date().toISOString() };
  } catch (e) {
    console.error('Habits fetch error:', e.message);
    return { error: e.message };
  }
}

async function fetchJournal() {
  try {
    const pages = await queryAll(
      process.env.DB_JOURNAL,
      undefined,
      [{ property: 'Created', direction: 'descending' }]
    );

    const entries = pages.slice(0, 20).map(page => ({
      id: page.id,
      date: getProperty(page, 'Date') || getProperty(page, 'Created') || page.created_time,
      title: getProperty(page, 'Name') || getProperty(page, 'Title') || 'Untitled',
      mood: getProperty(page, 'Mood') || getProperty(page, 'Emoji') || '✨',
      tags: getProperty(page, 'Tags') || [],
      url: page.url,
    }));

    return { entries, lastUpdated: new Date().toISOString() };
  } catch (e) {
    console.error('Journal fetch error:', e.message);
    return { error: e.message };
  }
}

async function fetchSkincare() {
  try {
    const pages = await queryAll(
      process.env.DB_SKINCARE,
      undefined,
      [{ property: 'Name', direction: 'ascending' }]
    );

    const products = pages.map(page => ({
      id: page.id,
      name: getProperty(page, 'Name') || getProperty(page, 'Product') || 'Unknown',
      brand: getProperty(page, 'Brand') || '',
      category: getProperty(page, 'Category') || getProperty(page, 'Type') || '',
      tags: getProperty(page, 'Tags') || getProperty(page, 'When') || [],
      stockLevel: getProperty(page, 'Stock Level') || getProperty(page, 'Stock') || null,
      notes: getProperty(page, 'Notes') || '',
      url: page.url,
    }));

    return { products, lastUpdated: new Date().toISOString() };
  } catch (e) {
    console.error('Skincare fetch error:', e.message);
    return { error: e.message };
  }
}

async function fetchTreatments() {
  try {
    const pages = await queryAll(
      process.env.DB_TREATMENTS,
      undefined,
      [{ property: 'Date', direction: 'descending' }]
    );

    const treatments = pages.slice(0, 50).map(page => ({
      id: page.id,
      name: getProperty(page, 'Name') || getProperty(page, 'Treatment') || 'Session',
      date: getProperty(page, 'Date') || page.created_time,
      duration: getProperty(page, 'Duration') || getProperty(page, 'Time') || '',
      notes: getProperty(page, 'Notes') || getProperty(page, 'Details') || '',
      type: getProperty(page, 'Type') || getProperty(page, 'Category') || '',
      url: page.url,
    }));

    return { treatments, lastUpdated: new Date().toISOString() };
  } catch (e) {
    console.error('Treatments fetch error:', e.message);
    return { error: e.message };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Fetching Notion data…');

  const [habits, journal, skincare, treatments] = await Promise.all([
    fetchHabits(),
    fetchJournal(),
    fetchSkincare(),
    fetchTreatments(),
  ]);

  const output = {
    syncedAt: new Date().toISOString(),
    habits,
    journal,
    skincare,
    treatments,
  };

  const outPath = path.join(__dirname, '..', 'data', 'notion-data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`✅ Saved to ${outPath}`);

  // Print summary
  if (!habits.error) console.log(`   Habits: today's page ${habits.today ? 'found' : 'not yet created'}`);
  if (!journal.error) console.log(`   Journal: ${journal.entries?.length ?? 0} entries`);
  if (!skincare.error) console.log(`   Skincare: ${skincare.products?.length ?? 0} products`);
  if (!treatments.error) console.log(`   Treatments: ${treatments.treatments?.length ?? 0} sessions`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
