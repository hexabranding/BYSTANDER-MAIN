import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import mongoose from 'mongoose';

/**
 * Spawns an ephemeral single-node MongoDB replica set for genuine concurrency integration tests.
 * Cleans up temporary storage and child process upon stopping.
 *
 * @returns {Promise<{ supported: boolean, uri?: string, stop?: () => Promise<void>, reason?: string }>}
 */
export async function setupEphemeralReplicaSet() {
  // 1. Verify mongod binary exists in PATH
  let mongodPath;
  try {
    mongodPath = execSync('which mongod', { encoding: 'utf8' }).trim();
  } catch (err) {
    return {
      supported: false,
      reason: 'mongod binary not found in PATH. Concurrency integration tests will be skipped.',
    };
  }

  // 2. Allocate temporary directory and open ephemeral port
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bystander-mongo-rs-'));

  const server = net.createServer();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));

  // 3. Spawn mongod process
  const mongod = spawn(
    mongodPath,
    [
      '--replSet',
      'rs0',
      '--port',
      String(port),
      '--dbpath',
      tmpDir,
      '--bind_ip',
      '127.0.0.1',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let mongodStderr = '';
  mongod.stderr.on('data', (chunk) => {
    mongodStderr += chunk.toString();
  });

  const readyPromise = new Promise((resolve, reject) => {
    mongod.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Waiting for connections')) {
        resolve();
      }
    });
    mongod.on('error', reject);
    mongod.on('close', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`mongod exited prematurely with code ${code}: ${mongodStderr}`));
      }
    });
  });

  try {
    await readyPromise;
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return {
      supported: false,
      reason: `Failed to spawn mongod process: ${err.message}`,
    };
  }

  // 4. Connect directly to initiate replica set rs0
  const uriDirect = `mongodb://127.0.0.1:${port}/admin?directConnection=true`;
  const conn = await mongoose.createConnection(uriDirect).asPromise();

  try {
    await conn.db.admin().command({ replSetInitiate: {} });

    // Poll until node is elected writable primary
    let isPrimary = false;
    for (let i = 0; i < 30; i++) {
      try {
        const status = await conn.db.admin().command({ hello: 1 });
        if (status.isWritablePrimary) {
          isPrimary = true;
          break;
        }
      } catch (e) {
        // Continue polling
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!isPrimary) {
      throw new Error('Replica set election timed out after 6 seconds');
    }
  } catch (err) {
    await conn.close();
    mongod.kill('SIGINT');
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return {
      supported: false,
      reason: `Failed to initiate replica set: ${err.message}`,
    };
  } finally {
    await conn.close();
  }

  const uri = `mongodb://127.0.0.1:${port}/bystander_test?replicaSet=rs0`;

  const stop = async () => {
    try {
      if (mongoose.connection?.readyState !== 0) {
        await mongoose.disconnect();
      }
    } catch (e) {}

    mongod.kill('SIGINT');
    await new Promise((r) => {
      mongod.on('close', r);
      setTimeout(r, 2000); // safety fallback
    });

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  };

  return {
    supported: true,
    uri,
    stop,
  };
}
