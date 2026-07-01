import { DefaultRecorder } from '../../src/Recorder';
import { LicenseBuildReport } from '../../src/model/LicenseBuildReport';

function makeReport(name: string): LicenseBuildReport {
  return {
    items: [
      {
        package: {
          name,
          version: '1.0.0',
          path: `/node_modules/${name}`,
          packageJsonPath: `/node_modules/${name}/package.json`,
          chunks: ['main'],
          modules: [`/node_modules/${name}/index.js`],
        },
        license: {
          license: 'MIT',
        },
      },
    ],
  };
}

describe('DefaultRecorder', () => {
  it('starts with no reports', () => {
    const recorder = new DefaultRecorder();
    expect(recorder.getReports()).toHaveLength(0);
  });

  it('records a report', () => {
    const recorder = new DefaultRecorder();
    const report = makeReport('lodash');
    recorder.record(report);
    expect(recorder.getReports()).toHaveLength(1);
    expect(recorder.getReports()[0]).toEqual(report);
  });

  it('records multiple reports', () => {
    const recorder = new DefaultRecorder();
    recorder.record(makeReport('lodash'));
    recorder.record(makeReport('react'));
    expect(recorder.getReports()).toHaveLength(2);
  });

  it('getReports returns a copy so mutation does not affect internal state', () => {
    const recorder = new DefaultRecorder();
    recorder.record(makeReport('lodash'));
    const reports = recorder.getReports();
    reports.push(makeReport('extra'));
    expect(recorder.getReports()).toHaveLength(1);
  });

  it('waitForReports resolves immediately when expectedCount is undefined', async () => {
    const recorder = new DefaultRecorder();
    recorder.record(makeReport('lodash'));
    const reports = await recorder.waitForReports();
    expect(reports).toHaveLength(1);
  });

  it('waitForReports resolves immediately when count is already met', async () => {
    const recorder = new DefaultRecorder();
    recorder.record(makeReport('lodash'));
    recorder.record(makeReport('react'));
    const reports = await recorder.waitForReports(2);
    expect(reports).toHaveLength(2);
  });

  it('waitForReports waits until the expected count is reached', async () => {
    const recorder = new DefaultRecorder();

    // Simulate a delayed second record call.
    setTimeout(() => recorder.record(makeReport('react')), 150);

    recorder.record(makeReport('lodash'));
    const reports = await recorder.waitForReports(2, 2000);
    expect(reports).toHaveLength(2);
  });

  it('waitForReports rejects when timeout is exceeded', async () => {
    const recorder = new DefaultRecorder();
    recorder.record(makeReport('lodash'));
    await expect(recorder.waitForReports(3, 300)).rejects.toThrow('timed out');
  });
});
