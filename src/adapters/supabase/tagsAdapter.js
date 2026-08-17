import { supabase } from '../../lib/supabase.js'

const TAG_SELECT = 'id,name,color'

export const tagsSupabaseAdapter = {

  async getAll() {
    const { data, error } = await supabase
      .from('tags')
      .select(TAG_SELECT)
      .order('name')

    if (error) {
      throw error
    }

    return data || []
  },

  async add(name, color) {
    const { data, error } = await supabase
      .from('tags')
      .insert({
        name,
        color,
      })
      .select(TAG_SELECT)
      .single()

    if (error) {
      throw error
    }

    return data
  },

  async update(id, name, color) {
    const { data, error } = await supabase
      .from('tags')
      .update({
        name,
        color,
      })
      .eq('id', id)
      .select(TAG_SELECT)
      .single()

    if (error) {
      throw error
    }

    return data
  },

  async remove(id) {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }
  },
}