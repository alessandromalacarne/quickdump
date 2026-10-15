import { CronExpressionParser } from 'cron-parser';

export function isValidCron(expression: string): boolean {
  if (expression.trim() === '') {
    return false;
  }

  try {
    CronExpressionParser.parse(expression);
    return true;
  } catch {
    return false;
  }
}

export function nextRun(
  expression: string,
  timezone: string,
  from: Date,
): Date {
  return CronExpressionParser.parse(expression, {
    currentDate: from,
    tz: timezone,
  })
    .next()
    .toDate();
}
