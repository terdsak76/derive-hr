import { NextResponse } from 'next/server';
import { isEmployeeAdmin, requireEmployeeUser } from '@/lib/employee-access';

export function employeeRecordDeleteHandler(remove: (id: string) => Promise<{ count: number }>) {
  return async function DELETE(request: Request) {
    try {
      const user = await requireEmployeeUser(request);
      if (user instanceof NextResponse) return user;
      if (!isEmployeeAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const body = await request.json().catch(() => null);
      if (typeof body?.id !== 'string' || !body.id.trim()) {
        return NextResponse.json({ error: 'กรุณาระบุรายการที่ต้องการลบ' }, { status: 400 });
      }
      const result = await remove(body.id);
      if (!result.count) return NextResponse.json({ error: 'ไม่พบรายการที่ต้องการลบ' }, { status: 404 });
      return NextResponse.json({ id: body.id });
    } catch (error) {
      console.error('Failed to delete employee record:', error);
      return NextResponse.json({ error: 'ไม่สามารถลบรายการได้' }, { status: 500 });
    }
  };
}
