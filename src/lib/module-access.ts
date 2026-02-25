/**
 * System module keys used for HR employee access control.
 * When adding an employee, you select which modules they can access.
 * Sidebar and routes use this to show/allow only those modules.
 */

export const MODULES = [
  { id: 'hub', label: 'Hub' },
  { id: 'projects', label: 'Katana PM' },
  { id: 'inventory', label: 'Katana Inventory' },
  { id: 'customer-success', label: 'Katana Customers' },
  { id: 'workforce', label: 'WFM' },
  { id: 'hr', label: 'Katana HR' },
  { id: 'employee', label: 'Employee Portal' },
  { id: 'careers', label: 'Careers' },
  { id: 'manufacturing', label: 'Z-MO' },
  { id: 'automation', label: 'Automation' },
  { id: 'kyi', label: 'Know Your Investor' },
] as const

export type ModuleId = (typeof MODULES)[number]['id']

/** Path prefix for each module (used for sidebar and route matching). */
export const MODULE_PATH: Record<ModuleId, string> = {
  hub: '/hub',
  projects: '/projects',
  inventory: '/inventory',
  'customer-success': '/customer-success',
  workforce: '/workforce',
  hr: '/hr',
  employee: '/employee',
  careers: '/careers',
  manufacturing: '/manufacturing',
  automation: '/automation',
  kyi: '/kyi',
}

export function getModuleIdByPath(path: string): ModuleId | null {
  const normalized = path === '/' ? '' : path.replace(/\/$/, '')
  for (const [id, modulePath] of Object.entries(MODULE_PATH)) {
    if (normalized === modulePath || normalized.startsWith(modulePath + '/')) {
      return id as ModuleId
    }
  }
  return null
}
