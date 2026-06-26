import { getStaffContext } from '@/lib/staff'

export async function getCurrentAdminContext() {
  return getStaffContext()
}
