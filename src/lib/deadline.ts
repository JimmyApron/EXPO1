function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDeadlineLabel(deadline: string | null) {
  if (!deadline) {
    return '마감일 미정';
  }

  return `마감일 ${deadline}`;
}

export function getDDayLabel(deadline: string | null) {
  if (!deadline) {
    return 'D-day 미정';
  }

  const targetDate = parseDateOnly(deadline);
  if (!targetDate) {
    return '날짜 확인 필요';
  }

  const today = startOfLocalDay(new Date());
  const diffTime = startOfLocalDay(targetDate).getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `D-${diffDays}`;
  }

  if (diffDays === 0) {
    return 'D-Day';
  }

  return `D+${Math.abs(diffDays)}`;
}
