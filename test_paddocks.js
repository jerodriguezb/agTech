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
  console.log('Fetching all paddocks from v_paddocks...');
  const { data, error } = await supabase.from('v_paddocks').select('*');
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('v_paddocks data:', JSON.stringify(data, null, 2));
  }
}

testAll();
