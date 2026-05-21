import { spawn } from 'node:child_process';
import http from 'node:http';

const host = '127.0.0.1';
const port = 4173;
const baseUrl = `http://${host}:${port}`;

function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(baseUrl, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${baseUrl}`));
          return;
        }
        setTimeout(tryOnce, 500);
      });
    };

    tryOnce();
  });
}

const server = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port)], {
  stdio: 'inherit',
  shell: true
});

let exitCode = 0;

try {
  await waitForServer();

  await new Promise((resolve, reject) => {
    const qa = spawn('npm', ['run', 'visual:diff'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, BASE_URL: baseUrl }
    });

    qa.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`visual:diff exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
} catch (error) {
  console.error(error.message);
  exitCode = 1;
} finally {
  server.kill('SIGTERM');
}

process.exit(exitCode);
