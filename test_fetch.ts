import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function test() {
    const { data, error } = await supabase.from('vessels').select('id, name, bow_number').order('bow_number')
    console.log(data, error)
}
test()
