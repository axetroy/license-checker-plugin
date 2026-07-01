import { LicenseBuildReport } from './model/LicenseBuildReport';

export interface Recorder {
  record(report: LicenseBuildReport): void;
  getReports(): LicenseBuildReport[];
  waitForReports(expectedCount?: number, timeoutMs?: number): Promise<LicenseBuildReport[]>;
}

type PendingWaiter = {
  expectedCount: number;
  resolve: (reports: LicenseBuildReport[]) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class DefaultRecorder implements Recorder {
  private reports: LicenseBuildReport[] = [];
  private waiters: PendingWaiter[] = [];

  record(report: LicenseBuildReport): void {
    this.reports.push(report);
    this.flushWaiters();
  }

  getReports(): LicenseBuildReport[] {
    return [...this.reports];
  }

  waitForReports(expectedCount?: number, timeoutMs = 30000): Promise<LicenseBuildReport[]> {
    if (expectedCount === undefined || this.reports.length >= expectedCount) {
      return Promise.resolve(this.getReports());
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(
          new Error(
            `LicenseWebpackPlugin: waitForReports timed out after ${timeoutMs}ms. ` +
              `Expected ${expectedCount} reports but received ${this.reports.length}.`
          )
        );
      }, timeoutMs);

      const waiter: PendingWaiter = { expectedCount, resolve, reject, timer };
      this.waiters.push(waiter);
    });
  }

  private flushWaiters(): void {
    const satisfied: PendingWaiter[] = [];
    const remaining: PendingWaiter[] = [];

    for (const waiter of this.waiters) {
      if (this.reports.length >= waiter.expectedCount) {
        satisfied.push(waiter);
      } else {
        remaining.push(waiter);
      }
    }

    this.waiters = remaining;

    for (const waiter of satisfied) {
      clearTimeout(waiter.timer);
      waiter.resolve(this.getReports());
    }
  }
}
