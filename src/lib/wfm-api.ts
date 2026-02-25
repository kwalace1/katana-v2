import { supabase, isSupabaseConfigured } from './supabase'

// ============================================
// TYPES
// ============================================

export interface Technician {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: 'technician' | 'lead' | 'supervisor'
  status: 'active' | 'inactive' | 'on-leave'
  skills: string[] | null
  hourly_rate: number | null
  avatar_url: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  job_number: string
  title: string
  description: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  location: string | null
  location_address: string | null
  status: 'assigned' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  technician_id: string | null
  start_date: string | null
  end_date: string | null
  estimated_hours: number | null
  actual_hours: number | null
  notes: string | null
  completion_notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  technician?: Technician
}

export interface Schedule {
  id: string
  technician_id: string
  job_id: string | null
  schedule_date: string
  start_time: string | null
  end_time: string | null
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
  technician?: Technician
  job?: Job
}

export interface Timesheet {
  id: string
  technician_id: string
  job_id: string | null
  clock_in: string
  clock_out: string | null
  break_duration: number
  total_hours: number | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  technician?: Technician
  job?: Job
}

export interface JobNote {
  id: string
  job_id: string
  technician_id: string | null
  note: string
  created_by: string | null
  created_at: string
  technician?: Technician
}

// ============================================
// TECHNICIANS API
// ============================================

export async function getTechnicians(): Promise<Technician[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  const { data, error } = await supabase
    .from('wfm_technicians')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error fetching technicians:', error)
    throw error
  }

  return data || []
}

export async function getTechnician(id: string): Promise<Technician | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('wfm_technicians')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching technician:', error)
    return null
  }

  return data
}

export async function createTechnician(technician: Omit<Technician, 'id' | 'created_at' | 'updated_at'>): Promise<Technician | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('wfm_technicians')
    .insert(technician)
    .select()
    .single()

  if (error) {
    console.error('Error creating technician:', error)
    throw error
  }

  return data
}

export async function updateTechnician(id: string, updates: Partial<Technician>): Promise<Technician | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { created_at, updated_at, ...updateData } = updates

  const { data, error } = await supabase
    .from('wfm_technicians')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating technician:', error)
    throw error
  }

  return data
}

export async function deleteTechnician(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  // Soft delete
  const { error } = await supabase
    .from('wfm_technicians')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error deleting technician:', error)
    return false
  }

  return true
}

// ============================================
// JOBS API
// ============================================

export async function getJobs(): Promise<Job[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  const { data, error } = await supabase
    .from('wfm_jobs')
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .eq('is_active', true)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error fetching jobs:', error)
    throw error
  }

  return data || []
}

export async function getJob(id: string): Promise<Job | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('wfm_jobs')
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching job:', error)
    return null
  }

  return data
}

export async function createJob(job: Omit<Job, 'id' | 'job_number' | 'created_at' | 'updated_at' | 'technician'>): Promise<Job | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  // Generate job number (fallback if RPC missing or fails)
  let jobNumber: string
  const { data: rpcNumber, error: rpcError } = await supabase.rpc('generate_job_number')
  if (rpcError || rpcNumber == null || rpcNumber === '') {
    jobNumber = `JOB-${Date.now()}`
  } else {
    jobNumber = String(rpcNumber)
  }

  // Build insert payload: only include defined values so we don't send undefined to Postgres
  const row: Record<string, unknown> = {
    job_number: jobNumber,
    title: job.title ?? '',
    description: job.description ?? null,
    customer_name: job.customer_name ?? null,
    customer_phone: job.customer_phone ?? null,
    customer_email: job.customer_email ?? null,
    location: job.location ?? null,
    location_address: job.location_address ?? null,
    status: job.status ?? 'assigned',
    priority: job.priority ?? 'medium',
    technician_id: job.technician_id ?? null,
    start_date: job.start_date ?? null,
    end_date: job.end_date ?? null,
    estimated_hours: job.estimated_hours ?? null,
    actual_hours: job.actual_hours ?? null,
    notes: job.notes ?? null,
    completion_notes: job.completion_notes ?? null,
    is_active: job.is_active ?? true,
  }

  const { data, error } = await supabase
    .from('wfm_jobs')
    .insert(row)
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .single()

  if (error) {
    console.error('Error creating job:', error)
    throw error
  }

  return data
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<Job | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const {
    technician,
    created_at,
    updated_at,
    job_number,
    id: _id,
    ...rest
  } = updates

  const updateData: Record<string, unknown> = {}
  if (rest.title !== undefined) updateData.title = rest.title
  if (rest.technician_id !== undefined) updateData.technician_id = rest.technician_id
  if (rest.start_date !== undefined) updateData.start_date = rest.start_date
  if (rest.end_date !== undefined) updateData.end_date = rest.end_date
  if (rest.status !== undefined) updateData.status = rest.status
  if (rest.priority !== undefined) updateData.priority = rest.priority
  if (rest.description !== undefined) updateData.description = rest.description
  if (rest.location !== undefined) updateData.location = rest.location
  if (rest.location_address !== undefined) updateData.location_address = rest.location_address
  if (rest.notes !== undefined) updateData.notes = rest.notes
  if (rest.completion_notes !== undefined) updateData.completion_notes = rest.completion_notes
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  const { data, error } = await supabase
    .from('wfm_jobs')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .single()

  if (error) {
    console.error('Error updating job:', error)
    throw error
  }

  return data
}

export async function deleteJob(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  // Soft delete
  const { error } = await supabase
    .from('wfm_jobs')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error deleting job:', error)
    return false
  }

  return true
}

// ============================================
// SCHEDULES API
// ============================================

export async function getSchedules(technicianId?: string, startDate?: string, endDate?: string): Promise<Schedule[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  let query = supabase
    .from('wfm_schedules')
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .order('schedule_date', { ascending: true })

  if (technicianId) {
    query = query.eq('technician_id', technicianId)
  }

  if (startDate) {
    query = query.gte('schedule_date', startDate)
  }

  if (endDate) {
    query = query.lte('schedule_date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching schedules:', error)
    throw error
  }

  return data || []
}

export async function createSchedule(schedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at' | 'technician' | 'job'>): Promise<Schedule | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('wfm_schedules')
    .insert(schedule)
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .single()

  if (error) {
    console.error('Error creating schedule:', error)
    throw error
  }

  return data
}

export async function updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { technician, job, created_at, updated_at, ...updateData } = updates

  const { data, error } = await supabase
    .from('wfm_schedules')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .single()

  if (error) {
    console.error('Error updating schedule:', error)
    throw error
  }

  return data
}

export async function deleteSchedule(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  const { error } = await supabase
    .from('wfm_schedules')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting schedule:', error)
    return false
  }

  return true
}

// ============================================
// TIMESHEETS API
// ============================================

export async function getTimesheets(technicianId?: string, jobId?: string): Promise<Timesheet[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  let query = supabase
    .from('wfm_timesheets')
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .order('clock_in', { ascending: false })

  if (technicianId) {
    query = query.eq('technician_id', technicianId)
  }

  if (jobId) {
    query = query.eq('job_id', jobId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching timesheets:', error)
    throw error
  }

  return data || []
}

export async function createTimesheet(timesheet: Omit<Timesheet, 'id' | 'total_hours' | 'created_at' | 'updated_at' | 'technician' | 'job'>): Promise<Timesheet | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('wfm_timesheets')
    .insert(timesheet)
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .single()

  if (error) {
    console.error('Error creating timesheet:', error)
    throw error
  }

  return data
}

export async function updateTimesheet(id: string, updates: Partial<Timesheet>): Promise<Timesheet | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { technician, job, total_hours, created_at, updated_at, ...updateData } = updates

  const { data, error } = await supabase
    .from('wfm_timesheets')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .single()

  if (error) {
    console.error('Error updating timesheet:', error)
    throw error
  }

  return data
}

export async function deleteTimesheet(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  const { error } = await supabase
    .from('wfm_timesheets')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting timesheet:', error)
    return false
  }

  return true
}

export async function clockIn(technicianId: string, jobId?: string, notes?: string): Promise<Timesheet | null> {
  return createTimesheet({
    technician_id: technicianId,
    job_id: jobId || null,
    clock_in: new Date().toISOString(),
    clock_out: null,
    break_duration: 0,
    notes: notes || null,
    status: 'pending',
    approved_by: null,
    approved_at: null,
  })
}

export async function clockOut(timesheetId: string, notes?: string): Promise<Timesheet | null> {
  return updateTimesheet(timesheetId, {
    clock_out: new Date().toISOString(),
    notes,
  })
}

// ============================================
// JOB NOTES API
// ============================================

export async function getJobNotes(jobId: string): Promise<JobNote[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  const { data, error } = await supabase
    .from('wfm_job_notes')
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching job notes:', error)
    throw error
  }

  return data || []
}

export async function createJobNote(note: Omit<JobNote, 'id' | 'created_at' | 'technician'>): Promise<JobNote | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('wfm_job_notes')
    .insert(note)
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .single()

  if (error) {
    console.error('Error creating job note:', error)
    throw error
  }

  return data
}

export async function deleteJobNote(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  const { error } = await supabase
    .from('wfm_job_notes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting job note:', error)
    return false
  }

  return true
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export async function getWFMStats(): Promise<{
  totalTechnicians: number
  activeTechnicians: number
  totalJobs: number
  activeJobs: number
  completedJobs: number
  pendingTimesheets: number
}> {
  if (!isSupabaseConfigured) {
    return {
      totalTechnicians: 0,
      activeTechnicians: 0,
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      pendingTimesheets: 0,
    }
  }

  const [techData, jobData, timesheetData] = await Promise.all([
    supabase.from('wfm_technicians').select('status', { count: 'exact' }).eq('is_active', true),
    supabase.from('wfm_jobs').select('status', { count: 'exact' }).eq('is_active', true),
    supabase.from('wfm_timesheets').select('status', { count: 'exact' }).eq('status', 'pending'),
  ])

  const technicians = techData.data || []
  const jobs = jobData.data || []

  return {
    totalTechnicians: technicians.length,
    activeTechnicians: technicians.filter(t => t.status === 'active').length,
    totalJobs: jobs.length,
    activeJobs: jobs.filter(j => j.status === 'assigned' || j.status === 'in-progress').length,
    completedJobs: jobs.filter(j => j.status === 'completed').length,
    pendingTimesheets: timesheetData.count || 0,
  }
}

export async function getTechnicianActiveJobs(technicianId: string): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0
  }

  const { count, error } = await supabase
    .from('wfm_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('technician_id', technicianId)
    .in('status', ['assigned', 'in-progress'])
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching technician active jobs:', error)
    return 0
  }

  return count || 0
}






