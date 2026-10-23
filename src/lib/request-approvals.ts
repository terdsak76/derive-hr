export type ApprovalType = 'LEAVE' | 'WORKDAY_CHANGE' | 'OVERTIME';
export type ApprovalDecision = { id: string; type: ApprovalType; status: 'APPROVED' | 'REJECTED' };
export type ApprovalRequest = {
  id: string;
  type: ApprovalType;
  employeeName: string;
  department: string;
  submittedAt: string;
  start: string;
  end: string;
  description: string;
  hours?: number;
  amount?: number;
};

export const approvalLabels: Record<ApprovalType, string> = {
  LEAVE: 'การลา', WORKDAY_CHANGE: 'ขอเปลี่ยนวันทำงาน', OVERTIME: 'OT',
};
