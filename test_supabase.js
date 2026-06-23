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

async function test() {
  console.log('Testing fn_create_paddock...');
  const testFarmId = '00000000-0000-0000-0000-000000000000'; // Invalid UUID, but wait! There is a foreign key constraint to farms!
  // We need to fetch a valid farm first.
  
  const { data: farms, error: fError } = await supabase.from('farms').select('*');
  console.log('Farms:', farms);
  
  if (!farms || farms.length === 0) {
    console.log('No farms found. Cannot test fn_create_paddock due to foreign key constraint.');
    return;
  }
  
  const farmId = farms[0].id;
  
  const geojson = {
    "type": "Polygon",
    "coordinates": [
      [
        [-64.7841027, -26.7500651],
        [-64.7836498, -26.7476991],
        [-64.7810835, -26.7477524],
        [-64.7796909, -26.7495111],
        [-64.7818991, -26.7510389],
        [-64.7841027, -26.7500651]
      ]
    ]
  };

  const { data, error } = await supabase.rpc('fn_create_paddock', {
    p_farm_id: farmId,
    p_name: 'Lote Test Node',
    p_crop_id: null,
    p_boundary_geojson: geojson
  });

  if (error) {
    console.error('fn_create_paddock error:', error);
  } else {
    console.log('fn_create_paddock success! returned ID:', data);
    
    // Now verify it in v_paddocks
    const { data: vPaddocks } = await supabase.from('v_paddocks').select('*').eq('id', data);
    console.log('v_paddocks fetched new paddock:', vPaddocks);
  }
}

test();
