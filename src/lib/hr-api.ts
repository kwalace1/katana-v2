/**
 * HR Supabase API Layer
 * All database operations for HR management
 */

import { supabase } from './supabase'

// ==================== TYPE DEFINITIONS ====================

export interface Employee {
  id: string
  name: string
  position: string
  department: string
  status: 'Active' | 'Onboarding' | 'Inactive' | 'On Leave'
  email: string
  phone?: string
  manager_id?: string | null
  photo_url?: string | null
  hire_date: string
  next_review_date?: string | null
  last_review_date?: string | null
  performance_score?: number | null
  /** Module IDs this employee can access (e.g. ['workforce','inventory','employee']). Empty = no module access. */
  module_access?: string[] | null
  location?: string | null
  timezone?: string | null
  bio?: string | null
  created_at: string
  updated_at: string
  manager?: Employee
}

export interface PerformanceReview {
  id: string
  employee_id: string
  review_period: string
  review_type: 'quarterly' | 'annual' | 'probation' | 'promotion'
  review_date: string
  collaboration: number
  accountability: number
  trustworthy: number
  leadership: number
  strengths?: string | null
  improvements?: string | null
  goals?: string | null
  reviewer_id?: string | null
  trend: 'up' | 'down' | 'stable'
  status: 'on-time' | 'overdue' | 'upcoming'
  created_at: string
  updated_at: string
  employee?: Employee
  reviewer?: Employee
}

export interface Goal {
  id: string
  employee_id: string
  goal: string
  category: string
  progress: number
  status: 'On Track' | 'Behind' | 'Complete' | 'Cancelled'
  due_date: string
  created_date: string
  description?: string | null
  created_at: string
  updated_at: string
  employee?: Employee
}

export interface GoalComment {
  id: string
  goal_id: string
  author_id?: string | null
  author_name: string
  comment: string
  comment_type: 'general' | 'feedback' | 'milestone' | 'concern'
  created_at: string
}

export interface Feedback360 {
  id: string
  employee_id: string
  self_rating?: number | null
  manager_rating?: number | null
  peer_rating?: number | null
  direct_report_rating?: number | null
  overall_score?: number | null
  feedback_count: number
  status: 'in-progress' | 'complete'
  period: string
  created_at: string
  updated_at: string
  employee?: Employee
}

export interface Mentorship {
  id: string
  mentor_id: string
  mentee_id: string
  focus: string
  match_score: number
  start_date: string
  end_date?: string | null
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  mentor?: Employee
  mentee?: Employee
}

export interface Recognition {
  id: string
  from_id?: string | null
  from_name: string
  to_id: string
  to_name: string
  type: 'Peer Recognition' | 'Manager Recognition'
  category: string
  message: string
  recognition_date: string
  created_at: string
}

export interface LearningPath {
  id: string
  employee_id: string
  course: string
  progress: number
  due_date: string
  status: 'in-progress' | 'completed' | 'not-started'
  created_at: string
  updated_at: string
  employee?: Employee
}

export interface CareerPath {
  id: string
  employee_id: string
  current_role_name: string
  next_role: string
  time_to_promotion: string
  readiness: number
  required_skills: string[]
  created_at: string
  updated_at: string
  employee?: Employee
}

export interface Activity {
  id: string
  type: 'employee_added' | 'review_completed' | 'goal_added' | 'goal_completed' | 'recognition_given' | 'interview_scheduled' | 'employee_updated'
  description: string
  employee_id?: string | null
  employee_name?: string | null
  created_at: string
}

// ==================== EMPLOYEES ====================

export async function getAllEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('hr_employees')
    .select(`
      *,
      manager:manager_id(*)
    `)
    .order('name')

  if (error) {
    console.error('Error fetching employees:', error)
    return []
  }

  // Ensure manager photos are included
  return (data || []).map(employee => ({
    ...employee,
    manager: employee.manager ? {
      ...employee.manager,
      photo_url: employee.manager.photo_url || null
    } : null
  }))
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('hr_employees')
    .select(`
      *,
      manager:manager_id(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching employee:', error)
    return null
  }

  return data
}

/** Get HR employee by email (for resolving current user's module access). */
export async function getEmployeeByEmail(email: string): Promise<Employee | null> {
  if (!email?.trim()) return null
  const { data, error } = await supabase
    .from('hr_employees')
    .select(`
      *,
      manager:manager_id(*)
    `)
    .ilike('email', email.trim())
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching employee by email:', error)
    return null
  }
  return data
}

export async function createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'manager'>): Promise<Employee | null> {
  const { manager, ...rest } = employee as Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { manager?: Employee }
  const rowWithModules = {
    ...rest,
    module_access: rest.module_access ?? [],
  }

  const doInsert = (row: typeof rowWithModules) =>
    supabase
      .from('hr_employees')
      .insert(row)
      .select(`
        *,
        manager:manager_id(*)
      `)
      .single()

  const { data, error } = await doInsert(rowWithModules)

  if (error) {
    const msg = (error.message || '').toLowerCase()
    const schemaOrColumnError =
      msg.includes('module_access') ||
      msg.includes('schema cache') ||
      msg.includes('column') ||
      msg.includes('does not exist') ||
      (error as { code?: string }).code === 'PGRST204' ||
      (error as { code?: string }).code === '42703'
    if (schemaOrColumnError) {
      const { module_access: _omit, ...rowWithoutModules } = rowWithModules
      const { data: retryData, error: retryError } = await doInsert(rowWithoutModules as typeof rowWithModules)
      if (retryError) {
        console.error('Error creating employee (retry without module_access):', retryError)
        throw new Error(retryError.message || 'Failed to create employee')
      }
      return retryData ? { ...retryData, module_access: rest.module_access ?? [] } : null
    }
    console.error('Error creating employee:', error)
    throw new Error(error.message || 'Failed to create employee')
  }

  return data
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('hr_employees')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      manager:manager_id(*)
    `)
    .single()

  if (error) {
    console.error('Error updating employee:', error)
    return null
  }

  return data
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_employees')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting employee:', error)
    return false
  }

  return true
}

// ==================== PERFORMANCE REVIEWS ====================

export async function getAllPerformanceReviews(): Promise<PerformanceReview[]> {
  const { data, error } = await supabase
    .from('hr_performance_reviews')
    .select(`
      *,
      employee:employee_id(*),
      reviewer:reviewer_id(*)
    `)
    .order('review_date', { ascending: false })

  if (error) {
    console.error('Error fetching performance reviews:', error)
    return []
  }

  return data || []
}

export async function getPerformanceReviewsByEmployeeId(employeeId: string): Promise<PerformanceReview[]> {
  const { data, error } = await supabase
    .from('hr_performance_reviews')
    .select(`
      *,
      employee:employee_id(*),
      reviewer:reviewer_id(*)
    `)
    .eq('employee_id', employeeId)
    .order('review_date', { ascending: false })

  if (error) {
    console.error('Error fetching employee performance reviews:', error)
    return []
  }

  return data || []
}

export async function createPerformanceReview(review: Omit<PerformanceReview, 'id' | 'created_at' | 'updated_at' | 'employee' | 'reviewer'>): Promise<PerformanceReview | null> {
  const { data, error } = await supabase
    .from('hr_performance_reviews')
    .insert(review)
    .select(`
      *,
      employee:employee_id(*),
      reviewer:reviewer_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating performance review:', error)
    return null
  }

  return data
}

export async function updatePerformanceReview(id: string, updates: Partial<PerformanceReview>): Promise<PerformanceReview | null> {
  const { data, error } = await supabase
    .from('hr_performance_reviews')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      employee:employee_id(*),
      reviewer:reviewer_id(*)
    `)
    .single()

  if (error) {
    console.error('Error updating performance review:', error)
    return null
  }

  return data
}

export async function deletePerformanceReview(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_performance_reviews')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting performance review:', error)
    return false
  }

  return true
}

// ==================== GOALS ====================

export async function getAllGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('hr_goals')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .order('due_date')

  if (error) {
    console.error('Error fetching goals:', error)
    return []
  }

  return data || []
}

export async function getGoalsByEmployeeId(employeeId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('hr_goals')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .eq('employee_id', employeeId)
    .order('due_date')

  if (error) {
    console.error('Error fetching employee goals:', error)
    return []
  }

  return data || []
}

export async function createGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'employee'>): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('hr_goals')
    .insert(goal)
    .select(`
      *,
      employee:employee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating goal:', error)
    return null
  }

  return data
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('hr_goals')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      employee:employee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error updating goal:', error)
    return null
  }

  return data
}

export async function deleteGoal(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_goals')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting goal:', error)
    return false
  }

  return true
}

// ==================== GOAL COMMENTS ====================

export async function getGoalComments(goalId: string): Promise<GoalComment[]> {
  const { data, error } = await supabase
    .from('hr_goal_comments')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching goal comments:', error)
    return []
  }

  return data || []
}

export async function createGoalComment(comment: Omit<GoalComment, 'id' | 'created_at'>): Promise<GoalComment | null> {
  const { data, error } = await supabase
    .from('hr_goal_comments')
    .insert(comment)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating goal comment:', error)
    return null
  }

  return data
}

// ==================== 360 FEEDBACK ====================

export async function getAll360Feedback(): Promise<Feedback360[]> {
  const { data, error } = await supabase
    .from('hr_360_feedback')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching 360 feedback:', error)
    return []
  }

  return data || []
}

export async function get360FeedbackByEmployeeId(employeeId: string): Promise<Feedback360[]> {
  const { data, error } = await supabase
    .from('hr_360_feedback')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching employee 360 feedback:', error)
    return []
  }

  return data || []
}

export async function create360Feedback(feedback: Omit<Feedback360, 'id' | 'created_at' | 'updated_at' | 'employee'>): Promise<Feedback360 | null> {
  const { data, error } = await supabase
    .from('hr_360_feedback')
    .insert(feedback)
    .select(`
      *,
      employee:employee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating 360 feedback:', error)
    return null
  }

  return data
}

// ==================== MENTORSHIPS ====================

export async function getAllMentorships(): Promise<Mentorship[]> {
  const { data, error } = await supabase
    .from('hr_mentorships')
    .select(`
      *,
      mentor:mentor_id(*),
      mentee:mentee_id(*)
    `)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error fetching mentorships:', error)
    return []
  }

  return data || []
}

export async function createMentorship(mentorship: Omit<Mentorship, 'id' | 'created_at' | 'updated_at' | 'mentor' | 'mentee'>): Promise<Mentorship | null> {
  const { data, error } = await supabase
    .from('hr_mentorships')
    .insert(mentorship)
    .select(`
      *,
      mentor:mentor_id(*),
      mentee:mentee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating mentorship:', error)
    return null
  }

  return data
}

export async function deleteMentorship(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_mentorships')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting mentorship:', error)
    return false
  }

  return true
}

// ==================== RECOGNITIONS ====================

export async function getAllRecognitions(): Promise<Recognition[]> {
  const { data, error } = await supabase
    .from('hr_recognitions')
    .select('*')
    .order('recognition_date', { ascending: false })

  if (error) {
    console.error('Error fetching recognitions:', error)
    return []
  }

  return data || []
}

export async function getRecognitionsByEmployeeId(employeeId: string): Promise<Recognition[]> {
  const { data, error } = await supabase
    .from('hr_recognitions')
    .select('*')
    .eq('to_id', employeeId)
    .order('recognition_date', { ascending: false })

  if (error) {
    console.error('Error fetching recognitions for employee:', error)
    return []
  }

  return data || []
}

export async function createRecognition(recognition: Omit<Recognition, 'id' | 'created_at'>): Promise<Recognition | null> {
  const { data, error } = await supabase
    .from('hr_recognitions')
    .insert(recognition)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating recognition:', error)
    return null
  }

  return data
}

export async function deleteRecognition(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_recognitions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting recognition:', error)
    return false
  }

  return true
}

// ==================== LEARNING PATHS ====================

export async function getAllLearningPaths(): Promise<LearningPath[]> {
  const { data, error } = await supabase
    .from('hr_learning_paths')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .order('due_date')

  if (error) {
    console.error('Error fetching learning paths:', error)
    return []
  }

  return data || []
}

export async function getLearningPathsByEmployeeId(employeeId: string): Promise<LearningPath[]> {
  const { data, error } = await supabase
    .from('hr_learning_paths')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .eq('employee_id', employeeId)
    .order('due_date')

  if (error) {
    console.error('Error fetching employee learning paths:', error)
    return []
  }

  return data || []
}

export async function createLearningPath(learningPath: Omit<LearningPath, 'id' | 'created_at' | 'updated_at' | 'employee'>): Promise<LearningPath | null> {
  const { data, error } = await supabase
    .from('hr_learning_paths')
    .insert(learningPath)
    .select(`
      *,
      employee:employee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating learning path:', error)
    return null
  }

  return data
}

export async function deleteLearningPath(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_learning_paths')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting learning path:', error)
    return false
  }

  return true
}

// ==================== CAREER PATHS ====================

export async function getAllCareerPaths(): Promise<CareerPath[]> {
  const { data, error } = await supabase
    .from('hr_career_paths')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching career paths:', error)
    return []
  }

  return data || []
}

export async function createCareerPath(careerPath: Omit<CareerPath, 'id' | 'created_at' | 'updated_at' | 'employee'>): Promise<CareerPath | null> {
  const { data, error } = await supabase
    .from('hr_career_paths')
    .insert(careerPath)
    .select(`
      *,
      employee:employee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating career path:', error)
    return null
  }

  return data
}

export async function deleteCareerPath(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_career_paths')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting career path:', error)
    return false
  }

  return true
}

// ==================== UTILITY FUNCTIONS ====================

export async function getHRStats() {
  const employees = await getAllEmployees()
  const reviews = await getAllPerformanceReviews()
  const goals = await getAllGoals()

  const totalEmployees = employees.length
  // All employees are active by default
  const activeEmployees = employees.filter((e) => e.status?.toLowerCase() === 'active').length
  const avgPerformanceScore = employees.length > 0 && employees.some(e => e.performance_score)
    ? Number((employees.filter(e => e.performance_score).reduce((sum, e) => sum + (e.performance_score || 0), 0) / employees.filter(e => e.performance_score).length).toFixed(2))
    : 0

  const totalGoals = goals.length
  const onTrackGoals = goals.filter((g) => g.status === 'On Track').length
  const behindGoals = goals.filter((g) => g.status === 'Behind').length
  const completeGoals = goals.filter((g) => g.status === 'Complete').length

  const upcomingReviews = reviews.filter((r) => r.status === 'upcoming').length
  const overdueReviews = reviews.filter((r) => r.status === 'overdue').length

  return {
    totalEmployees,
    activeEmployees,
    avgPerformanceScore,
    totalGoals,
    onTrackGoals,
    behindGoals,
    completeGoals,
    upcomingReviews,
    overdueReviews,
  }
}

// ==================== ACTIVITIES ====================

export async function getRecentActivities(limit: number = 10): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('hr_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching activities:', error)
    return []
  }

  return data || []
}

export async function logActivity(activity: Omit<Activity, 'id' | 'created_at'>): Promise<boolean> {
  const { error } = await supabase
    .from('hr_activities')
    .insert(activity)

  if (error) {
    console.error('Error logging activity:', error)
    return false
  }

  return true
}

// Helper function to log employee added
export async function logEmployeeAdded(employeeName: string, employeeId: string): Promise<void> {
  await logActivity({
    type: 'employee_added',
    description: `New employee ${employeeName} added to the system`,
    employee_id: employeeId,
    employee_name: employeeName,
  })
}

// Helper function to log review completed
export async function logReviewCompleted(employeeName: string, employeeId: string): Promise<void> {
  await logActivity({
    type: 'review_completed',
    description: `Performance review completed for ${employeeName}`,
    employee_id: employeeId,
    employee_name: employeeName,
  })
}

// Helper function to log goal added
export async function logGoalAdded(goalTitle: string, employeeName: string, employeeId: string): Promise<void> {
  await logActivity({
    type: 'goal_added',
    description: `New goal added for ${employeeName}: ${goalTitle}`,
    employee_id: employeeId,
    employee_name: employeeName,
  })
}

// Helper function to log goal completed
export async function logGoalCompleted(goalTitle: string, employeeName: string, employeeId: string): Promise<void> {
  await logActivity({
    type: 'goal_completed',
    description: `${employeeName} completed goal: ${goalTitle}`,
    employee_id: employeeId,
    employee_name: employeeName,
  })
}

// Helper function to log recognition
export async function logRecognitionGiven(fromName: string, toName: string, toId: string): Promise<void> {
  await logActivity({
    type: 'recognition_given',
    description: `${fromName} gave recognition to ${toName}`,
    employee_id: toId,
    employee_name: toName,
  })
}

// Helper function to log interview scheduled
export async function logInterviewScheduled(candidateId: string): Promise<void> {
  await logActivity({
    type: 'interview_scheduled',
    description: `Interview scheduled for candidate ${candidateId}`,
    employee_id: null,
    employee_name: candidateId,
  })
}

