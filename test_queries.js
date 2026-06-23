import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf8');
let url = '';
let key = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/^["']|["']$/g, '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/^["']|["']$/g, '').trim();
});

const supabase = createClient(url, key);

async function testAll() {
  console.log('Testing all loadInitialData queries...');
  
  const queries = [
    { name: 'farms', promise: supabase.from('farms').select('*').limit(1) },
    { name: 'crops', promise: supabase.from('crops').select('*').limit(1) },
    { name: 'v_paddocks', promise: supabase.from('v_paddocks').select('*').limit(1) },
    { name: 'inventory_items', promise: supabase.from('inventory_items').select('*').limit(1) },
    { name: 'activities', promise: supabase.from('activities').select('*, activity_inputs(*)').limit(1) },
    { name: 'chat_messages', promise: supabase.from('chat_messages').select('*').limit(1) },
  ];

  for (const q of queries) {
    const { error } = await q.promise;
    if (error) {
      console.error(`Error querying ${q.name}:`, error.message);
    } else {
      console.log(`Query ${q.name} succeeded!`);
    }
  }
}

testAll();
