// Сборщик боевого режима gaz-mag (владелец 18.10.2026: «выводим в бой – убирай цепочку GitHub»).
// Очередь /queue: файлы-задания пишут приёмник (сохранение в админке → build) и ключ выкладки (update – новый код, rollback).
// Сборка: код /repo (git, только чтение с GitHub) + данные /content (products.json, uploads – источник правды в бою)
// → npm run build → замок админки → выкладка /releases/<id>, атомарное переключение current, 5 последних для отката.
// История правок данных – git в /content (коммит на каждую сборку с сообщениями «Админка: …»).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync, appendFileSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const Q = '/queue', STATE = '/state', REPO = '/repo', CONTENT = '/content', REL = '/releases', WORK = '/work/site', CACHE = '/cache';
const GIT_URL = process.env.GIT_URL || 'https://github.com/tema-mail/gaz-mag.git';
const KEEP = 5;
const ENV = { ...process.env, PUBLIC_SITE_URL: 'https://gaz-mag.ru', PUBLIC_LEADS: '1', PUBLIC_STAGE: 'prod', CI: '1' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const LOG = `${STATE}/build.log`;
const log = (s) => { appendFileSync(LOG, `[${now()}] ${s}\n`); console.log(s); };
const run = (cmd, args, opts = {}) => {
  log(`$ ${cmd} ${args.join(' ')}`);
  const out = execFileSync(cmd, args, { env: ENV, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  return out.toString();
};
const status = (s) => writeFileSync(`${STATE}/status.json.tmp`, JSON.stringify({ ...s, at: now() })) || renameSync(`${STATE}/status.json.tmp`, `${STATE}/status.json`);

// Задание в работе лежит в /queue/.work и удаляется только после окончания сборки: перезапуск сборщика посреди
// сборки (установщик, сбой) не теряет его – при старте незавершённые задания возвращаются в очередь (18.10.2026: так
// терялись сборки после deploy/install.sh).
const WORKQ = `${Q}/.work`;
function takeJobs() {
  const files = readdirSync(Q).filter((f) => /^\d+-(build|update|rollback)/.test(f)).sort();
  const jobs = files.map((f) => ({ f, kind: f.split('-')[1], text: readFileSync(path.join(Q, f), 'utf8').trim() }));
  for (const j of jobs) renameSync(path.join(Q, j.f), path.join(WORKQ, j.f));
  return jobs;
}
function finishJobs() { for (const f of readdirSync(WORKQ)) rmSync(path.join(WORKQ, f), { force: true }); }
function requeueUnfinished() {
  mkdirSync(WORKQ, { recursive: true });
  for (const f of readdirSync(WORKQ)) renameSync(path.join(WORKQ, f), path.join(Q, f));
}

function switchTo(id) {
  try { unlinkSync(`${REL}/.current.tmp`); } catch {}
  symlinkSync(id, `${REL}/.current.tmp`);
  renameSync(`${REL}/.current.tmp`, `${REL}/current`);
  appendFileSync(`${REL}/history`, id + '\n');
}
function prune() {
  const hist = existsSync(`${REL}/history`) ? readFileSync(`${REL}/history`, 'utf8').trim().split('\n').reverse() : [];
  const keep = [...new Set(hist)].slice(0, KEEP);
  for (const d of readdirSync(REL)) {
    if (d === 'current' || d === 'history' || d.startsWith('.')) continue;
    if (!keep.includes(d)) rmSync(`${REL}/${d}`, { recursive: true, force: true });
  }
}
function rollback() {
  const cur = path.basename(execFileSync('readlink', [`${REL}/current`]).toString().trim());
  const hist = readFileSync(`${REL}/history`, 'utf8').trim().split('\n').reverse();
  const prev = [...new Set(hist)].find((x) => x !== cur && existsSync(`${REL}/${x}`));
  if (!prev) throw new Error('откатываться некуда');
  switchTo(prev);
  log(`откат на ${prev}`);
  return prev;
}

function pullCode() {
  if (!existsSync(`${REPO}/.git`)) run('git', ['clone', '--depth', '50', GIT_URL, REPO]);
  run('git', ['-C', REPO, 'fetch', '--depth', '50', 'origin', 'main']);
  run('git', ['-C', REPO, 'reset', '--hard', 'origin/main']);
  return run('git', ['-C', REPO, 'rev-parse', '--short=12', 'HEAD']).trim();
}

function initContent() {
  if (existsSync(`${CONTENT}/products.json`)) return;
  log('первый запуск: данные сайта берутся из кода (src/data/products.json, data-src/uploads)');
  mkdirSync(`${CONTENT}/uploads`, { recursive: true });
  cpSync(`${REPO}/src/data/products.json`, `${CONTENT}/products.json`);
  if (existsSync(`${REPO}/data-src/uploads`)) cpSync(`${REPO}/data-src/uploads`, `${CONTENT}/uploads`, { recursive: true });
  run('git', ['-C', CONTENT, 'init', '-q', '-b', 'main']);
  commitContent('Начальные данные из кода сайта');
}
function commitContent(message) {
  run('git', ['-C', CONTENT, 'add', '-A']);
  const changed = run('git', ['-C', CONTENT, 'status', '--porcelain']).trim();
  if (!changed) return;
  run('git', ['-C', CONTENT, '-c', 'user.name=Админка gaz-mag', '-c', 'user.email=admin@gaz-mag.ru', 'commit', '-q', '-m', message]);
}

function build(messages) {
  const sha = pullOrHead();
  initContent();
  // рабочая копия: код + данные сервера; node_modules – общий кэш, переустанавливается только при новом package-lock
  run('rsync', ['-a', '--delete', '--exclude', '.git', '--exclude', 'node_modules', `${REPO}/`, `${WORK}/`]);
  cpSync(`${CONTENT}/products.json`, `${WORK}/src/data/products.json`);
  mkdirSync(`${WORK}/data-src/uploads`, { recursive: true });
  run('rsync', ['-a', `${CONTENT}/uploads/`, `${WORK}/data-src/uploads/`]);
  const lockHash = createHash('sha1').update(readFileSync(`${WORK}/package-lock.json`)).digest('hex');
  if (!existsSync(`${CACHE}/lock.sha1`) || readFileSync(`${CACHE}/lock.sha1`, 'utf8') !== lockHash) {
    log('зависимости: npm ci (новый package-lock)');
    cpSync(`${WORK}/package.json`, `${CACHE}/package.json`); cpSync(`${WORK}/package-lock.json`, `${CACHE}/package-lock.json`);
    run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: CACHE });
    writeFileSync(`${CACHE}/lock.sha1`, lockHash);
  }
  if (!existsSync(`${WORK}/node_modules`)) symlinkSync(`${CACHE}/node_modules`, `${WORK}/node_modules`);
  run('npm', ['run', 'build'], { cwd: WORK });
  run('node', ['scripts/lock-admin.mjs'], { cwd: WORK });
  const id = `${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${sha}`;
  // /work и /releases – разные тома: сначала копия во временную папку тома выкладок, потом атомарное переименование в нём же
  const tmp = `${REL}/.incoming-${id}`;
  rmSync(tmp, { recursive: true, force: true }); rmSync(`${REL}/${id}`, { recursive: true, force: true });
  cpSync(`${WORK}/dist`, tmp, { recursive: true });
  renameSync(tmp, `${REL}/${id}`);
  rmSync(`${WORK}/dist`, { recursive: true, force: true });
  switchTo(id);
  prune();
  commitContent(messages.length ? messages.join('\n') : `Сборка кода ${sha}`);
  return id;
}
let headSha = '';
function pullOrHead() {
  if (!headSha || pending.update) { headSha = pullCode(); pending.update = false; }
  return headSha;
}
const pending = { update: true };

for (const d of [Q, STATE, REL, CONTENT, '/work', CACHE]) mkdirSync(d, { recursive: true });
requeueUnfinished();
status({ state: 'idle', note: 'сборщик запущен' });
log('сборщик gaz-mag запущен');
for (;;) {
  const jobs = takeJobs();
  if (!jobs.length) { await sleep(2000); continue; }
  const job = jobs.map((j) => j.f).join(',');
  try {
    if (jobs.some((j) => j.kind === 'rollback')) {
      const to = rollback();
      status({ state: 'done', ok: true, job, release: to, note: 'откат' });
      finishJobs();
      continue;
    }
    if (jobs.some((j) => j.kind === 'update')) pending.update = true;
    const messages = jobs.filter((j) => j.kind === 'build' && j.text).map((j) => j.text);
    status({ state: 'building', job, messages });
    await sleep(1500); // склеиваем частые сохранения в одну сборку
    for (const j of takeJobs()) { if (j.kind === 'update') pending.update = true; if (j.kind === 'build' && j.text) messages.push(j.text); }
    const id = build(messages);
    status({ state: 'done', ok: true, job, release: id, messages });
    finishJobs();
    log(`выложено ${id}`);
  } catch (e) {
    const tail = String(e.stderr || e.stdout || e.message || e).slice(-2000);
    log(`ОШИБКА: ${tail}`);
    status({ state: 'done', ok: false, job, error: tail.slice(-600) });
    finishJobs(); // ошибка сборки – задание не повторяем по кругу; следующее сохранение или пуш поставит новое
  }
}
