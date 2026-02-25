import { supabase } from './supabase'
import type { Project, Task, Milestone, TeamMember, ProjectFile, Activity, Sprint } from './project-data'
import { getTaskProgressFromSubtasks } from './project-data'

// ==================== PROJECTS ====================

export async function getAllProjects(): Promise<Project[]> {
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (projectsError) {
    console.error('Error fetching projects:', projectsError)
    return []
  }

  // Fetch related data for each project
  const projectsWithData = await Promise.all(
    projects.map(async (project) => {
      const [tasks, team, files, activities, milestones] = await Promise.all([
        getProjectTasks(project.id),
        getProjectTeam(project.id),
        getProjectFiles(project.id),
        getProjectActivities(project.id),
        getProjectMilestones(project.id),
      ])

      return {
        id: project.id,
        name: project.name,
        status: project.status as Project['status'],
        progress: project.progress,
        deadline: project.deadline,
        totalTasks: project.total_tasks,
        completedTasks: project.completed_tasks,
        starred: project.starred,
        createdBy: project.created_by_name ? { name: project.created_by_name, avatar: project.created_by_avatar || '' } : undefined,
        owner: project.owner_name ? { name: project.owner_name, avatar: project.owner_avatar || '' } : undefined,
        tasks,
        team,
        files,
        activities,
        milestones,
      }
    })
  )

  return projectsWithData
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !project) {
    console.error('Error fetching project:', error)
    return null
  }

  const [tasks, team, files, activities, milestones] = await Promise.all([
    getProjectTasks(project.id),
    getProjectTeam(project.id),
    getProjectFiles(project.id),
    getProjectActivities(project.id),
    getProjectMilestones(project.id),
  ])

  return {
    id: project.id,
    name: project.name,
    status: project.status as Project['status'],
    progress: project.progress,
    deadline: project.deadline,
    totalTasks: project.total_tasks,
    completedTasks: project.completed_tasks,
    starred: project.starred,
    createdBy: project.created_by_name ? { name: project.created_by_name, avatar: project.created_by_avatar || '' } : undefined,
    owner: project.owner_name ? { name: project.owner_name, avatar: project.owner_avatar || '' } : undefined,
    tasks,
    team,
    files,
    activities,
    milestones,
  }
}

export async function createProject(project: Omit<Project, 'id' | 'tasks' | 'team' | 'files' | 'activities' | 'milestones'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: project.name,
      status: project.status,
      progress: project.progress,
      deadline: project.deadline,
      total_tasks: project.totalTasks,
      completed_tasks: project.completedTasks,
      starred: project.starred ?? false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('No data returned from create project')
  }

  return data.id
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<boolean> {
  const dbUpdates: any = {}
  
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.progress !== undefined) dbUpdates.progress = updates.progress
  if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline
  if (updates.totalTasks !== undefined) dbUpdates.total_tasks = updates.totalTasks
  if (updates.completedTasks !== undefined) dbUpdates.completed_tasks = updates.completedTasks
  if (updates.starred !== undefined) dbUpdates.starred = updates.starred
  if (updates.owner !== undefined) {
    dbUpdates.owner_name = updates.owner.name?.trim() ? updates.owner.name : null
    dbUpdates.owner_avatar = updates.owner.name?.trim() ? (updates.owner.avatar || null) : null
  }

  const { error } = await supabase
    .from('projects')
    .update(dbUpdates)
    .eq('id', id)

  if (error) {
    console.error('Error updating project:', error)
    return false
  }

  return true
}

export async function deleteProject(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting project:', error)
    return false
  }

  return true
}

// ==================== TASKS ====================

export async function getProjectTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }

  return data.map((task) => {
    const raw = task as { subtasks?: unknown }
    let subtasks: unknown[] = []
    if (Array.isArray(raw.subtasks)) {
      subtasks = raw.subtasks
    } else if (typeof raw.subtasks === 'string') {
      try {
        const parsed = JSON.parse(raw.subtasks)
        subtasks = Array.isArray(parsed) ? parsed : []
      } catch {
        subtasks = []
      }
    }
    const mapped: Task = {
      id: task.id,
      title: task.title,
      status: task.status as Task['status'],
      priority: task.priority as Task['priority'],
      assignee: {
        name: task.assignee_name,
        avatar: task.assignee_avatar,
      },
      startDate: task.start_date || undefined,
      deadline: task.deadline,
      progress: task.progress,
      description: task.description || undefined,
      milestoneId: task.milestone_id || undefined,
      subtasks: subtasks as Task['subtasks'],
    }
    if (subtasks.length > 0) {
      mapped.progress = getTaskProgressFromSubtasks(mapped)
    }
    return mapped
  })
}

/** Projects and tasks assigned to the given person (by assignee display name). Used by Employee Portal "My Projects". */
export async function getProjectsAndTasksAssignedTo(assigneeName: string): Promise<{ projectId: string; projectName: string; tasks: Task[] }[]> {
  const name = (assigneeName ?? '').trim()
  if (!name) return []

  const { data: tasksData, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('assignee_name', name)
    .order('deadline', { ascending: true })

  if (tasksError || !tasksData?.length) {
    if (tasksError) console.error('Error fetching tasks by assignee:', tasksError)
    return []
  }

  const projectIds = [...new Set(tasksData.map((t) => t.project_id))]
  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', projectIds)

  const projectNamesById = new Map<string, string>()
  projectsData?.forEach((p) => projectNamesById.set(p.id, p.name ?? ''))

  const mapRowToTask = (task: (typeof tasksData)[0]): Task => {
    const raw = task as { subtasks?: unknown }
    let subtasks: unknown[] = []
    if (Array.isArray(raw.subtasks)) {
      subtasks = raw.subtasks
    } else if (typeof raw.subtasks === 'string') {
      try {
        const parsed = JSON.parse(raw.subtasks)
        subtasks = Array.isArray(parsed) ? parsed : []
      } catch {
        subtasks = []
      }
    }
    const mapped: Task = {
      id: task.id,
      title: task.title,
      status: task.status as Task['status'],
      priority: task.priority as Task['priority'],
      assignee: { name: task.assignee_name, avatar: task.assignee_avatar },
      startDate: task.start_date || undefined,
      deadline: task.deadline,
      progress: task.progress,
      description: task.description || undefined,
      milestoneId: task.milestone_id || undefined,
      subtasks: subtasks as Task['subtasks'],
    }
    if (subtasks.length > 0) {
      mapped.progress = getTaskProgressFromSubtasks(mapped)
    }
    return mapped
  }

  const byProject = new Map<string, Task[]>()
  tasksData.forEach((row) => {
    const task = mapRowToTask(row)
    const list = byProject.get(row.project_id) ?? []
    list.push(task)
    byProject.set(row.project_id, list)
  })

  return Array.from(byProject.entries()).map(([projectId, tasks]) => ({
    projectId,
    projectName: projectNamesById.get(projectId) ?? 'Project',
    tasks,
  }))
}

export async function createTask(projectId: string, task: Omit<Task, 'id'>): Promise<string | null> {
  // Get the current max order_index for this project
  const { data: maxOrderData } = await supabase
    .from('tasks')
    .select('order_index')
    .eq('project_id', projectId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrderIndex = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].order_index + 1 : 0

  // tasks.deadline is NOT NULL in DB; use default when empty
  const deadlineValue = task.deadline?.trim()
    ? task.deadline
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Default start_date to today so tasks span from creation to deadline on the calendar
  const todayStr = new Date().toISOString().split('T')[0]
  const startDateValue = task.startDate?.trim() || todayStr

  const subtasksJson = task.subtasks && task.subtasks.length > 0 ? task.subtasks : []
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: projectId,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignee_name: task.assignee?.name ?? '',
      assignee_avatar: task.assignee?.avatar ?? '',
      start_date: startDateValue,
      deadline: deadlineValue,
      progress: task.progress ?? 0,
      description: task.description || null,
      milestone_id: task.milestoneId || null,
      order_index: nextOrderIndex,
      subtasks: subtasksJson,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating task:', error)
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('No data returned from create task')
  }

  return data.id
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
  const dbUpdates: any = {}
  
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority
  if (updates.assignee !== undefined) {
    dbUpdates.assignee_name = updates.assignee.name
    dbUpdates.assignee_avatar = updates.assignee.avatar
  }
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate?.trim() || null
  if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline || null // Convert empty string to NULL
  if (updates.progress !== undefined) dbUpdates.progress = updates.progress
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.milestoneId !== undefined) dbUpdates.milestone_id = updates.milestoneId
  if (updates.subtasks !== undefined) dbUpdates.subtasks = updates.subtasks

  const { error } = await supabase
    .from('tasks')
    .update(dbUpdates)
    .eq('id', taskId)

  if (error) {
    console.error('Error updating task:', error)
    return false
  }

  return true
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) {
    console.error('Error deleting task:', error)
    return false
  }

  return true
}

export async function reorderTask(taskId: string, newOrderIndex: number): Promise<boolean> {
  const { error } = await supabase
    .from('tasks')
    .update({ order_index: newOrderIndex })
    .eq('id', taskId)

  if (error) {
    console.error('Error reordering task:', error)
    return false
  }

  return true
}

// ==================== MILESTONES ====================

export async function getProjectMilestones(projectId: string): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching milestones:', error)
    return []
  }

  // Get task IDs for each milestone
  const milestonesWithTasks = await Promise.all(
    data.map(async (milestone) => {
      const { data: taskData } = await supabase
        .from('milestone_tasks')
        .select('task_id')
        .eq('milestone_id', milestone.id)

      return {
        id: milestone.id,
        name: milestone.name,
        date: milestone.date,
        status: milestone.status as Milestone['status'],
        description: milestone.description || undefined,
        taskIds: taskData?.map((t) => t.task_id) || [],
      }
    })
  )

  return milestonesWithTasks
}

export async function createMilestone(projectId: string, milestone: Omit<Milestone, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('milestones')
    .insert({
      project_id: projectId,
      name: milestone.name,
      date: milestone.date,
      status: milestone.status,
      description: milestone.description || null,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creating milestone:', error)
    return null
  }

  // Add task associations if provided
  if (milestone.taskIds && milestone.taskIds.length > 0) {
    const taskAssociations = milestone.taskIds.map((taskId) => ({
      milestone_id: data.id,
      task_id: taskId,
    }))

    await supabase.from('milestone_tasks').insert(taskAssociations)
  }

  return data.id
}

export async function updateMilestone(milestoneId: string, updates: Partial<Milestone>): Promise<boolean> {
  const dbUpdates: any = {}
  
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.date !== undefined) dbUpdates.date = updates.date
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.description !== undefined) dbUpdates.description = updates.description

  const { error } = await supabase
    .from('milestones')
    .update(dbUpdates)
    .eq('id', milestoneId)

  if (error) {
    console.error('Error updating milestone:', error)
    return false
  }

  // Update task associations if provided
  if (updates.taskIds !== undefined) {
    // First, remove all existing associations
    await supabase.from('milestone_tasks').delete().eq('milestone_id', milestoneId)
    
    // Then add new associations
    if (updates.taskIds.length > 0) {
      const taskAssociations = updates.taskIds.map((taskId) => ({
        milestone_id: milestoneId,
        task_id: taskId,
      }))
      await supabase.from('milestone_tasks').insert(taskAssociations)
    }
  }

  return true
}

export async function deleteMilestone(milestoneId: string): Promise<boolean> {
  // First, remove all task associations
  await supabase.from('milestone_tasks').delete().eq('milestone_id', milestoneId)
  
  // Then delete the milestone
  const { error } = await supabase
    .from('milestones')
    .delete()
    .eq('id', milestoneId)

  if (error) {
    console.error('Error deleting milestone:', error)
    return false
  }

  return true
}

// ==================== TEAM MEMBERS ====================

export async function getProjectTeam(projectId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('project_id', projectId)

  if (error) {
    console.error('Error fetching team members:', error)
    return []
  }

  return data.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
    avatar: member.avatar,
    capacity: member.capacity,
  }))
}

export async function addTeamMember(projectId: string, member: Omit<TeamMember, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      project_id: projectId,
      name: member.name,
      role: member.role,
      avatar: member.avatar,
      capacity: member.capacity,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error adding team member:', error)
    return null
  }

  return data.id
}

export async function updateTeamMember(memberId: string, updates: Partial<Omit<TeamMember, 'id'>>): Promise<boolean> {
  const { error } = await supabase
    .from('team_members')
    .update({
      name: updates.name,
      role: updates.role,
      avatar: updates.avatar,
      capacity: updates.capacity,
    })
    .eq('id', memberId)

  if (error) {
    console.error('Error updating team member:', error)
    return false
  }

  return true
}

export async function deleteTeamMember(memberId: string): Promise<boolean> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', memberId)

  if (error) {
    console.error('Error deleting team member:', error)
    return false
  }

  return true
}

// ==================== FILES ====================

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching files:', error)
    return []
  }

  return data.map((file) => ({
    id: file.id,
    name: file.name,
    type: file.type,
    uploadedBy: file.uploaded_by,
    uploadedAt: file.uploaded_at,
    size: file.size,
    url: file.file_url || '',
  }))
}

export async function addProjectFile(projectId: string, file: Omit<ProjectFile, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('project_files')
    .insert({
      project_id: projectId,
      name: file.name,
      type: file.type,
      uploaded_by: file.uploadedBy,
      uploaded_at: file.uploadedAt,
      size: file.size,
      file_url: file.url || '',
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error adding file:', error)
    return null
  }

  return data.id
}

export async function deleteProjectFile(fileId: string, fileUrl?: string): Promise<boolean> {
  try {
    // If file URL exists, delete from storage first
    if (fileUrl) {
      const filePath = fileUrl.split('/').slice(-2).join('/')
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([filePath])
      
      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
      }
    }

    // Delete from database
    const { error } = await supabase
      .from('project_files')
      .delete()
      .eq('id', fileId)

    if (error) {
      console.error('Error deleting file from database:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Error deleting file:', err)
    return false
  }
}

export async function uploadFileToStorage(
  projectId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; path: string } | null> {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    
    const { data, error } = await supabase.storage
      .from('project-files')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Error uploading file:', error)
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('project-files')
      .getPublicUrl(data.path)

    return {
      url: urlData.publicUrl,
      path: data.path,
    }
  } catch (err) {
    console.error('Error uploading file:', err)
    return null
  }
}

export async function downloadFileFromStorage(filePath: string): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage
      .from('project-files')
      .download(filePath)

    if (error) {
      console.error('Error downloading file:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Error downloading file:', err)
    return null
  }
}

// ==================== ACTIVITIES ====================

export async function getProjectActivities(projectId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching activities:', error)
    return []
  }

  return data.map((activity) => ({
    id: activity.id,
    type: activity.type,
    description: activity.description,
    user: activity.user,
    timestamp: activity.timestamp,
  }))
}

/** Recent activities across all projects (for Hub activity feed). */
export async function getRecentProjectActivities(limit: number = 20): Promise<Array<{ id: string; project_id: string; type: string; description: string; user: string; created_at: string }>> {
  const { data, error } = await supabase
    .from('activities')
    .select('id, project_id, type, description, user, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent project activities:', error)
    return []
  }
  return data ?? []
}

export async function addActivity(projectId: string, activity: Omit<Activity, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('activities')
    .insert({
      project_id: projectId,
      type: activity.type,
      description: activity.description,
      user: activity.user,
      timestamp: activity.timestamp,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error adding activity:', error)
    return null
  }

  return data.id
}

// ==================== UTILITY FUNCTIONS ====================

export async function getOverdueTasks(): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'done')
    .lt('deadline', today)

  if (error) {
    console.error('Error fetching overdue tasks:', error)
    return 0
  }

  return count || 0
}

export async function getUpcomingDeadlines(): Promise<number> {
  const today = new Date()
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'done')
    .gte('deadline', today.toISOString().split('T')[0])
    .lte('deadline', nextWeek.toISOString().split('T')[0])

  if (error) {
    console.error('Error fetching upcoming deadlines:', error)
    return 0
  }

  return count || 0
}

// ==================== SPRINTS ====================

export async function getProjectSprints(projectId: string): Promise<Sprint[]> {
  const { data: sprintsData, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error || !sprintsData) {
    console.error('Error fetching sprints:', error)
    return []
  }

  // For each sprint, get the associated task IDs
  const sprints = await Promise.all(
    sprintsData.map(async (sprint) => {
      const { data: sprintTasks } = await supabase
        .from('sprint_tasks')
        .select('task_id')
        .eq('sprint_id', sprint.id)

      return {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal || '',
        startDate: sprint.start_date,
        endDate: sprint.end_date,
        status: sprint.status as 'planned' | 'active' | 'completed',
        taskIds: sprintTasks?.map(st => st.task_id) || [],
      }
    })
  )

  return sprints
}

export async function createSprint(projectId: string, sprint: Omit<Sprint, 'id' | 'taskIds'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('sprints')
    .insert({
      project_id: projectId,
      name: sprint.name,
      goal: sprint.goal,
      start_date: sprint.startDate,
      end_date: sprint.endDate,
      status: sprint.status,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creating sprint:', error)
    return null
  }

  return data.id
}

export async function updateSprint(sprintId: string, updates: Partial<Omit<Sprint, 'id' | 'taskIds'>>): Promise<boolean> {
  const updateData: any = {}
  if (updates.name) updateData.name = updates.name
  if (updates.goal !== undefined) updateData.goal = updates.goal
  if (updates.startDate) updateData.start_date = updates.startDate
  if (updates.endDate) updateData.end_date = updates.endDate
  if (updates.status) updateData.status = updates.status

  const { error } = await supabase
    .from('sprints')
    .update(updateData)
    .eq('id', sprintId)

  if (error) {
    console.error('Error updating sprint:', error)
    return false
  }

  return true
}

export async function deleteSprint(sprintId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sprints')
    .delete()
    .eq('id', sprintId)

  if (error) {
    console.error('Error deleting sprint:', error)
    return false
  }

  return true
}

export async function addTaskToSprint(sprintId: string, taskId: string): Promise<boolean> {
  const { error, data } = await supabase
    .from('sprint_tasks')
    .insert({
      sprint_id: sprintId,
      task_id: taskId,
    })
    .select()

  if (error) {
    console.error('Error adding task to sprint:', error)
    console.error('Sprint ID:', sprintId, 'Task ID:', taskId)
    return false
  }

  console.log('[addTaskToSprint] Successfully added task to sprint:', data)
  return true
}

export async function removeTaskFromSprint(sprintId: string, taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sprint_tasks')
    .delete()
    .eq('sprint_id', sprintId)
    .eq('task_id', taskId)

  if (error) {
    console.error('Error removing task from sprint:', error)
    return false
  }

  return true
}

export async function startSprint(sprintId: string): Promise<boolean> {
  // First, set any existing active sprint to completed
  await supabase
    .from('sprints')
    .update({ status: 'completed' })
    .eq('status', 'active')

  // Then activate this sprint
  return await updateSprint(sprintId, { status: 'active' })
}

export async function completeSprint(sprintId: string): Promise<boolean> {
  return await updateSprint(sprintId, { status: 'completed' })
}
