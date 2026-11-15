import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { NodeProcessControl } from './index';

function waitForSpawn(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('spawn', () => resolve());
    child.once('error', reject);
  });
}

describe('owned process control', () => {
  const children: ChildProcess[] = [];

  afterEach(() => {
    for (const child of children.splice(0)) {
      if (child.exitCode === null && !child.killed) child.kill('SIGKILL');
    }
  });

  it('terminates the adopted process tree and preserves a parallel matching process', async () => {
    const args = ['-e', 'setInterval(() => {}, 1000)', 'obpulse-owned-probe'];
    const first = spawn(process.execPath, args, { stdio: 'ignore', windowsHide: true });
    const unrelated = spawn(process.execPath, args, { stdio: 'ignore', windowsHide: true });
    children.push(first, unrelated);
    const spawnEvents = [waitForSpawn(first), waitForSpawn(unrelated)];
    await Promise.all(spawnEvents);

    const control = new NodeProcessControl();
    const identity = await control.inspect(first.pid!);
    const unrelatedIdentity = await control.inspect(unrelated.pid!);
    const firstExited = once(first, 'exit').then(() => undefined);
    await control.terminateTree(identity, /obpulse-owned-probe/);

    if (first.exitCode === null) {
      await Promise.race([
        firstExited,
        delay(10_000).then(() => {
          throw new Error('Owned process did not exit');
        }),
      ]);
    }
    await expect(control.inspect(identity.pid)).rejects.toThrow();
    await expect(control.inspect(unrelatedIdentity.pid)).resolves.toMatchObject(unrelatedIdentity);
  }, 20_000);
});
